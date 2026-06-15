import { createAdminClient } from './supabase/server';

const num = (v: any, d: number) => { const n = Number(v); return isNaN(n) ? d : n; };

export async function calcBalance(supabase: any, storeId: string) {
  const admin = createAdminClient();

  const { data: orders } = await supabase.from('orders')
    .select('id, valor_vendedor, entregue_em, status')
    .eq('store_id', storeId).eq('status', 'entregue');
  const { data: payouts } = await supabase.from('payouts')
    .select('valor, status').eq('store_id', storeId);

  const ids = (orders ?? []).map((o: any) => o.id);

  // Config de liberação
  const { data: cfg } = await admin.from('settings').select('key, value').in('key', ['review_window_days', 'fast_release_days']);
  const cmap: any = Object.fromEntries((cfg ?? []).map((r: any) => [r.key, r.value]));
  const JANELA = num(cmap.review_window_days, 5);    // dias padrão de garantia
  const RAPIDO = num(cmap.fast_release_days, 1);      // dias quando há avaliação positiva

  // Avaliações e reclamações desses pedidos
  let reviewsByOrder: Record<string, number> = {};
  let complaintOrders = new Set<string>();
  if (ids.length) {
    const { data: revs } = await admin.from('reviews').select('order_id, nota').in('order_id', ids);
    for (const r of (revs ?? [])) reviewsByOrder[(r as any).order_id] = Number((r as any).nota);
    const { data: cmps } = await admin.from('complaints').select('order_id, status').in('order_id', ids).eq('status', 'aberta');
    for (const c of (cmps ?? [])) complaintOrders.add((c as any).order_id);
  }

  // Créditos de saldo (ex.: troca de pontos)
  const { data: credits } = await admin.from('balance_credits').select('valor').eq('store_id', storeId);
  const creditoTotal = (credits ?? []).reduce((s: number, c: any) => s + Number(c.valor), 0);

  const now = Date.now();
  let liberado = creditoTotal, aLiberar = 0, bloqueado = 0;
  const futuros: { t: number; valor: number }[] = [];

  for (const o of (orders ?? [])) {
    const t = o.entregue_em ? new Date(o.entregue_em).getTime() : 0;
    const v = Number(o.valor_vendedor);

    if (complaintOrders.has(o.id)) { bloqueado += v; continue; } // retido por reclamação

    const positiva = (reviewsByOrder[o.id] ?? 0) >= 4;
    const holdDays = positiva ? RAPIDO : JANELA;
    const liberaEm = t ? t + holdDays * 86400000 : now + holdDays * 86400000;

    if (t && liberaEm <= now) {
      liberado += v;
    } else {
      aLiberar += v;
      futuros.push({ t: liberaEm, valor: v });
    }
  }

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
  return { disponivel, aLiberar, bloqueado, sacado, emProcessamento, liberado, liberacoes, proxima, garantiaDias: JANELA };
}
