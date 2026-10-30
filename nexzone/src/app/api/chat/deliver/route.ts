import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { marcarEntregue } from '@/lib/conversas-servidor';

// Entrega manual pelo vendedor (chat do pedido).
// Só pode entregar, ou atualizar a entrega de, um pedido com pagamento confirmado:
//   'pago'                         → primeira entrega: vira 'entregue' e grava entregue_em
//   'entregue' com entregue_em      → atualização do conteúdo: continua 'entregue' e PRESERVA entregue_em
//                                    (a data conta para a liberação do saldo do vendedor em lib/balance.ts)
//   'entregue' SEM entregue_em      → nada é alterado: precisa de regularização administrativa
// 'pendente', 'cancelado' e 'reembolsado' NUNCA viram 'entregue' por aqui.
//
// Concorrência: cada passo é UM UPDATE condicional. O PostgreSQL reavalia o WHERE sobre a versão
// mais recente da linha (READ COMMITTED), então nenhum passo grava com base numa leitura antiga.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Enviar a entrega NÃO marca mais como entregue sozinho: o vendedor escolhe (marcarEntregue).
// Muitas vezes a primeira mensagem só pede o e-mail do cliente; a entrega de verdade vem depois.

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { body = null; }
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const conteudo = body?.conteudo;
  const marcar = body?.marcarEntregue === true;
  if (!UUID.test(orderId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  if (!conteudo || !String(conteudo).trim()) return NextResponse.json({ error: 'conteúdo vazio' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, store_id, status, entregue_em, comprador, products(titulo)').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'pedido não encontrado' }, { status: 404 });

  // Só o dono da loja entrega
  const { data: store } = await admin.from('stores').select('id').eq('id', (order as any).store_id).eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'sem acesso' }, { status: 403 });

  // Checagem antecipada, só para a mensagem ficar clara. A regra de verdade está nos UPDATEs abaixo.
  const recusa = motivoRecusa((order as any).status);
  if (recusa) return NextResponse.json({ error: recusa, status: (order as any).status }, { status: 409 });
  if (precisaRegularizar(order)) return respostaRegularizacao();

  const texto = String(conteudo).trim().slice(0, 4000);
  const storeId = (store as any).id;
  const base = () => admin.from('orders');

  // Passo 1 — primeira entrega: 'pago' → 'entregue', com a data da entrega.
  let modo: 'entregue' | 'atualizado' | null = null;
  {
    const { data, error } = await base()
      .update({ conteudo_liberado: texto, status: 'entregue', entregue_em: new Date().toISOString() })
      .eq('id', orderId).eq('store_id', storeId).eq('status', 'pago')
      .select('id');
    if (error) return falha(error);
    if (data && data.length) modo = 'entregue';
  }

  // Passo 2 — atualização de pedido já entregue COM data: só o conteúdo muda; entregue_em e status ficam como estão.
  if (!modo) {
    const { data, error } = await base()
      .update({ conteudo_liberado: texto })
      .eq('id', orderId).eq('store_id', storeId).eq('status', 'entregue').not('entregue_em', 'is', null)
      .select('id');
    if (error) return falha(error);
    if (data && data.length) modo = 'atualizado';
  }

  // Não existe passo para 'entregue' SEM data: esse pedido não é alterado automaticamente
  // (preencher a data mexeria na liberação do saldo do vendedor). Ele precisa de regularização administrativa.

  // Nenhum passo alterou o pedido: ou o status mudou depois da leitura (ex.: reembolso),
  // ou o pedido está 'entregue' sem data. Relê só para explicar o motivo; nada é gravado aqui.
  if (!modo) {
    const { data: atual } = await admin.from('orders').select('status, entregue_em').eq('id', orderId).maybeSingle();
    if (atual && precisaRegularizar(atual)) return respostaRegularizacao();
    const st = (atual as any)?.status ?? null;
    return NextResponse.json({ error: motivoRecusa(st) || 'o status do pedido mudou; recarregue a página', status: st }, { status: 409 });
  }

  // A entrega está gravada. Agora o aviso no chat do pedido (mensagem do sistema + o conteúdo como mensagem do vendedor).
  const { error: msgErr } = await admin.from('order_messages').insert({ order_id: orderId, remetente: user.id, papel: 'vendedor', texto });
  // Marca como entregue só se o vendedor escolheu (registra a mensagem de sistema e avisa o cliente)
  let entregue = false;
  if (marcar) {
    const m = await marcarEntregue(admin, { ...(order as any), status: 'entregue' }, 'vendedor');
    entregue = m.ok;
  }
  if (msgErr) {
    console.error('[chat/deliver] entrega gravada, mas falhou o aviso no chat:', msgErr.message);
    return NextResponse.json({ ok: true, modo, entregue, avisoRegistrado: false, parcial: true });
  }

  return NextResponse.json({ ok: true, modo, entregue, avisoRegistrado: true, parcial: false });
}

function motivoRecusa(status: string | null | undefined): string | null {
  if (status === 'pago' || status === 'entregue') return null;
  if (status === 'pendente') return 'Este pedido ainda aguarda o pagamento. A entrega fica disponível quando o pagamento for confirmado.';
  if (status === 'cancelado') return 'Este pedido foi cancelado e não pode ser entregue.';
  if (status === 'reembolsado') return 'Este pedido foi reembolsado ao comprador e não pode mais ser entregue.';
  return 'Este pedido não pode ser entregue no status atual.';
}

// Pedido marcado como entregue mas sem data de entrega (registro antigo ou ajuste manual).
function precisaRegularizar(o: any): boolean {
  return o?.status === 'entregue' && !o?.entregue_em;
}

function respostaRegularizacao() {
  return NextResponse.json({
    error: 'Este pedido consta como entregue, mas está sem a data de entrega. Ele precisa ser regularizado pela equipe do Comprei Barato antes de qualquer atualização. Fale com o suporte.',
    status: 'entregue',
    codigo: 'regularizacao_necessaria',
  }, { status: 409 });
}

function falha(error: { message: string }) {
  console.error('[chat/deliver] falha ao gravar entrega:', error.message);
  return NextResponse.json({ error: 'falha ao entregar' }, { status: 500 });
}
