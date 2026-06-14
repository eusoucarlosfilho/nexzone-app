import { NextResponse } from 'next/server';
import { getGateway } from '@/lib/payments/gateway';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const raw = await req.text();
  const gw = await getGateway();
  const event = await gw.parseWebhook(req, raw);
  if (!event) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  async function processarBoost(boost: any) {
    if (event!.status === 'pago' && boost.status === 'pendente') {
      const expira = new Date(Date.now() + boost.dias * 86400000).toISOString();
      await admin.from('boosts').update({ status: 'pago', pago_em: new Date().toISOString(), expira_em: expira }).eq('id', boost.id);
      await admin.from('products').update({ destaque_ate: expira }).eq('id', boost.product_id);
    }
  }

  async function processarPedido(order: any) {
    if (event!.status === 'pago' && order.status === 'pendente') {
      const { data: product } = await admin.from('products').select('conteudo_entrega, vendas').eq('id', order.product_id).single();
      await admin.from('orders').update({
        status: 'entregue', conteudo_liberado: product?.conteudo_entrega ?? null, entregue_em: new Date().toISOString(),
      }).eq('id', order.id);
      await admin.from('products').update({ vendas: (product?.vendas ?? 0) + 1 }).eq('id', order.product_id);
      if (order.bump_product_id) {
        const { data: bp } = await admin.from('products').select('vendas').eq('id', order.bump_product_id).single();
        await admin.from('products').update({ vendas: (bp?.vendas ?? 0) + 1 }).eq('id', order.bump_product_id);
      }
      if (order.cupom) {
        const { data: cup } = await admin.from('coupons').select('id, usos').eq('store_id', order.store_id).eq('codigo', order.cupom).maybeSingle();
        if (cup) await admin.from('coupons').update({ usos: (cup.usos ?? 0) + 1 }).eq('id', cup.id);
      }
    } else if (event!.status === 'estornado') {
      await admin.from('orders').update({ status: 'reembolsado' }).eq('id', order.id);
    }
  }

  // BOOST identificado pelo orderId (gateways que devolvem o external_reference, ex.: Mercado Pago)
  if (event.orderId && event.orderId.startsWith('boost:')) {
    const boostId = event.orderId.slice(6);
    const { data: boost } = await admin.from('boosts').select('id, status, product_id, dias').eq('id', boostId).maybeSingle();
    if (boost) await processarBoost(boost);
    return NextResponse.json({ ok: true });
  }

  // PEDIDO — por id (se veio) ou por gateway_ref (ex.: MisticPay, que só devolve o id dela)
  let oq = admin.from('orders').select('id, status, product_id, store_id, cupom, bump_product_id');
  oq = event.orderId ? oq.eq('id', event.orderId) : oq.eq('gateway_ref', event.gatewayRef);
  const { data: order } = await oq.maybeSingle();
  if (order) { await processarPedido(order); return NextResponse.json({ ok: true }); }

  // Não achou pedido: pode ser um BOOST pago via MisticPay (casamos por gateway_ref)
  if (event.gatewayRef) {
    const { data: boost } = await admin.from('boosts')
      .select('id, status, product_id, dias').eq('gateway_ref', event.gatewayRef).maybeSingle();
    if (boost) await processarBoost(boost);
  }

  return NextResponse.json({ ok: true });
}
