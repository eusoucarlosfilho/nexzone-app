// Programa de indicação — SÓ SERVIDOR (service role). Sem o SQL 37 tudo aqui vira "não faz nada" em silêncio.
// Nunca lança erro para quem chamou (compra aprovada, reembolso, rotina): falha de indicação não derruba venda.
import { createAdminClient } from '@/lib/supabase/server';
import { awardPoints } from '@/lib/points';
import { SITE } from '@/lib/seoSite';
import {
  CHAVE_INDICACAO, CODIGO, INDICACAO_PADRAO, avaliarConversao, gerarCodigo, linkIndicacao, normalizarCfgIndicacao, podeVincular,
  type CfgIndicacao,
} from '@/lib/indicacao';

type Admin = ReturnType<typeof createAdminClient>;
const MOTIVO_PONTOS = 'Indicação: 1ª compra do indicado';
const MOTIVO_ESTORNO = 'Estorno da indicação (compra reembolsada)';

export async function lerCfgIndicacao(admin: Admin = createAdminClient()): Promise<CfgIndicacao> {
  try {
    const { data } = await admin.from('settings').select('value').eq('key', CHAVE_INDICACAO).maybeSingle();
    return data ? normalizarCfgIndicacao((data as any).value) : INDICACAO_PADRAO;
  } catch { return INDICACAO_PADRAO; }
}
export async function salvarCfgIndicacao(admin: Admin, v: unknown): Promise<CfgIndicacao> {
  const cfg = normalizarCfgIndicacao(v);
  await admin.from('settings').upsert({ key: CHAVE_INDICACAO, value: cfg, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return cfg;
}

/** Código do usuário (cria na 1ª vez). null = sem o SQL 37. */
export async function meuCodigo(admin: Admin, userId: string): Promise<{ codigo: string; bloqueado: boolean } | null> {
  const { data, error } = await admin.from('indicacao_codigos').select('codigo, bloqueado').eq('user_id', userId).maybeSingle();
  if (error) return null;
  if (data) return data as any;
  for (let i = 0; i < 5; i++) {
    const codigo = gerarCodigo();
    const { error: e } = await admin.from('indicacao_codigos').insert({ user_id: userId, codigo });
    if (!e) return { codigo, bloqueado: false };
    if (!/23505|duplicate/i.test(`${e.code} ${e.message}`)) return null;
    const { data: d2 } = await admin.from('indicacao_codigos').select('codigo, bloqueado').eq('user_id', userId).maybeSingle();
    if (d2) return d2 as any; // outra aba criou ao mesmo tempo
  }
  return null;
}

/** Vincula a conta nova ao código do convite. Idempotente (indicado_id é único). */
export async function vincularIndicacao(admin: Admin, p: { userId: string; codigo: string; vid?: string | null }): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const codigo = String(p.codigo || '').toUpperCase();
    if (!CODIGO.test(codigo)) return { ok: false, motivo: 'código inválido' };
    const cfg = await lerCfgIndicacao(admin);
    const [{ data: cod }, { data: ja }, { count: pagas }, usr] = await Promise.all([
      admin.from('indicacao_codigos').select('user_id, bloqueado').eq('codigo', codigo).maybeSingle(),
      admin.from('indicacoes').select('id').eq('indicado_id', p.userId).maybeSingle(),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('comprador', p.userId).in('status', ['pago', 'entregue', 'reembolsado']),
      admin.auth.admin.getUserById(p.userId),
    ]);
    const criado = (usr as any)?.data?.user?.created_at || '';
    const r = podeVincular({ cfg, indicadorId: (cod as any)?.user_id ?? null, indicadoId: p.userId, contaCriadaEm: criado, codigoBloqueado: !!(cod as any)?.bloqueado, jaTemCompraPaga: (pagas ?? 0) > 0, jaIndicado: !!ja });
    if (!r.ok) return r;
    const indicador = (cod as any).user_id as string;

    // Sinais para o admin (sem dado pessoal): mesmo navegador do indicador e rajada de cadastros pelo mesmo código
    const sinais: Record<string, boolean | number> = {};
    const vid = /^[0-9a-f-]{36}$/i.test(String(p.vid || '')) ? String(p.vid).toLowerCase() : null;
    if (vid) {
      const { count } = await admin.from('site_sessions').select('id', { count: 'exact', head: true }).eq('visitor_id', vid).eq('user_id', indicador);
      if ((count ?? 0) > 0) sinais.mesmo_navegador = true;
    }
    const { count: dia } = await admin.from('indicacoes').select('id', { count: 'exact', head: true }).eq('indicador_id', indicador).gte('criado_em', new Date(Date.now() - 86400000).toISOString());
    if ((dia ?? 0) + 1 > cfg.alertaCadastrosDia) sinais.muitos_cadastros_24h = (dia ?? 0) + 1;

    const { error } = await admin.from('indicacoes').insert({
      indicador_id: indicador, indicado_id: p.userId, codigo, sinais,
      ...(sinais.mesmo_navegador ? { status: 'bloqueada', motivo: 'Mesmo navegador de quem indicou: análise do admin.' } : {}),
    });
    if (error) return { ok: false, motivo: /23505|duplicate/i.test(`${error.code} ${error.message}`) ? 'já indicado' : 'falha ao gravar' };
    return { ok: true };
  } catch (e: any) { console.error('[indicacao] vincular', e?.message || e); return { ok: false, motivo: 'erro' }; }
}

