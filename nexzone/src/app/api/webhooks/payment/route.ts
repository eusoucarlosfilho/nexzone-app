import { NextResponse } from 'next/server';
import { gatewayDoAviso } from '@/lib/payments/gateway';
import { createAdminClient } from '@/lib/supabase/server';
import { processarPedido, processarBoost, ORDER_FIELDS, BOOST_FIELDS } from '@/lib/payments/fulfill';
import { gravarFormaPagamento } from '@/lib/payments/formaPagamento';

// Aviso do gateway Pix (MisticPay / Mercado Pago).
// A liberação (pedido e destaque) fica em src/lib/payments/fulfill.ts, compartilhada com o webhook da Stripe.
export async function POST(req: Request) {
  const raw = await req.text();
  // MisticPay e Mercado Pago (Pix das vendas pequenas) chegam nesta mesma URL
  const gw = await gatewayDoAviso(req, raw);
  const event = await gw.parseWebhook(req, raw);
  if (!event) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const ev = { status: event.status, amount: event.amount, gatewayRef: event.gatewayRef };

  // BOOST identificado pelo orderId (gateways que devolvem o external_reference, ex.: Mercado Pago)
  if (event.orderId && event.orderId.startsWith('boost:')) {
    const boostId = event.orderId.slice(6);
    const { data: boost } = await admin.from('boosts').select(BOOST_FIELDS).eq('id', boostId).maybeSingle();
    if (boost) await processarBoost(admin, boost, ev);
    return NextResponse.json({ ok: true });
  }

  // PEDIDO — por id (se veio) ou por gateway_ref (ex.: MisticPay, que só devolve o id dela)
  let oq = admin.from('orders').select(ORDER_FIELDS);
  oq = event.orderId && /^[0-9a-f-]{36}$/i.test(event.orderId) ? oq.eq('id', event.orderId) : oq.eq('gateway_ref', event.gatewayRef);
  const { data: order } = await oq.maybeSingle();
  if (order) {
    const liberado = await processarPedido(admin, order, ev);
    if (liberado && ev.status === 'pago') await gravarFormaPagamento(admin, (order as any).id, 'pix'); // Dashboard: entrou no Pix
    return NextResponse.json({ ok: true });
  }

  // Não achou pedido: pode ser um BOOST pago via MisticPay (casamos por gateway_ref)
  if (event.gatewayRef) {
    const { data: boost } = await admin.from('boosts').select(BOOST_FIELDS).eq('gateway_ref', event.gatewayRef).maybeSingle();
    if (boost) await processarBoost(admin, boost, ev);
  }

  return NextResponse.json({ ok: true });
}
