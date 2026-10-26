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
    // Entrega dos order bumps vai NA MESMA gravação que libera o pedido (o comprador nunca vê "pago" sem os extras)
    const extras = await prepararBumps(admin, order);
    const { data: upd } = await admin.from('orders').update({
      status: 'entregue', conteudo_liberado: product?.conteudo_entrega ?? null, entregue_em: new Date().toISOString(),
      ...extras.campos,
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
    await contarVendasBumps(admin, extras.entregues);
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

// Order bumps (até 4): monta a entrega de cada item extra SÓ agora, com o pagamento confirmado.
// Pedido antigo (um bump só, sem a lista) continua funcionando. Bump de outra loja nunca é entregue.
// Nunca lança erro: se falhar, o pedido principal é liberado do mesmo jeito.
export async function prepararBumps(admin: any, order: any): Promise<{ campos: Record<string, any>; entregues: any[] }> {
  try {
    const { data: o } = await admin.from('orders').select('bumps, bump_product_id, bump_titulo, bump_valor').eq('id', order.id).maybeSingle();
    const lista: any[] = Array.isArray((o as any)?.bumps) && (o as any).bumps.length
      ? (o as any).bumps
      : (o as any)?.bump_product_id ? [{ product_id: (o as any).bump_product_id, titulo: (o as any).bump_titulo, valor: (o as any).bump_valor }] : [];
    if (!lista.length) return { campos: {}, entregues: [] };
    const { data: prods } = await admin.from('products')
      .select('id, store_id, titulo, vendas, conteudo_entrega, arquivo_path, arquivo_nome, tipo_entrega')
      .in('id', lista.map((b) => b.product_id).filter(Boolean));
    const entregues = lista.flatMap((b) => {
      const p: any = (prods ?? []).find((x: any) => x.id === b.product_id);
      if (!p || p.store_id !== order.store_id) return [];
      return [{
        product_id: p.id, titulo: b.titulo || p.titulo, valor: Number(b.valor) || 0,
        conteudo: p.conteudo_entrega ?? null, arquivo_path: p.arquivo_path ?? null, arquivo_nome: p.arquivo_nome ?? null, tipo_entrega: p.tipo_entrega ?? null,
        _vendas: p.vendas ?? 0,
      }];
    });
    const limpos = entregues.map(({ _vendas, ...e }) => e);
    const primeiro = limpos[0];
    return {
      campos: {
        bumps: limpos,
        bump_conteudo: primeiro?.conteudo ?? null, bump_arquivo_path: primeiro?.arquivo_path ?? null,
        bump_arquivo_nome: primeiro?.arquivo_nome ?? null, bump_tipo_entrega: primeiro?.tipo_entrega ?? null,
      },
      entregues,
    };
  } catch (e: any) {
    console.error('prepararBumps falhou', order?.id, e?.message);
    return { campos: {}, entregues: [] };
  }
}

async function contarVendasBumps(admin: any, entregues: any[]) {
  for (const e of entregues) {
    try { await admin.from('products').update({ vendas: (e._vendas ?? 0) + 1 }).eq('id', e.product_id); } catch { /* segue */ }
  }
}

export const ORDER_FIELDS = 'id, status, product_id, store_id, cupom, bump_product_id, comprador, total';
export const BOOST_FIELDS = 'id, status, product_id, dias, valor';