/** 1ª compra paga do indicado: deixa a recompensa PENDENTE até o prazo. Chamado uma vez por pedido pago. */
export async function converterIndicacao(admin: Admin, orderId: string): Promise<void> {
  try {
    const { data: o } = await admin.from('orders').select('id, comprador, total, product_id, status, stores(owner)').eq('id', orderId).maybeSingle();
    if (!o || !['pago', 'entregue'].includes((o as any).status)) return;
    const { data: ind, error } = await admin.from('indicacoes').select('id, indicador_id, status').eq('indicado_id', (o as any).comprador).maybeSingle();
    if (error || !ind || (ind as any).status !== 'cadastrado') return; // sem SQL, sem indicação ou já tratada
    const cfg = await lerCfgIndicacao(admin);
    const [{ count: pagas }, { count: recomp }] = await Promise.all([
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('comprador', (o as any).comprador).in('status', ['pago', 'entregue', 'reembolsado']),
      admin.from('indicacoes').select('id', { count: 'exact', head: true }).eq('indicador_id', (ind as any).indicador_id).in('status', ['pendente', 'liberada']),
    ]);
    const r = avaliarConversao({
      cfg, pedido: { total: Number((o as any).total), product_id: (o as any).product_id, dono_loja: (o as any).stores?.owner ?? null },
      indicadorId: (ind as any).indicador_id, indicadoId: (o as any).comprador, comprasPagasDoIndicado: pagas ?? 1, recompensasDoIndicador: recomp ?? 0,
    });
    const agora = new Date().toISOString();
    const patch = r.ok
      ? { status: 'pendente', order_id: orderId, pontos: r.pontos, libera_em: r.liberaEm, atualizado_em: agora }
      : { status: r.status, order_id: orderId, motivo: r.motivo, atualizado_em: agora };
    await admin.from('indicacoes').update(patch).eq('id', (ind as any).id).eq('status', 'cadastrado'); // condicional: idempotente
  } catch (e: any) { console.error('[indicacao] converter', e?.message || e); }
}

