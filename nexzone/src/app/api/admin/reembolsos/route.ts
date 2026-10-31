import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { adminSeguro } from '@/lib/ofertas/adminSeguro';
import { marcarReembolsado, registrarDevolucao } from '@/lib/reembolso-servidor';
import { gatewayDaRef, contaDoGateway } from '@/lib/payments/gateway';
import { contatosDosCompradores } from '@/lib/clientesPedidos';
import { semSql18 } from '@/lib/curso-servidor';

export const dynamic = 'force-dynamic';

// Admin → Reembolsos.
//   GET  ?status=aberto|todos  → lista com o pedido, a forma de pagamento e o código no gateway
//   POST { id, acao: 'aprovar' | 'recusar', resposta? }
// "Aprovar" registra que o dinheiro foi devolvido: o admin devolve no painel do gateway (Pix na MisticPay,
// cartão na Stripe) e confirma aqui. O site marca o pedido como reembolsado e tira o saldo do vendedor.
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}

export async function GET(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const status = new URL(req.url).searchParams.get('status') === 'todos' ? null : 'aberto';
  const COLS_31 = 'id, order_id, motivo, detalhe, status, resposta, created_at, decidido_em, decidido_por, devolucao_status, devolucao_em, devolucao_valor, devolucao_ref, devolucao_origem, devolucao_por';
  // "Em análise" = abertos + aprovados cuja devolução ainda não foi confirmada (precisam de ação)
  const consulta = (cols: string, comDevolucao: boolean) => {
    let q = admin.from('reembolso_pedidos').select(cols).order('id', { ascending: false }).limit(200);
    if (status) q = comDevolucao ? q.or('status.eq.aberto,devolucao_status.eq.aguardando,devolucao_status.eq.recusada') : q.eq('status', status);
    return q;
  };
  let sql31 = true;
  let { data, error } = await consulta(COLS_31, true);
  if (error && /devolucao/.test(error.message || '')) { sql31 = false; ({ data, error } = await consulta('id, order_id, motivo, detalhe, status, resposta, created_at, decidido_em, decidido_por', false)); }
  if (error) return NextResponse.json({ sql18: !semSql18(error), itens: [] });
  // quem aprovou / quem confirmou a devolução à mão (nome do admin)
  const adminsIds = Array.from(new Set(((data ?? []) as any[]).flatMap((r) => [r.decidido_por, r.devolucao_por]).filter(Boolean)));
  const nomesAdmins: Record<string, string> = {};
  if (adminsIds.length) {
    const { data: ps } = await admin.from('profiles').select('id, nome').in('id', adminsIds);
    for (const p of (ps ?? []) as any[]) nomesAdmins[p.id] = p.nome || 'Admin';
  }
  const ids = Array.from(new Set(((data ?? []) as any[]).map((r) => r.order_id)));
  const reforcado = (await adminSeguro()).ok;
  const pedidos: Record<string, any> = {};
  if (ids.length) {
    const { data: os } = await admin.from('orders').select('*, products(titulo), stores(nome)').in('id', ids);
    const nomes = await contatosDosCompradores(admin, ((os ?? []) as any[]).map((o) => o.comprador)).catch(() => ({} as Record<string, any>));
    for (const o of (os ?? []) as any[]) {
      pedidos[o.id] = {
        total: Number(o.total),
        // o que o cliente pagou de fato = pedido + taxa de serviço do método (SQL 21); é isso que se devolve
        pago: Math.round((Number(o.total) + (o.forma_pagamento === 'cartao' ? Number(o.taxa_comprador_cartao || 0) : o.forma_pagamento === 'pix' ? Number(o.taxa_comprador_pix || 0) : 0)) * 100) / 100,
        status: o.status, pago_em: o.entregue_em || o.created_at, forma: o.forma_pagamento ?? null,
        // código da transação no gateway: todo admin vê (não é dado pessoal) — é com ele que se acha a compra no painel
        gateway_ref: o.gateway_ref ?? null, comprador_email: reforcado ? o.comprador_email : null, comprador_nome: nomes[o.comprador]?.nome ?? null,
        produto: o.products?.titulo ?? 'Produto', loja: o.stores?.nome ?? '—', criado_em: o.created_at,
        pix: o.gateway_dados ? { pagador: o.gateway_dados.pagador ?? null, e2e: o.gateway_dados.e2e ?? null, banco: o.gateway_dados.banco ?? null } : null,
      };
    }
  }
  const { count } = await admin.from('reembolso_pedidos').select('id', { count: 'exact', head: true }).eq('status', 'aberto');
  const conta = await contaDoGateway().catch(() => null);
  return NextResponse.json({ sql18: true, sql31, conta, abertos: count ?? 0, itens: ((data ?? []) as any[]).map((r) => ({ ...r, aprovado_por_nome: r.decidido_por ? nomesAdmins[r.decidido_por] ?? 'Admin' : null, devolucao_por_nome: r.devolucao_por ? nomesAdmins[r.devolucao_por] ?? 'Admin' : null, pedido: pedidos[r.order_id] ?? null })) });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const id = Math.floor(Number(b.id));
  if (!(id > 0) || !['aprovar', 'recusar', 'conferir', 'confirmar_manual'].includes(b.acao)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });

  // Conferir na MisticPay se a devolução já foi feita (caso o aviso automático não tenha chegado)
  if (b.acao === 'conferir' || b.acao === 'confirmar_manual') {
    const adminC = createAdminClient();
    const { data: rr } = await adminC.from('reembolso_pedidos').select('id, order_id, status').eq('id', id).maybeSingle();
    if (!rr) return NextResponse.json({ error: 'Pedido de reembolso não encontrado.' }, { status: 404 });
    if (b.acao === 'confirmar_manual') {
      // cartão (Stripe) ou quando o admin confirma à mão: registra QUEM confirmou
      const m = await registrarDevolucao(adminC, (rr as any).order_id, { origem: 'manual', adminId: a.user!.id });
      return m.ok ? NextResponse.json({ ok: true, mensagem: 'Devolução registrada em seu nome.' }) : NextResponse.json({ error: m.erro }, { status: 400 });
    }
    const { data: o } = await adminC.from('orders').select('gateway_ref').eq('id', (rr as any).order_id).maybeSingle();
    const ref = String((o as any)?.gateway_ref || '');
    if (!ref) return NextResponse.json({ error: 'Este pedido não tem o código da transação no gateway.' }, { status: 400 });
    const alvo = await gatewayDaRef(ref);
    const ev = await alvo.gw.checkPayment(alvo.ref);
    if (!ev) return NextResponse.json({ error: 'Não foi possível consultar a MisticPay agora. Tente de novo.' }, { status: 502 });
    if (ev.status === 'estornado') {
      await registrarDevolucao(adminC, (rr as any).order_id, { origem: 'conferencia', valor: ev.amount ?? null });
      return NextResponse.json({ ok: true, devolvido: true, mensagem: 'A MisticPay confirmou a devolução. Reembolso concluído.' });
    }
    const valor = ev.amount != null ? `R$ ${Number(ev.amount).toFixed(2).replace('.', ',')}` : 'valor não informado';
    const quando = ev.criadoEm ? new Date(ev.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const sit: Record<string, string> = { COMPLETO: 'paga, ainda NÃO devolvida', PENDENTE: 'pendente (não foi paga)', FALHA: 'falhou', DEVOLVIDO_PARCIAL: 'devolvida em PARTE' };
    return NextResponse.json({ ok: true, devolvido: false, mensagem: `Compra encontrada na conta MisticPay do site: ${valor}${quando ? `, criada em ${quando}` : ''}. Situação: ${sit[String(ev.estado)] || ev.estado || ev.status}.` });
  }
  const resposta = String(b.resposta ?? '').trim().slice(0, 2000);
  if (b.acao === 'recusar' && resposta.length < 10) return NextResponse.json({ error: 'Explique ao cliente o motivo da recusa.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: r } = await admin.from('reembolso_pedidos').select('id, order_id, status').eq('id', id).maybeSingle();
  if (!r) return NextResponse.json({ error: 'Pedido de reembolso não encontrado.' }, { status: 404 });
  if ((r as any).status !== 'aberto') return NextResponse.json({ error: 'Este pedido já foi decidido.' }, { status: 409 });

  if (b.acao === 'aprovar') {
    const m = await marcarReembolsado(admin, (r as any).order_id);
    if (!m.ok) return NextResponse.json({ error: m.erro }, { status: 400 });
  }
  // Pix: a devolução fica "aguardando" até a MisticPay avisar que devolveu (o aviso fecha sozinho)
  const { data: upd, error } = await admin.from('reembolso_pedidos').update({
    status: b.acao === 'aprovar' ? 'aprovado' : 'recusado', resposta: resposta || null, decidido_por: a.user!.id, decidido_em: new Date().toISOString(),
  }).eq('id', id).eq('status', 'aberto').select('id');
  if (error || !upd?.length) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  if (b.acao === 'aprovar') {
    // cartão: o admin já marcou "Já devolvi no Stripe" → fica registrado no nome dele. Pix: aguarda o aviso da MisticPay.
    const { data: of } = await admin.from('orders').select('forma_pagamento').eq('id', (r as any).order_id).maybeSingle();
    const cartao = (of as any)?.forma_pagamento === 'cartao';
    const { error: e31 } = await admin.from('reembolso_pedidos').update(cartao
      ? { devolucao_status: 'manual', devolucao_por: a.user!.id, devolucao_em: new Date().toISOString(), devolucao_origem: 'manual' }
      : { devolucao_status: 'aguardando' }).eq('id', id).is('devolucao_status', null);
    if (e31 && !/devolucao/.test(e31.message || '')) console.error('[reembolso]', e31.message);
  }

  await admin.from('order_messages').insert({
    order_id: (r as any).order_id, remetente: null, papel: 'sistema',
    texto: b.acao === 'aprovar'
      ? `Reembolso aprovado pela equipe. O valor volta pela mesma forma de pagamento (Pix: na hora; cartão: até 2 faturas).${resposta ? `\n\n${resposta}` : ''}`
      : `Reembolso não aprovado pela equipe.\n\n${resposta}`,
  });
  return NextResponse.json({ ok: true });
}
