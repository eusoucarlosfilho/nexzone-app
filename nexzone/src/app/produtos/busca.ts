// Regras da busca do catálogo (puras: sem banco, testáveis).
// - Termo quebrado em palavras "limpas" (letras, números e hífen): nenhuma vírgula, parêntese
//   ou aspas chega ao filtro do PostgREST, então o termo do visitante não altera a consulta.
// - Cada palavra precisa aparecer no título OU na descrição (colunas já públicas da vitrine).
// - Se o termo lembrar o nome de uma categoria ("planilha", "design", "curso"), os produtos
//   dessa categoria também entram.
// - Preço = preço efetivo (promoção quando existe), o mesmo que o card mostra.
import { CATEGORIAS } from '@/lib/categorias';

export const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export type Ordem = 'relevancia' | 'vendas' | 'novos' | 'menor' | 'maior';
export const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: 'relevancia', rotulo: 'Relevância' },
  { id: 'vendas', rotulo: 'Mais vendidos' },
  { id: 'novos', rotulo: 'Mais recentes' },
  { id: 'menor', rotulo: 'Menor preço' },
  { id: 'maior', rotulo: 'Maior preço' },
];
export function ordemValida(v: string | undefined | null): Ordem {
  return (ORDENS.find((o) => o.id === v)?.id) ?? 'relevancia';
}

// Palavras curtas que não ajudam a achar o produto ("curso DE excel").
const VAZIAS = new Set(['a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'para', 'pra', 'com', 'por', 'sem']);

/** Até 5 palavras do termo, só com letras, números e hífen (o resto vira separador). */
export function palavrasDoTermo(q: string | null | undefined): string[] {
  const s = String(q ?? '').normalize('NFC').toLowerCase().slice(0, 100);
  const todas: string[] = [];
  for (const w of s.split(/[^\p{L}\p{N}-]+/u)) {
    const t = w.replace(/^-+|-+$/g, '');
    if (t && !todas.includes(t)) todas.push(t);
  }
  const uteis = todas.filter((w) => !VAZIAS.has(w));
  return (uteis.length ? uteis : todas).slice(0, 5);
}

/**
 * Categorias cujo nome lembra o termo (ex.: "planilha" → Templates & Planilhas).
 * Só para termos de uma palavra; com várias palavras, apenas o nome exato da categoria conta
 * (senão "curso de excel" traria todos os cursos).
 */
export function categoriasDoTermo(q: string | null | undefined): string[] {
  const t = semAcento(String(q ?? ''));
  if (t.length < 4) return [];
  const umaPalavra = !/\s/.test(t);
  return CATEGORIAS.filter((c) => {
    const nome = semAcento(c.nome);
    if (nome === t || c.slug === t) return true;
    if (!umaPalavra) return false;
    return nome.split(/[^a-z0-9]+/).some((p) => p.length >= 4 && (p.startsWith(t) || t.startsWith(p)));
  }).map((c) => c.nome);
}

/** Nó do filtro de busca (sintaxe de árvore lógica do PostgREST) ou null sem termo. */
export function noBusca(palavras: string[], categorias: string[]): string | null {
  if (!palavras.length) return null;
  const porPalavra = palavras.map((w) => `or(titulo.ilike.*${w}*,descricao.ilike.*${w}*)`);
  const todas = porPalavra.length === 1 ? porPalavra[0] : `and(${porPalavra.join(',')})`;
  if (!categorias.length) return todas;
  return `or(${todas},categoria.in.(${categorias.map((c) => `"${c.replace(/["\\]/g, '')}"`).join(',')}))`;
}

/** Faixa de preço pelo preço efetivo. Valores fora do normal são ignorados; mín > máx é invertido. */
export function faixaPreco(minRaw: unknown, maxRaw: unknown): { min: number; max: number } {
  const n = (v: unknown) => {
    const x = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(x) && x > 0 ? Math.min(Math.round(x * 100) / 100, 1_000_000) : 0;
  };
  let min = n(minRaw), max = n(maxRaw);
  if (min && max && min > max) [min, max] = [max, min];
  return { min, max };
}

export function noPreco(min: number, max: number): string | null {
  if (!min && !max) return null;
  const promo = ['preco_promo.not.is.null'], cheio = ['preco_promo.is.null'];
  if (min) { promo.push(`preco_promo.gte.${min}`); cheio.push(`preco.gte.${min}`); }
  if (max) { promo.push(`preco_promo.lte.${max}`); cheio.push(`preco.lte.${max}`); }
  return `or(and(${promo.join(',')}),and(${cheio.join(',')}))`;
}

type Leve = { id: string; titulo: string; categoria: string | null; preco: number; preco_promo: number | null; vendas: number; nota: number; created_at: string };

const efetivo = (p: Leve) => Number(p.preco_promo ?? p.preco) || 0;

/** Pontuação de relevância: frase no título > palavras no título > categoria/descrição; desempate por vendas e nota. */
export function pontuar(p: Leve, termo: string, palavras: string[], categorias: string[]): number {
  const t = semAcento(p.titulo || '');
  const frase = semAcento(termo);
  let s = 0;
  if (frase && t.includes(frase)) s += 100;
  if (frase && t.startsWith(frase)) s += 20;
  for (const w of palavras) if (t.includes(semAcento(w))) s += 12;
  if (p.categoria && categorias.includes(p.categoria)) s += 6;
  s += Math.log10(1 + (Number(p.vendas) || 0)) * 3 + (Number(p.nota) || 0) * 0.6;
  return s;
}

export function ordenarEmMemoria(lista: Leve[], ordem: Ordem, termo: string, palavras: string[], categorias: string[]): Leve[] {
  const l = [...lista];
  const desempate = (a: Leve, b: Leve) => (Number(b.vendas) || 0) - (Number(a.vendas) || 0) || a.id.localeCompare(b.id);
  if (ordem === 'menor') return l.sort((a, b) => efetivo(a) - efetivo(b) || desempate(a, b));
  if (ordem === 'maior') return l.sort((a, b) => efetivo(b) - efetivo(a) || desempate(a, b));
  const sc = new Map(l.map((p) => [p.id, pontuar(p, termo, palavras, categorias)]));
  return l.sort((a, b) => (sc.get(b.id)! - sc.get(a.id)!) || desempate(a, b));
}

export type { Leve };