/** Rotina: libera os pontos das indicações pendentes cujo prazo passou e cuja compra continua paga. */
export async function liberarIndicacoes(admin: Admin, limite = 30): Promise<{ liberadas: number; estornadas: number }> {
  const out = { liberadas: 0, estornadas: 0 };
  try {
    const { data, error } = await admin.from('indicacoes').select('id, indicador_id, order_id, pontos')
      .eq('status', 'pendente').lte('libera_em', new Date().toISOString()).order('libera_em').limit(limite);
    if (error) return out;
    for (const i of (data ?? []) as any[]) {
      const { data: o } = i.order_id ? await admin.from('orders').select('status').eq('id', i.order_id).maybeSingle() : { data: null };
      const agora = new Date().toISOString();
      if (!o || !['pago', 'entregue'].includes((o as any).status)) {
        await admin.from('indicacoes').update({ status: 'estornada', motivo: 'Compra reembolsada ou cancelada antes da liberação.', atualizado_em: agora }).eq('id', i.id).eq('status', 'pendente');
        out.estornadas++; continue;
      }
      // trava primeiro (só quem mudar de pendente → liberada credita): dois disparos não pagam duas vezes
      const { data: upd } = await admin.from('indicacoes').update({ status: 'liberada', liberada_em: agora, atualizado_em: agora }).eq('id', i.id).eq('status', 'pendente').select('id');
      if (!upd?.length) continue;
      const { count } = await admin.from('points_ledger').select('id', { count: 'exact', head: true }).eq('order_id', i.order_id).eq('motivo', MOTIVO_PONTOS).eq('user_id', i.indicador_id);
      if ((count ?? 0) === 0 && Number(i.pontos) > 0) await awardPoints(admin, i.indicador_id, Number(i.pontos), MOTIVO_PONTOS, i.order_id);
      out.liberadas++;
    }
  } catch (e: any) { console.error('[indicacao] liberar', e?.message || e); }
  return out;
}

/** Reembolso: pendente vira estornada; já liberada tem os pontos debitados (uma vez). */
export async function estornarIndicacao(admin: Admin, orderId: string): Promise<void> {
  try {
    const { data: i, error } = await admin.from('indicacoes').select('id, indicador_id, status, pontos').eq('order_id', orderId).maybeSingle();
    if (error || !i) return;
    const agora = new Date().toISOString();
    if ((i as any).status === 'pendente') {
      await admin.from('indicacoes').update({ status: 'estornada', motivo: 'Compra reembolsada.', atualizado_em: agora }).eq('id', (i as any).id).eq('status', 'pendente');
      return;
    }
    if ((i as any).status !== 'liberada') return;
    const { data: upd } = await admin.from('indicacoes').update({ status: 'estornada', motivo: 'Compra reembolsada depois da liberação: pontos estornados.', atualizado_em: agora }).eq('id', (i as any).id).eq('status', 'liberada').select('id');
    if (!upd?.length) return;
    const { count } = await admin.from('points_ledger').select('id', { count: 'exact', head: true }).eq('order_id', orderId).eq('motivo', MOTIVO_ESTORNO);
    if ((count ?? 0) === 0 && Number((i as any).pontos) > 0) await awardPoints(admin, (i as any).indicador_id, -Number((i as any).pontos), MOTIVO_ESTORNO, orderId);
  } catch (e: any) { console.error('[indicacao] estornar', e?.message || e); }
}

/** "Minhas indicações": números do próprio usuário. Os indicados aparecem sem nome (só data e situação). */
export async function resumoIndicacoes(admin: Admin, userId: string) {
  const cfg = await lerCfgIndicacao(admin);
  const cod = await meuCodigo(admin, userId);
  if (!cod) return { sql37: false as const, cfg };
  const [{ data: lista }, visitas] = await Promise.all([
    admin.from('indicacoes').select('id, status, pontos, criado_em, libera_em, liberada_em').eq('indicador_id', userId).order('criado_em', { ascending: false }).limit(200),
    admin.from('site_sessions').select('id', { count: 'exact', head: true }).eq('utm_source', 'indicacao').eq('utm_content', cod.codigo.toLowerCase()),
  ]);
  const l = (lista ?? []) as any[];
  const soma = (st: string) => l.filter((x) => x.status === st).reduce((s, x) => s + (Number(x.pontos) || 0), 0);
  return {
    sql37: true as const, cfg: { ativo: cfg.ativo, pontos: cfg.pontos, minimo: cfg.minimo, prazoDias: cfg.prazoDias, fim: cfg.fim },
    codigo: cod.codigo, bloqueado: cod.bloqueado, link: linkIndicacao(SITE, cod.codigo),
    visitas: (visitas as any)?.count ?? null,
    cadastros: l.length,
    compras: l.filter((x) => ['pendente', 'liberada', 'estornada'].includes(x.status)).length,
    pontosPendentes: soma('pendente'), pontosLiberados: soma('liberada'),
    historico: l.slice(0, 50).map((x, i) => ({ n: l.length - i, status: x.status, pontos: x.pontos, criado_em: x.criado_em, libera_em: x.libera_em, liberada_em: x.liberada_em })),
  };
}
