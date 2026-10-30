// Campanhas — parte do servidor (service_role). Nunca importar em componente do navegador.
import { createAdminClient } from '@/lib/supabase/server';
import { awardPoints } from '@/lib/points';
import { lerCampanhas, situacaoFundador, pontosCashback, CHAVES_CAMPANHAS, CAMPANHAS_PADRAO, type CfgCampanhas, type SituacaoFundador } from './campanhas';

type Admin = ReturnType<typeof createAdminClient>;

export async function lerCfgCampanhas(admin?: Admin): Promise<CfgCampanhas & { cbAtivo: boolean; pontosPorReal: number }> {
  try {
    const a = admin ?? createAdminClient();
    const { data } = await a.from('settings').select('key, value').in('key', [...CHAVES_CAMPANHAS, 'cb_points_ativo', 'cb_points_per_brl']);
    const m: Record<string, unknown> = Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, r.value]));
    const pr = Number(String(m.cb_points_per_brl ?? '').replace(/"/g, ''));
    return { ...lerCampanhas(m), cbAtivo: m.cb_points_ativo === true || m.cb_points_ativo === 'true', pontosPorReal: Number.isFinite(pr) && pr > 0 ? pr : 100 };
  } catch {
    return { ...CAMPANHAS_PADRAO, cbAtivo: false, pontosPorReal: 100 };
  }
}

/** Ainda não tem nenhuma compra paga (nem reembolsada) na plataforma? */
export async function ehPrimeiraCompra(admin: Admin, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { count, error } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('comprador', userId).in('status', ['pago', 'entregue', 'reembolsado']);
  return !error && (count ?? 0) === 0;
}

/** Situação de Fundador da loja (sem o SQL 28: não é fundadora). */
export async function fundadorDaLoja(admin: Admin, storeId: string | null | undefined, cfg?: CfgCampanhas): Promise<SituacaoFundador> {
  const vazio: SituacaoFundador = { fundador: false, numero: null, ativo: false, ate: null, vendido: 0, restante: 0, motivoFim: null };
  if (!storeId) return vazio;
  const { data: s, error } = await admin.from('stores').select('fundador_em, fundador_numero').eq('id', storeId).maybeSingle();
  if (error || !s || !(s as any).fundador_numero) return vazio;
  const c = cfg ?? (await lerCfgCampanhas(admin));
  const { data: ped } = await admin.from('orders').select('total').eq('store_id', storeId).in('status', ['pago', 'entregue']).gte('created_at', (s as any).fundador_em).limit(5000);
  const vendido = ((ped ?? []) as any[]).reduce((a, o) => a + Number(o.total || 0), 0);
  return situacaoFundador(s as any, vendido, c);
}

/** Torna a loja fundadora (se ainda houver vaga) e dá o destaque grátis no produto aprovado. Nunca lança erro. */
export async function tornarFundador(admin: Admin, storeId: string, productId?: string | null): Promise<number | null> {
  try {
    const cfg = await lerCfgCampanhas(admin);
    if (!cfg.fundadorAtivo) return null;
    const { data: antes } = await admin.from('stores').select('fundador_numero').eq('id', storeId).maybeSingle();
    if ((antes as any)?.fundador_numero) return (antes as any).fundador_numero; // já era: não ganha destaque de novo
    const { data: num, error } = await admin.rpc('tornar_fundador', { p_store: storeId, p_vagas: cfg.fundadorVagas });
    if (error || !num) return null;
    if (productId && cfg.fundadorDestaqueDias > 0) {
      const ate = new Date(Date.now() + cfg.fundadorDestaqueDias * 86400000).toISOString();
      await admin.from('products').update({ destaque_ate: ate }).eq('id', productId).or(`destaque_ate.is.null,destaque_ate.lt.${new Date().toISOString()}`);
    }
    return Number(num);
  } catch (e: any) {
    console.error('[fundador]', e?.message || e);
    return null;
  }
}

export async function vagasFundador(admin: Admin, cfg?: CfgCampanhas): Promise<{ usadas: number; total: number; restantes: number; sql28: boolean }> {
  const c = cfg ?? (await lerCfgCampanhas(admin));
  const { count, error } = await admin.from('stores').select('id', { count: 'exact', head: true }).not('fundador_numero', 'is', null);
  const usadas = error ? 0 : count ?? 0;
  return { usadas, total: c.fundadorVagas, restantes: Math.max(0, c.fundadorVagas - usadas), sql28: !error };
}

/** Cashback em CB Points quando o pagamento confirma (chamado uma vez por pedido pago). */
export async function concederCashback(admin: Admin, orderId: string) {
  try {
    const cfg = await lerCfgCampanhas(admin);
    if (!cfg.cbAtivo || !(cfg.cashbackPct > 0)) return;
    const { data: o } = await admin.from('orders').select('id, comprador, total, status').eq('id', orderId).maybeSingle();
    if (!o || !['pago', 'entregue'].includes((o as any).status)) return;
    const { count } = await admin.from('points_ledger').select('id', { count: 'exact', head: true }).eq('order_id', orderId).eq('motivo', 'Cashback da compra');
    if ((count ?? 0) > 0) return; // já deu
    const pts = pontosCashback(Number((o as any).total), cfg.cashbackPct, cfg.pontosPorReal);
    if (pts > 0) await awardPoints(admin, (o as any).comprador, pts, 'Cashback da compra', orderId);
  } catch (e: any) { console.error('[cashback]', e?.message || e); }
}

/** Reembolso: o cashback daquele pedido volta. */
export async function estornarCashback(admin: Admin, orderId: string) {
  try {
    const { data } = await admin.from('points_ledger').select('user_id, delta').eq('order_id', orderId).eq('motivo', 'Cashback da compra');
    const ja = await admin.from('points_ledger').select('id', { count: 'exact', head: true }).eq('order_id', orderId).eq('motivo', 'Estorno do cashback');
    if ((ja.count ?? 0) > 0) return;
    for (const r of (data ?? []) as any[]) if (Number(r.delta) > 0) await awardPoints(admin, r.user_id, -Number(r.delta), 'Estorno do cashback', orderId);
  } catch (e: any) { console.error('[cashback] estorno', e?.message || e); }
}
