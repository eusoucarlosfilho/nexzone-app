// Liberação de pedidos e destaques após o pagamento.
// Compartilhado pelos webhooks do Pix (/api/webhooks/payment) e do cartão (/api/webhooks/stripe).
// USO EXCLUSIVO NO SERVIDOR: recebe o client admin (service_role).
import { awardPoints, getSettingNum } from '@/lib/points';
import { notificarCompraAprovada } from '@/lib/notificacoes';

export type PaymentEvent = {
  status: 'pago' | 'recusado' | 'estornado' | 'pendente';
  amount?: number;      // valor confirmado pelo gateway (quando disponível)
  gatewayRef?: string;  // só para log
};

// Pago, mas com valor menor que o cobrado: não libera.
export function valorConfere(event: PaymentEvent, esperado: any) {
  if (event.amount === undefined) return true;
  const ok = event.amount + 0.01 >= Number(esperado ?? 0);
  if (!ok) console.error('Webhook: valor pago menor que o esperado', event.gatewayRef, event.amount, esperado);
  return ok;
}

// boost precisa de: id, status, product_id, dias, valor
export async function processarBoost(admin: any, boost: any, event: PaymentEvent) {
  if (event.status === 'pago' && boost.status === 'pendente' && valorConfere(event, boost.valor)) {
    const expira = new Date(Date.now() + boost.dias * 86400000).toISOString();
    // .eq('status','pendente') garante que dois avisos simultâneos não ativem duas vezes
    const { data: upd } = await admin.from('boosts')
      .update({ status: 'pago', pago_em: new Date().toISOString(), expira_em: expira })
      .eq('id', boost.id).eq('status', 'pendente').select('id');
    if (!upd || !upd.length) return;
    await admin.from('products').update({ destaque_ate: expira }).eq('id', boost.product_id);
  }
}

// order precisa de: id, status, product_id, store_id, cupom, bump_product_id, comprador, total
// Devolve true se o pedido foi liberado nesta chamada.
export async function processarPedido(admin: any, order: any, event: PaymentEvent): Promise<boolean> {
  if (event.status === 'pago' && order.status === 'pendente' && valorConfere(event, order.total)) {
    const { data: product } = await admin.from('products').select('conteudo_entrega, vendas').eq('id', order.product_id).single();
    // Só muda se AINDA estiver pendente: se o Pix e o cartão (ou dois avisos) chegarem juntos,
    // apenas um libera e soma vendas/pontos/cupom.
    const { data: upd } = await admin.from('orders').update({
      status: 'entregue', conteudo_liberado: product?.conteudo_entrega ?? null, entregue_em: new Date().toISOString(),
    }).eq('id', order.id).eq('status', 'pendente').select('id');
    if (!upd || !upd.length) return false;

    await admin.from('products').update({ vendas: (product?.vendas ?? 0) + 1 }).eq('id', order.product_id);

    // CB Points: comprador e vendedor ganham por compra
    const porCompra = await getSettingNum(admin, 'cb_points_per_purchase', 3);
    if (porCompra > 0) {
      const { data: loja } = await admin.from('stores').select('owner').eq('id', order.store_id).maybeSingle();
      await awardPoints(admin, order.comprador, porCompra, 'Compra realizada', order.id);
      if ((loja as any)?.owner) await awardPoints(admin, (loja as any).owner, porCompra, 'Venda realizada', order.id);
    }
    if (order.bump_product_id) {
      const { data: bp } = await admin.from('products').select('vendas').eq('id', order.bump_product_id).single();
      await admin.from('products').update({ vendas: (bp?.vendas ?? 0) + 1 }).eq('id', order.bump_product_id);
    }
    if (order.cupom) {
      const { data: cup } = await admin.from('coupons').select('id, usos').eq('store_id', order.store_id).eq('codigo', order.cupom).maybeSingle();
      if (cup) await admin.from('coupons').update({ usos: (cup.usos ?? 0) + 1 }).eq('id', cup.id);
    }

    // E-mails "Compra aprovada" (comprador) e "Você vendeu" (dono da loja).
    // Só chega aqui quem efetivamente mudou o pedido para 'entregue' (upd com linha),
    // então avisos repetidos do gateway não duplicam e-mails. Nunca lança erro.
    await notificarCompraAprovada(admin, order.id);

    return true;
  } else if (event.status === 'estornado') {
    await admin.from('orders').update({ status: 'reembolsado' }).eq('id', order.id);
  }
  return false;
}

export const ORDER_FIELDS = 'id, status, product_id, store_id, cupom, bump_product_id, comprador, total';
export const BOOST_FIELDS = 'id, status, product_id, dias, valor';
