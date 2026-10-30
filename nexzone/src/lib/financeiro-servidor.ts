// Financeiro da Sala de comando — leitura no SERVIDOR (service_role). Nunca importar em componente do navegador.
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { lerConfigFin, montarFinanceiro, ultimosMeses, custoFixoMensal, totalGasto, type Custo, type ConfigFin } from './financeiro';
import { tipoPelosBytes, nomeSeguro } from './conversas';

type Admin = ReturnType<typeof createAdminClient>;
export const BUCKET_FIN = 'financeiro';
const TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const MAX = 10 * 1024 * 1024;
const CHAVES_CFG = ['fin_custo_pix_entrada', 'fin_custo_pix_saida', 'fin_custo_cartao_pct', 'fin_custo_cartao_fixo', 'fin_aliquota_das'];

export async function lerCfgFin(admin: Admin): Promise<ConfigFin> {
  const { data } = await admin.from('settings').select('key, value').in('key', CHAVES_CFG);
  return lerConfigFin(Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, r.value])));
}

export async function salvarCfgFin(admin: Admin, c: ConfigFin) {
  const agora = new Date().toISOString();
  const { error } = await admin.from('settings').upsert([
    { key: 'fin_custo_pix_entrada', value: c.custoPixEntrada, updated_at: agora },
    { key: 'fin_custo_pix_saida', value: c.custoPixSaida, updated_at: agora },
    { key: 'fin_custo_cartao_pct', value: c.custoCartaoPct, updated_at: agora },
    { key: 'fin_custo_cartao_fixo', value: c.custoCartaoFixo, updated_at: agora },
    { key: 'fin_aliquota_das', value: c.aliquotaDas, updated_at: agora },
  ]);
  return !error;
}

/** Tudo da tela: 12 meses de receita (automática) e custos (lançados), custódia e totais. */
export async function painelFinanceiro(admin: Admin, qtdMeses = 12) {
  const meses = ultimosMeses(qtdMeses);
  const desde = `${meses[0]}-01T00:00:00Z`;
  // tolerante: sem SQL 17/21 algumas colunas não existem
  let ped = await admin.from('orders').select('status, total, taxa, valor_vendedor, forma_pagamento, taxa_comprador_pix, taxa_comprador_cartao, created_at, entregue_em')
    .in('status', ['pago', 'entregue', 'reembolsado']).gte('created_at', desde).limit(20000);
  if (ped.error) ped = await admin.from('orders').select('status, total, taxa, valor_vendedor, created_at, entregue_em').in('status', ['pago', 'entregue', 'reembolsado']).gte('created_at', desde).limit(20000) as any;
  let saq = await admin.from('payouts').select('status, valor, taxa_saque, created_at, pago_em').gte('created_at', desde).limit(20000);
  if (saq.error) saq = await admin.from('payouts').select('status, valor, created_at').gte('created_at', desde).limit(20000) as any;
  const des = await admin.from('boosts').select('status, valor, created_at, pago_em').gte('created_at', desde).limit(20000);
  const cus = await admin.from('fin_custos').select('id, descricao, categoria, valor, tipo, data, fim, pago_por, observacao, comprovante_path, comprovante_nome').order('data', { ascending: false }).limit(5000);
  const sql27 = !cus.error;
  const custos: Custo[] = ((cus.data ?? []) as any[]).map((c) => ({ ...c, valor: Number(c.valor), tem_comprovante: !!c.comprovante_path, comprovante_path: undefined }));
  const cfg = await lerCfgFin(admin);

  const fin = montarFinanceiro({
    pedidos: ((ped.data ?? []) as any[]).map((o) => ({ ...o, forma_pagamento: o.forma_pagamento ?? 'pix' })),
    saques: (saq.data ?? []) as any[], destaques: (des.error ? [] : des.data ?? []) as any[], custos, cfg, meses,
  });

  // Custódia (todos os tempos): parte dos vendedores em pedidos válidos − saques já pagos
  const [vv, pg] = await Promise.all([
    admin.from('orders').select('valor_vendedor').in('status', ['pago', 'entregue']).limit(50000),
    admin.from('payouts').select('valor').eq('status', 'pago').limit(50000),
  ]);
  const soma = (l: any[] | null, k: string) => (l ?? []).reduce((a, r) => a + Number(r[k] || 0), 0);
  const custodia = Math.round((soma(vv.data as any[], 'valor_vendedor') - soma(pg.data as any[], 'valor')) * 100) / 100;
  const atual = meses[meses.length - 1];
  return { sql27, cfg, ...fin, custos, custodia, fixoMensal: custoFixoMensal(custos, atual), gastoTotal: totalGasto(custos, atual) };
}

// ---------- Comprovantes ----------
async function garantirBucket(admin: Admin) {
  try {
    const { data } = await admin.storage.getBucket(BUCKET_FIN);
    if (!data) await admin.storage.createBucket(BUCKET_FIN, { public: false, fileSizeLimit: MAX, allowedMimeTypes: TIPOS });
  } catch (e: any) { console.error('[financeiro] bucket:', e?.message || e); }
}

export async function uploadComprovante(admin: Admin, tipo: string, tamanho: number) {
  if (!TIPOS.includes(tipo)) return { error: 'Envie imagem (PNG, JPG, WEBP) ou PDF.' };
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > MAX) return { error: 'O comprovante pode ter no máximo 10 MB.' };
  await garantirBucket(admin);
  const { data, error } = await admin.storage.from(BUCKET_FIN).createSignedUploadUrl(`comprovantes/${randomUUID()}.${EXT[tipo]}`);
  if (error || !data) return { error: 'Não foi possível preparar o envio.' };
  return { path: data.path, token: data.token };
}

/** Confere o arquivo de verdade antes de ligar ao custo. */
export async function confirmarComprovante(admin: Admin, path: unknown, nome: unknown): Promise<{ ok: true; path: string; nome: string } | { ok: false; error: string }> {
  const p = String(path || '');
  if (!/^comprovantes\/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/.test(p)) return { ok: false, error: 'Comprovante inválido.' };
  const { data: blob, error } = await admin.storage.from(BUCKET_FIN).download(p);
  if (error || !blob) return { ok: false, error: 'Comprovante não encontrado. Envie de novo.' };
  const buf = new Uint8Array(await blob.arrayBuffer());
  const tipo = tipoPelosBytes(buf);
  if (!tipo || !TIPOS.includes(tipo) || buf.byteLength > MAX || EXT[tipo] !== p.split('.').pop()) {
    await admin.storage.from(BUCKET_FIN).remove([p]);
    return { ok: false, error: 'Envie imagem (PNG, JPG, WEBP) ou PDF de até 10 MB.' };
  }
  return { ok: true, path: p, nome: nomeSeguro(nome) };
}

export async function linkComprovante(admin: Admin, id: number): Promise<string | null> {
  const { data } = await admin.from('fin_custos').select('comprovante_path, comprovante_nome').eq('id', id).maybeSingle();
  if (!(data as any)?.comprovante_path) return null;
  const { data: s } = await admin.storage.from(BUCKET_FIN).createSignedUrl((data as any).comprovante_path, 300);
  return (s as any)?.signedUrl ?? null;
}
