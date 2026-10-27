// Anota no pedido como ele foi pago ('pix' ou 'cartao'), para o Dashboard separar as entradas (SQL 17).
// Chamado pelos webhooks DEPOIS que o pedido foi liberado. Nunca lança erro e nunca muda valor ou status.
export async function gravarFormaPagamento(admin: any, orderId: string, forma: 'pix' | 'cartao') {
  try {
    const { error } = await admin.from('orders').update({ forma_pagamento: forma }).eq('id', orderId).is('forma_pagamento', null);
    if (error && !/forma_pagamento/i.test(error.message || '')) console.error('[forma_pagamento]', error.message);
  } catch { /* sem SQL 17: segue */ }
}
