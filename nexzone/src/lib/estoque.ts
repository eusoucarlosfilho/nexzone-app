// ============================================================
// Estoque do produto e exibição dos contadores (avaliações/vendas).
//
// Colunas (SQL 07): products.estoque (null = não controla), products.pausado_sem_estoque,
// products.ocultar_contadores. Tudo aqui é TOLERANTE: se o SQL 07 ainda não foi rodado,
// as consultas falham em silêncio e o site se comporta como antes.
//
// Contadores: automáticos (pedidos pagos e avaliações de compradores) ou, com o modo manual
// ligado pelo admin (SQL 08), os números digitados no Admin → Produtos → Gerenciar.
// ============================================================

export const ESTOQUE_MAX = 1_000_000;
export const POUCAS_UNIDADES = 10;

/** Lê o que o vendedor digitou. '' = não controlar estoque (null). */
export function lerEstoque(v: unknown): { ok: true; valor: number | null } | { ok: false; erro: string } {
  if (v === null || v === undefined) return { ok: true, valor: null };
  const s = String(v).trim();
  if (s === '') return { ok: true, valor: null };
  if (!/^\d+$/.test(s)) return { ok: false, erro: 'Digite só números inteiros (ex.: 25), ou deixe em branco para não controlar estoque.' };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 0 || n > ESTOQUE_MAX) return { ok: false, erro: `Use um número de 0 a ${ESTOQUE_MAX.toLocaleString('pt-BR')}.` };
  return { ok: true, valor: n };
}

export type AvisoEstoque = { texto: string; nivel: 'esgotado' | 'pouco' | 'ok' } | null;

/** Texto mostrado ao comprador. null = produto não controla estoque (nada aparece). */
export function avisoEstoque(estoque: number | null | undefined): AvisoEstoque {
  if (estoque === null || estoque === undefined || !Number.isFinite(Number(estoque))) return null;
  const n = Math.max(0, Math.floor(Number(estoque)));
  if (n === 0) return { texto: 'Esgotado', nivel: 'esgotado' };
  if (n === 1) return { texto: 'Última unidade disponível', nivel: 'pouco' };
  if (n <= POUCAS_UNIDADES) return { texto: `Restam só ${n} unidades`, nivel: 'pouco' };
  return { texto: `${n.toLocaleString('pt-BR')} unidades disponíveis`, nivel: 'ok' };
}

export type ExtrasProduto = { estoque: number | null; pausado_sem_estoque: boolean; ocultar_contadores: boolean };
export const EXTRAS_VAZIO: ExtrasProduto = { estoque: null, pausado_sem_estoque: false, ocultar_contadores: false };

/** Busca as colunas do SQL 07 para vários produtos. Sem o SQL 07, devolve {} (comportamento antigo). */
export async function extrasDe(client: any, ids: string[]): Promise<Record<string, ExtrasProduto>> {
  if (!ids.length) return {};
  try {
    const { data, error } = await client.from('products')
      .select('id, estoque, pausado_sem_estoque, ocultar_contadores').in('id', ids.slice(0, 500));
    if (error || !data) return {};
    return Object.fromEntries((data as any[]).map((r) => [r.id, {
      estoque: r.estoque === null || r.estoque === undefined ? null : Number(r.estoque),
      pausado_sem_estoque: r.pausado_sem_estoque === true,
      ocultar_contadores: r.ocultar_contadores === true,
    }]));
  } catch {
    return {};
  }
}

/** Linha "★ 4,8 · 12 avaliações · 30 vendas" sem zeros: o que for 0 não aparece. */
export function contadoresVisiveis(qtdAvaliacoes: number, vendas: number) {
  return { avaliacoes: qtdAvaliacoes > 0, vendas: vendas > 0, novo: qtdAvaliacoes <= 0 && vendas <= 0 };
}

// ---------- Contadores manuais (SQL 08) ----------
export const CONTADOR_MAX = 10_000_000;
export type ContadoresManuais = { ativo: boolean; vendas: number | null; avaliacoes: number | null; nota: number | null };
export const MANUAIS_VAZIO: ContadoresManuais = { ativo: false, vendas: null, avaliacoes: null, nota: null };

/** Inteiro de 0 a 10 milhões, ou vazio (null). */
export function lerContador(v: unknown): { ok: true; valor: number | null } | { ok: false; erro: string } {
  const s = v === null || v === undefined ? '' : String(v).trim().replace(/\./g, '');
  if (s === '') return { ok: true, valor: null };
  if (!/^\d+$/.test(s)) return { ok: false, erro: 'Use só números inteiros.' };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n > CONTADOR_MAX) return { ok: false, erro: 'Número grande demais.' };
  return { ok: true, valor: n };
}

/** Estrelas de 1,0 a 5,0 (aceita vírgula), uma casa decimal; vazio = null. */
export function lerNota(v: unknown): { ok: true; valor: number | null } | { ok: false; erro: string } {
  const s = v === null || v === undefined ? '' : String(v).trim().replace(',', '.');
  if (s === '') return { ok: true, valor: null };
  if (!/^\d(\.\d+)?$/.test(s)) return { ok: false, erro: 'Estrelas: use um número de 1 a 5 (ex.: 4,8).' };
  const n = Math.round(Number(s) * 10) / 10;
  if (n < 1 || n > 5) return { ok: false, erro: 'Estrelas: use um número de 1 a 5 (ex.: 4,8).' };
  return { ok: true, valor: n };
}

/** Lê o modo manual de um produto. Sem o SQL 08: desligado (comportamento automático). */
export async function manuaisDe(client: any, id: string): Promise<ContadoresManuais> {
  try {
    const { data, error } = await client.from('products')
      .select('contadores_manuais, vendas_manual, avaliacoes_manual, nota_manual').eq('id', id).maybeSingle();
    if (error || !data) return { ...MANUAIS_VAZIO };
    const num = (x: any) => (x === null || x === undefined ? null : Number(x));
    return { ativo: data.contadores_manuais === true, vendas: num(data.vendas_manual), avaliacoes: num(data.avaliacoes_manual), nota: num(data.nota_manual) };
  } catch {
    return { ...MANUAIS_VAZIO };
  }
}

/** Números que a página mostra: manuais (quando ligado e preenchido) ou automáticos. */
export function contadoresExibidos(auto: { vendas: number; avaliacoes: number; media: number }, m: ContadoresManuais) {
  if (!m.ativo) return { ...auto };
  return {
    vendas: m.vendas ?? auto.vendas,
    avaliacoes: m.avaliacoes ?? auto.avaliacoes,
    media: m.nota ?? auto.media,
  };
}
