import { NextResponse } from 'next/server';
import { getGateway } from '@/lib/payments/gateway';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const raw = await req.text();
  const gw = getGateway();
  const event = await gw.parseWebhook(req, raw);
  if (!event) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  // BOOST (destaque pago)
  if (event.orderId && event.orderId.startsWith('boost:')) {
    const boostId = event.orderId.slice(6);
    const { data: boost } = await admin.from('boosts').select('id, status, product_id, dias').eq('id', boostId).maybeSingle();
    if (!boost) return NextResponse.json({ ok: true });
    if (event.status === 'pago' && boost.status === 'pendente') {
      const expira = new Date(Date.now() + boost.dias * 86400000).toISOString();
      await admin.from('boosts').update({ status: 'pago', pago_em: new Date().toISOString(), expira_em: expira }).eq('id', boost.id);
      await admin.from('products').update({ destaque_ate: expira }).eq('id', boost.product_id);
    }
    return NextResponse.json({ ok: true });
  }

  // PEDIDO (produto)
  let query = admin.from('orders').select('id, status, product_id, store_id, cupom');
  query = event.orderId ? query.eq('id', event.orderId) : query.eq('gateway_ref', event.gatewayRef);
  const { data: order } = await query.maybeSingle();
  if (!order) return NextResponse.json({ ok: true });

  if (event.status === 'pago' && order.status === 'pendente') {
    const { data: product } = await admin.from('products').select('conteudo_entrega, vendas').eq('id', order.product_id).single();
    await admin.from('orders').update({
      status: 'entregue', conteudo_liberado: product?.conteudo_entrega ?? null, entregue_em: new Date().toISOString(),
    }).eq('id', order.id);
    await admin.from('products').update({ vendas: (product?.vendas ?? 0) + 1 }).eq('id', order.product_id);
    if ((order as any).cupom) {
      const { data: cup } = await admin.from('coupons').select('id, usos').eq('store_id', (order as any).store_id).eq('codigo', (order as any).cupom).maybeSingle();
      if (cup) await admin.from('coupons').update({ usos: (cup.usos ?? 0) + 1 }).eq('id', cup.id);
    }
  } else if (event.status === 'estornado') {
    await admin.from('orders').update({ status: 'reembolsado' }).eq('id', order.id);
  }
  return NextResponse.json({ ok: true });
}
