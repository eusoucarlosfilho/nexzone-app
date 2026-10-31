// ============================================================
// Vitrine OFERTAS DO DIA (home). PURO: testado em testes/ofertas-dia.test.js.
// Curadoria manual do admin (settings.ofertas_dia_vitrine, JSON). Nada é escolhido sozinho nesta versão.
//  • cada item tem início e fim opcionais; fora da janela, não aparece;
//  • o contador só aparece quando o item tem FIM definido (o mesmo horário para todo visitante);
//  • produto pausado, excluído ou reprovado sai da vitrine na hora (o servidor só busca anúncios ativos).
// ============================================================
export type ItemOferta = { id: string; inicio: string | null; fim: string | null };
export type CfgOfertasDia = { ativo: boolean; titulo: string; subtitulo: string; max: number; itens: ItemOferta[] };

export const CHAVE_OFERTAS_DIA = 'ofertas_dia_vitrine';
export const OFERTAS_DIA_PADRAO: CfgOfertasDia = { ativo: false, titulo: 'OFERTAS DO DIA', subtitulo: 'Selecionadas pela equipe do Comprei Barato. Preço e prazo reais de cada anúncio.', max: 5, itens: [] };
export const MAX_ITENS = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const data = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const texto = (v: unknown, max: number, d: string) => (typeof v === 'string' && v.trim() ? v.replace(/[<>]/g, '').trim().slice(0, max) : d);

/** Valida o que vem do banco ou do formulário. Itens repetidos ou inválidos são descartados. */
export function normalizarOfertasDia(v: any): CfgOfertasDia {
  const o = v && typeof v === 'object' ? v : (() => { try { return JSON.parse(String(v || '')); } catch { return {}; } })() || {};
  const vistos = new Set<string>();
  const itens: ItemOferta[] = [];
  for (const i of Array.isArray(o.itens) ? o.itens : []) {
    const id = String(i?.id || '').toLowerCase();
    if (!UUID.test(id) || vistos.has(id)) continue;
    vistos.add(id);
    let inicio = data(i.inicio), fim = data(i.fim);
    if (inicio && fim && Date.parse(fim) <= Date.parse(inicio)) fim = null; // fim antes do início: ignora o fim
    itens.push({ id, inicio, fim });
    if (itens.length >= MAX_ITENS) break;
  }
  const max = Math.round(Number(o.max));
  return {
    ativo: o.ativo === true,
    titulo: texto(o.titulo, 40, OFERTAS_DIA_PADRAO.titulo),
    subtitulo: texto(o.subtitulo, 140, OFERTAS_DIA_PADRAO.subtitulo),
    max: Number.isFinite(max) ? Math.min(8, Math.max(3, max)) : 5,
    itens,
  };
}

/** Itens no ar agora, na ordem do admin, até o máximo configurado. */
export function itensNoAr(c: CfgOfertasDia, agora = Date.now()): ItemOferta[] {
  if (!c.ativo) return [];
  return c.itens.filter((i) => (!i.inicio || Date.parse(i.inicio) <= agora) && (!i.fim || Date.parse(i.fim) > agora)).slice(0, c.max);
}

/** Contador: só com fim definido, ainda no futuro e a no máximo 7 dias (prazo longo não é "oferta do dia"). */
export function mostrarContador(fim: string | null, agora = Date.now()): number | null {
  if (!fim) return null;
  const t = Date.parse(fim);
  return Number.isFinite(t) && t > agora && t - agora <= 7 * 86400000 ? t : null;
}

/** Desconto real só quando o anúncio tem preço promocional menor que o preço cheio. */
export function descontoReal(preco: number, promo: number | null | undefined): number | null {
  const a = Number(preco), b = Number(promo);
  if (!(a > 0) || !(b > 0) || b >= a) return null;
  return Math.round((1 - b / a) * 100);
}

/** Desempenho de cada item (cliques de vitrine, compras ligadas pela sessão em até 24 h depois do clique). */
export function desempenhoOfertas(
  itens: string[],
  eventos: { session_id: string; nome: string; props: any; created_at: string }[],
  pedidos: { status: string; total: number; created_at: string; product_id: string | null; origem: any }[],
) {
  const vistas = new Set(eventos.filter((e) => e.nome === 'oferta_dia_vista').map((e) => e.session_id)).size;
  const cliques = new Map<string, Map<string, number>>(); // produto → sessão → 1º clique (ms)
  for (const e of eventos) {
    if (e.nome !== 'oferta_dia_clique') continue;
    const id = String(e.props?.produto || '');
    if (!cliques.has(id)) cliques.set(id, new Map());
    const m = cliques.get(id)!; const t = Date.parse(e.created_at);
    if (!m.has(e.session_id) || t < m.get(e.session_id)!) m.set(e.session_id, t);
  }
  const linhas = itens.map((id) => {
    const m = cliques.get(id) || new Map<string, number>();
    let compras = 0, receita = 0;
    for (const o of pedidos) {
      if (o.product_id !== id || !['pago', 'entregue'].includes(o.status)) continue;
      const sid = o.origem?.sid; const t0 = sid ? m.get(sid) : undefined; const t = Date.parse(o.created_at);
      if (t0 !== undefined && t >= t0 && t - t0 <= 86400000) { compras++; receita += Number(o.total) || 0; }
    }
    const sessoesClique = m.size;
    return { id, cliques: sessoesClique, compras, receita: Math.round(receita * 100) / 100, conversao: sessoesClique ? Math.round((compras / sessoesClique) * 1000) / 10 : null };
  });
  return { vistas, linhas, ctr: vistas ? Math.round((linhas.reduce((s, l) => s + l.cliques, 0) / vistas) * 1000) / 10 : null };
}
