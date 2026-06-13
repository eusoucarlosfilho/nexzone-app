const GARANTIA_DIAS = 7;

export async function calcBalance(supabase: any, storeId: string) {
  const { data: orders } = await supabase.from('orders')
    .select('valor_vendedor, entregue_em, status')
    .eq('store_id', storeId).eq('status', 'entregue');
  const { data: payouts } = await supabase.from('payouts')
    .select('valor, status').eq('store_id', storeId);

  const now = Date.now();
  const cutoff = now - GARANTIA_DIAS * 86400000;
  let liberado = 0, aLiberar = 0;
  const futuros: { t: number; valor: number }[] = [];

  for (const o of (orders ?? [])) {
    const t = o.entregue_em ? new Date(o.entregue_em).getTime() : 0;
    const v = Number(o.valor_vendedor);
    if (t && t <= cutoff) {
      liberado += v;
    } else {
      aLiberar += v;
      if (t) futuros.push({ t: t + GARANTIA_DIAS * 86400000, valor: v });
    }
  }

  // Agrupa as liberações futuras por dia
  const map: Record<number, { t: number; valor: number }> = {};
  for (const f of futuros) {
    const d = new Date(f.t); d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    if (!map[k]) map[k] = { t: f.t, valor: 0 };
    map[k].valor += f.valor;
  }
  const liberacoes = Object.values(map)
    .map((g) => ({ data: new Date(g.t).toISOString(), dias: Math.max(0, Math.ceil((g.t - now) / 86400000)), valor: g.valor }))
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  const proxima = liberacoes[0] || null;

  let sacado = 0, emProcessamento = 0;
  for (const p of (payouts ?? [])) {
    if (p.status === 'pago') sacado += Number(p.valor);
    else if (p.status === 'solicitado') emProcessamento += Number(p.valor);
  }
  const disponivel = Math.max(0, liberado - sacado - emProcessamento);
  return { disponivel, aLiberar, sacado, emProcessamento, liberado, liberacoes, proxima, garantiaDias: GARANTIA_DIAS };
}
