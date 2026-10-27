import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { MOTIVOS, rotuloMotivo } from '@/lib/garantia';
import { situacaoGarantia } from '@/lib/reembolso-servidor';

export const dynamic = 'force-dynamic';

// Comprador: pedir reembolso dentro da garantia ou desistir do pedido aberto.
//   POST { orderId, motivo, detalhe }        → abre o pedido
//   POST { orderId, acao: 'cancelar' }        → desiste (o saldo volta ao fluxo normal)
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });

  const admin = createAdminClient();
  const { data: o } = await admin.from('orders').select('id, comprador').eq('id', orderId).maybeSingle();
  if (!o || (o as any).comprador !== user.id) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  if (b.acao === 'cancelar') {
    const { data: upd } = await admin.from('reembolso_pedidos').update({ status: 'cancelado', decidido_em: new Date().toISOString(), decidido_por: user.id })
      .eq('order_id', orderId).eq('comprador', user.id).eq('status', 'aberto').select('id');
    if (upd && upd.length) {
      await admin.from('order_messages').insert({ order_id: orderId, remetente: null, papel: 'sistema', texto: 'O cliente desistiu do pedido de reembolso. A venda segue normalmente.' });
    }
    return NextResponse.json({ ok: true });
  }

  const g = await situacaoGarantia(admin, orderId);
  if (!g) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  if (!g.sql18) return NextResponse.json({ error: 'O pedido de reembolso pelo site ainda não está ativo. Fale com o suporte pela conversa do pedido.' }, { status: 503 });
  if (!g.elegivel.pode) return NextResponse.json({ error: g.elegivel.motivo }, { status: 400 });

  const motivo = MOTIVOS.some((m) => m.id === b.motivo) ? String(b.motivo) : '';
  if (!motivo) return NextResponse.json({ error: 'Escolha o motivo.' }, { status: 400 });
  const detalhe = String(b.detalhe ?? '').trim().slice(0, 2000);
  if (['nao_era_o_esperado', 'problema_tecnico', 'outro'].includes(motivo) && detalhe.length < 10) {
    return NextResponse.json({ error: 'Conte em poucas palavras o que aconteceu (isso ajuda a resolver mais rápido).' }, { status: 400 });
  }
  const { error } = await admin.from('reembolso_pedidos').insert({ order_id: orderId, comprador: user.id, motivo, detalhe: detalhe || null });
  if (error) {
    if (/reembolso_um_aberto|duplicate/i.test(error.message || '')) return NextResponse.json({ error: 'Já existe um pedido de reembolso em análise.' }, { status: 400 });
    console.error('[reembolso]', error.message);
    return NextResponse.json({ error: 'Não foi possível registrar agora. Tente de novo.' }, { status: 500 });
  }
  await admin.from('order_messages').insert({
    order_id: orderId, remetente: null, papel: 'sistema',
    texto: `O cliente pediu reembolso dentro da garantia. Motivo: ${rotuloMotivo(motivo)}.${detalhe ? `\n\n"${detalhe}"` : ''}\n\nO saldo desta venda fica retido até a equipe decidir. Vendedor: se puder resolver, responda por aqui.`,
  });
  return NextResponse.json({ ok: true });
}
