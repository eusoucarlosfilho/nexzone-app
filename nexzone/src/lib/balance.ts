const GARANTIA_DIAS = 7;

export async function calcBalance(supabase: any, storeId: string) {
  const { data: orders } = await supabase.from('orders')
    .select('valor_vendedor, entregue_em, status')
    .eq('store_id', storeId).eq('status', 'entregue');
  const { data: payouts } = await supabase.from('payouts')
    .select('valor, status').eq('store_id', storeId);

  const cutoff = Date.now() - GARANTIA_DIAS * 86400000;
  let liberado = 0, aLiberar = 0;
  for (const o of (orders ?? [])) {
    const t = o.entregue_em ? new Date(o.entregue_em).getTime() : 0;
    if (t && t <= cutoff) liberado += Number(o.valor_vendedor);
    else aLiberar += Number(o.valor_vendedor);
  }
  let sacado = 0, emProcessamento = 0;
  for (const p of (payouts ?? [])) {
    if (p.status === 'pago') sacado += Number(p.valor);
    else if (p.status === 'solicitado') emProcessamento += Number(p.valor);
  }
  const disponivel = Math.max(0, liberado - sacado - emProcessamento);
  return { disponivel, aLiberar, sacado, emProcessamento, liberado };
}
