import { NextResponse } from 'next/server';
import { getGateway } from '@/lib/payments/gateway';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const raw = await req.text();
  const gw = getGateway();
  const event = await gw.parseWebhook(req, raw);
  if (!event) return NextResponse.json({ ok: true }); // ignora ruído

  const admin = createAdminClient(); // ignora RLS (rotina de sistema)

  // localiza o pedido pela referência do gateway (ou pelo external_reference)
  let query = admin.from('orders').select('id, status, product_id');
  query = event.orderId
    ? query.eq('id', event.orderId)
    : query.eq('gateway_ref', event.gatewayRef);
  const { data: order } = await query.maybeSingle();
  if (!order) return NextResponse.json({ ok: true });

  if (event.status === 'pago' && order.status === 'pendente') {
    const { data: product } = await admin.from('products')
      .select('conteudo_entrega, vendas').eq('id', order.product_id).single();

    await admin.from('orders').update({
      status: 'entregue',
      conteudo_liberado: product?.conteudo_entrega ?? null,
      entregue_em: new Date().toISOString(),
    }).eq('id', order.id);

    await admin.from('products')
      .update({ vendas: (product?.vendas ?? 0) + 1 })
      .eq('id', order.product_id);

    // TODO (frente C): disparar e-mail (Brevo) + evento Purchase do Meta CAPI aqui.
  } else if (event.status === 'estornado') {
    await admin.from('orders').update({ status: 'reembolsado' }).eq('id', order.id);
  }

  return NextResponse.json({ ok: true });
}
