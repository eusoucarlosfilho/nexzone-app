import { NextResponse } from 'next/server';
import { getGateway } from '@/lib/payments/gateway';
import { createAdminClient } from '@/lib/supabase/server';
import { processarPedido, processarBoost, ORDER_FIELDS, BOOST_FIELDS } from '@/lib/payments/fulfill';

// Aviso do gateway Pix (MisticPay / Mercado Pago).
// A liberação (pedido e destaque) fica em src/lib/payments/fulfill.ts, compartilhada com o webhook da Stripe.
export async function POST(req: Request) {
  const raw = await req.text();
  const gw = await getGateway();
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
  oq = event.orderId ? oq.eq('id', event.orderId) : oq.eq('gateway_ref', event.gatewayRef);
  const { data: order } = await oq.maybeSingle();
  if (order) { await processarPedido(admin, order, ev); return NextResponse.json({ ok: true }); }

  // Não achou pedido: pode ser um BOOST pago via MisticPay (casamos por gateway_ref)
  if (event.gatewayRef) {
    const { data: boost } = await admin.from('boosts').select(BOOST_FIELDS).eq('gateway_ref', event.gatewayRef).maybeSingle();
    if (boost) await processarBoost(admin, boost, ev);
  }

  return NextResponse.json({ ok: true });
}
