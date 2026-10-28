import { createAdminClient } from './supabase/server';
import { lerConfigTaxas, diasDeLiberacao } from './taxas';

const num = (v: any, d: number) => { const n = Number(v); return isNaN(n) ? d : n; };

export async function calcBalance(supabase: any, storeId: string) {
  const admin = createAdminClient();

  const { data: orders } = await supabase.from('orders')
    .select('id, valor_vendedor, entregue_em, status')
    .eq('store_id', storeId).eq('status', 'entregue');
  let { data: payouts, error: pErr } = await supabase.from('payouts')
    .select('valor, status, taxa_saque').eq('store_id', storeId);
  if (pErr) ({ data: payouts } = await supabase.from('payouts').select('valor, status').eq('store_id', storeId)); // sem SQL 21

  const ids = (orders ?? []).map((o: any) => o.id);

  // Config de liberação
  const { data: cfg } = await admin.from('settings').select('key, value').in('key', ['review_window_days', 'fast_release_days', 'liberacao_conta_dias', 'liberacao_padrao_dias', 'liberacao_cartao_dias']);
  const cmap: any = Object.fromEntries((cfg ?? []).map((r: any) => [r.key, r.value]));
  const cfgTaxas = lerConfigTaxas(cmap);
  // Liberação por tipo de anúncio e meio de pagamento (SQL 21 + SQL 17). Sem as colunas: regra antiga.
  const tipoPorPedido: Record<string, string> = {};
  const formaPorPedido: Record<string, string> = {};
  let modeloNovo = false;
  if (ids.length) {
    try {
      const { data: det, error: dErr } = await admin.from('orders').select('id, forma_pagamento, products(tipo_anuncio)').in('id', ids);
      if (!dErr) {
        modeloNovo = 'liberacao_padrao_dias' in cmap;
        for (const d of (det ?? []) as any[]) { tipoPorPedido[d.id] = d.products?.tipo_anuncio ?? 'digital'; formaPorPedido[d.id] = d.forma_pagamento ?? ''; }
      }
    } catch { /* sem SQL 21 */ }
  }
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
    // Pedido de reembolso em análise (SQL 18): o saldo fica retido, igual reclamação. Sem a tabela: ignora.
    try {
      const { data: rbs, error: rbErr } = await admin.from('reembolso_pedidos').select('order_id').in('order_id', ids).eq('status', 'aberto');
      if (!rbErr) for (const r of (rbs ?? [])) complaintOrders.add((r as any).order_id);
    } catch { /* sem SQL 18 */ }
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
    const holdDays = modeloNovo
      ? diasDeLiberacao(tipoPorPedido[o.id], formaPorPedido[o.id], cfgTaxas, { avaliacaoPositiva: positiva, rapidoDias: RAPIDO })
      : (positiva ? RAPIDO : JANELA);
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

  // O saque desconta o valor enviado + a taxa do saque extra (R$ 0,99; o 1º da semana é grátis)
  let sacado = 0, emProcessamento = 0;
  for (const p of (payouts ?? []) as any[]) {
    const custo = Number(p.valor) + (Number(p.taxa_saque) || 0);
    if (p.status === 'pago') sacado += custo;
    else if (p.status === 'solicitado') emProcessamento += custo;
  }
  const disponivel = Math.max(0, liberado - sacado - emProcessamento);
  return { disponivel, aLiberar, bloqueado, sacado, emProcessamento, liberado, liberacoes, proxima, garantiaDias: JANELA };
}
