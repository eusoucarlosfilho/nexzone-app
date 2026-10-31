import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { estornarCashback } from '@/lib/campanhas-servidor';
import { estornarIndicacao } from '@/lib/indicacao-servidor';
import { conferirPedido, conferirPendentes } from '@/lib/payments/conferirPix';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const { id, action } = await req.json();
  // Conferir o Pix direto na MisticPay (cliente diz que pagou e o pedido segue "Aguardando pagamento")
  if (action === 'conferir') {
    const r = await conferirPedido(createAdminClient(), String(id || ''));
    await registrarAcao({ adminId: user.id, acao: 'pix_conferido', alvoTipo: 'pedido', alvoId: String(id || ''), detalhes: { resultado: r } });
    const msg: Record<string, string> = {
      liberado: 'Pix confirmado na MisticPay: pedido liberado agora.',
      pendente: 'A MisticPay ainda mostra este Pix como NÃO pago.',
      recusado: 'A MisticPay mostra este Pix como falho/recusado.',
      ja_pago: 'Este pedido já não está pendente.',
      sem_ref: 'Este pedido não tem código do gateway (o Pix não chegou a ser gerado).',
      erro: 'Não foi possível consultar a MisticPay agora. Tente de novo em instantes.',
    };
    return NextResponse.json({ ok: r !== 'erro', resultado: r, mensagem: msg[r] }, { status: r === 'erro' ? 502 : 200 });
  }
  if (action === 'conferir_todos') {
    const r = await conferirPendentes(createAdminClient(), { horas: 24 * 7, limite: 60, ms: 25000 });
    return NextResponse.json({ ok: true, ...r });
  }
  if (action !== 'reembolsar') return NextResponse.json({ error: 'ação inválida' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, status, product_id').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'pedido não encontrado' }, { status: 404 });
  if (!(order.status === 'pago' || order.status === 'entregue')) {
    return NextResponse.json({ error: 'só é possível reembolsar pedidos pagos/entregues' }, { status: 400 });
  }

  await admin.from('orders').update({ status: 'reembolsado' }).eq('id', id);
  const { data: prod } = await admin.from('products').select('vendas').eq('id', order.product_id).single();
  await admin.from('products').update({ vendas: Math.max(0, (prod?.vendas ?? 1) - 1) }).eq('id', order.product_id);
  await estornarCashback(admin, String(id)); // o cashback da compra volta (SQL 28)
  await estornarIndicacao(admin, String(id)); // e a recompensa da indicação também (SQL 37)
  await registrarAcao({ adminId: user.id, acao: 'pedido_reembolsado', alvoTipo: 'pedido', alvoId: String(id) });

  return NextResponse.json({ ok: true, status: 'reembolsado' });
}
