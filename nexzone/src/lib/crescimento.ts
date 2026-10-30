// ============================================================
// Crescimento (puro, testado em testes/crescimento.test.js):
//   1. Páginas por jogo para o Google (/jogos, /jogo/[slug], /jogo/[slug]/[tipo])
//   2. Black Friday Gamer (datas, regra de desconto real, situação da campanha)
//   3. Oferta do dia (escolha automática ou manual) + texto pronto para os canais
// ============================================================
import { JOGOS } from './taxas';

// ---------- 1. Jogos ----------
export function slugJogo(nome: string): string {
  return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Tipo do anúncio → pedaço da URL e nomes usados nos títulos. */
export const TIPOS_SEO: { tipo: string; slug: string; plural: string; busca: string }[] = [
  { tipo: 'conta', slug: 'contas', plural: 'Contas', busca: 'conta' },
  { tipo: 'item', slug: 'itens-e-skins', plural: 'Itens e skins', busca: 'skin' },
  { tipo: 'moeda', slug: 'moedas', plural: 'Moedas e gold', busca: 'moedas' },
  { tipo: 'giftcard', slug: 'gift-cards', plural: 'Gift cards e keys', busca: 'gift card' },
  { tipo: 'servico', slug: 'servicos', plural: 'Serviços (boost e coach)', busca: 'boost' },
  { tipo: 'digital', slug: 'produtos-digitais', plural: 'Produtos digitais', busca: 'guia' },
];
export const tipoPorSlug = (s: string) => TIPOS_SEO.find((t) => t.slug === s) ?? null;
export const tipoPorId = (t: string | null | undefined) => TIPOS_SEO.find((x) => x.tipo === t) ?? null;

export type JogoResumo = { slug: string; nome: string; qtd: number; variantes: string[]; tipos: Record<string, number>; menorPreco: number | null };

/**
 * Agrupa os anúncios ativos por jogo (o vendedor digita o nome livre: "free fire", "Free Fire " viram o mesmo).
 * Nome exibido: o da lista oficial (JOGOS) quando bate; senão, a grafia mais usada.
 */
export function agruparJogos(linhas: { jogo?: string | null; tipo_anuncio?: string | null; preco?: number | null; preco_promo?: number | null }[]): JogoResumo[] {
  const oficial = new Map<string, string>((JOGOS as readonly string[]).map((j) => [slugJogo(j), j]));
  const m = new Map<string, { contagem: Map<string, number>; qtd: number; tipos: Record<string, number>; menor: number | null }>();
  for (const l of linhas) {
    const bruto = String(l.jogo || '').replace(/\s+/g, ' ').trim();
    if (!bruto) continue;
    const s = slugJogo(bruto);
    if (!s) continue;
    const g = m.get(s) ?? { contagem: new Map<string, number>(), qtd: 0, tipos: {} as Record<string, number>, menor: null as number | null };
    g.contagem.set(bruto, (g.contagem.get(bruto) || 0) + 1);
    g.qtd++;
    const t = String(l.tipo_anuncio || '');
    if (t) g.tipos[t] = (g.tipos[t] || 0) + 1;
    const p = precoEfetivo(l);
    if (p > 0 && (g.menor === null || p < g.menor)) g.menor = p;
    m.set(s, g);
  }
  return Array.from(m.entries()).map(([slug, g]) => {
    const maisUsado = Array.from(g.contagem.entries()).sort((a, b) => b[1] - a[1])[0][0];
    return { slug, nome: oficial.get(slug) ?? maisUsado, qtd: g.qtd, variantes: Array.from(g.contagem.keys()), tipos: g.tipos, menorPreco: g.menor };
  }).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome));
}

export const precoEfetivo = (p: { preco?: number | null; preco_promo?: number | null }) => {
  const promo = Number(p.preco_promo), cheio = Number(p.preco);
  return Number.isFinite(promo) && promo > 0 && (!Number.isFinite(cheio) || promo < cheio) ? promo : Number.isFinite(cheio) ? cheio : 0;
};

const brl = (v: number) => 'R$ ' + (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');

/** Título, descrição e textos da página do jogo (o que a pessoa digita no Google). */
export function seoDoJogo(nome: string, tipoSlug: string | null, stats: { qtd: number; menorPreco: number | null }) {
  const tipo = tipoSlug ? tipoPorSlug(tipoSlug) : null;
  const aPartir = stats.menorPreco ? ` a partir de ${brl(stats.menorPreco)}` : '';
  const titulo = tipo
    ? `${tipo.plural} de ${nome} baratos${aPartir} | Comprei Barato`
    : `${nome} barato: contas, itens e moedas${aPartir} | Comprei Barato`;
  const h1 = tipo ? `${tipo.plural} de ${nome}` : `${nome}: contas, itens, moedas e gift cards`;
  const descricao = stats.qtd > 0
    ? `${stats.qtd} ${stats.qtd === 1 ? 'anúncio' : 'anúncios'} de ${tipo ? tipo.plural.toLowerCase() + ' de ' : ''}${nome}${aPartir}. Pague com Pix, receba pelo chat do pedido e tenha o dinheiro protegido até a entrega.`
    : `Compre e venda ${tipo ? tipo.plural.toLowerCase() + ' de ' : ''}${nome} com dinheiro protegido até a entrega. Pague com Pix e receba pelo chat do pedido.`;
  const faq: { p: string; r: string }[] = [
    { p: `É seguro comprar ${tipo ? tipo.busca : 'conta ou item'} de ${nome} no Comprei Barato?`, r: 'O pagamento fica retido pela plataforma e só é liberado ao vendedor depois da entrega e do prazo de garantia. Se o produto não for entregue, você pede o reembolso pela central de ajuda do pedido.' },
    { p: `Como recebo o que comprei de ${nome}?`, r: 'Gift cards e keys são liberados automaticamente quando o Pix é confirmado. Contas, itens, moedas e serviços são entregues pelo vendedor no chat do pedido, onde a conversa fica registrada.' },
    { p: 'Quais formas de pagamento são aceitas?', r: 'Pix, com o código copia e cola ou QR Code. Em alguns anúncios também há cartão de crédito. A taxa de serviço aparece no checkout antes de pagar.' },
    { p: `Comprei uma conta de ${nome}. O que faço primeiro?`, r: 'Troque e-mail, senha e dados de recuperação assim que receber. Qualquer problema, fale com o vendedor pelo chat do pedido.' },
  ];
  return { titulo, h1, descricao, faq };
}

// ---------- 2. Black Friday Gamer ----------
export const CAMPANHA_BF = 'black-friday-2026';
export type CfgBF = { inicio: string; fim: string; descontoMin: number };
export const BF_PADRAO: CfgBF = { inicio: '2026-11-27T00:00:00-03:00', fim: '2026-11-30T23:59:59-03:00', descontoMin: 10 };

export function lerCfgBF(m: Record<string, unknown> = {}): CfgBF {
  const data = (v: unknown, d: string) => { const s = String(v ?? '').replace(/"/g, ''); return s && Number.isFinite(Date.parse(s)) ? s : d; };
  const n = Number(String(m.bf_desconto_min ?? '').replace(/"/g, '').replace(',', '.'));
  const inicio = data(m.bf_inicio, BF_PADRAO.inicio), fim = data(m.bf_fim, BF_PADRAO.fim);
  return { inicio, fim: Date.parse(fim) > Date.parse(inicio) ? fim : BF_PADRAO.fim, descontoMin: Number.isFinite(n) && n >= 5 && n <= 90 ? n : BF_PADRAO.descontoMin };
}

export type FaseBF = 'antes' | 'durante' | 'depois';
export function faseBF(cfg: CfgBF, agora = Date.now()): FaseBF {
  if (agora < Date.parse(cfg.inicio)) return 'antes';
  if (agora <= Date.parse(cfg.fim)) return 'durante';
  return 'depois';
}

/**
 * Preço de Black Friday válido? Desconto REAL: pelo menos X% abaixo do preço que o produto tem HOJE
 * (o efetivo, já com promoção). Assim ninguém sobe o preço antes para fingir desconto.
 */
export function validarPrecoBF(precoHoje: number, precoBF: number, cfg: CfgBF): { ok: true } | { ok: false; erro: string; maximo: number } {
  const maximo = Math.floor(precoHoje * (1 - cfg.descontoMin / 100) * 100) / 100;
  if (!(precoBF > 0)) return { ok: false, erro: 'Digite o preço da Black Friday.', maximo };
  if (precoBF < 1) return { ok: false, erro: 'O preço mínimo é R$ 1,00.', maximo };
  if (precoBF > maximo) return { ok: false, erro: `Para participar, o preço precisa ser no máximo ${brl(maximo)} (${cfg.descontoMin}% abaixo do preço de hoje, ${brl(precoHoje)}).`, maximo };
  return { ok: true };
}

export const emailValido = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(String(e || '').trim());

// ---------- 3. Oferta do dia ----------
export type CandidatoOferta = { id: string; preco: number; preco_promo: number | null; vendas?: number | null; nota?: number | null; estoque?: number | null };

/** Data de hoje no fuso de Brasília (YYYY-MM-DD) e o fim do dia (meia-noite de Brasília). */
export function hojeBR(agora = Date.now()) {
  const d = new Date(agora - 3 * 3600000);
  const dia = d.toISOString().slice(0, 10);
  const fim = Date.parse(`${dia}T23:59:59-03:00`);
  return { dia, fim };
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * Escolhe a oferta do dia: só com desconto real (promo < preço) e com estoque.
 * Ranking: % de desconto + vendas. Entre os 10 melhores, roda por dia (o mesmo o dia todo, outro amanhã).
 */
export function escolherOferta(candidatos: CandidatoOferta[], dia: string): CandidatoOferta | null {
  const validos = candidatos.filter((c) => {
    const promo = Number(c.preco_promo), cheio = Number(c.preco);
    const comEstoque = c.estoque === null || c.estoque === undefined || Number(c.estoque) > 0;
    return comEstoque && promo > 0 && cheio > 0 && promo < cheio;
  });
  if (!validos.length) return null;
  const nota = (c: CandidatoOferta) => (1 - Number(c.preco_promo) / Number(c.preco)) * 100 + Math.min(30, Number(c.vendas) || 0);
  const top = [...validos].sort((a, b) => nota(b) - nota(a) || a.id.localeCompare(b.id)).slice(0, 10);
  return top[hash(dia) % top.length];
}

export const descontoDe = (p: { preco: number; preco_promo: number | null }) =>
  p.preco_promo && p.preco > 0 && p.preco_promo < p.preco ? Math.round((1 - p.preco_promo / p.preco) * 100) : 0;

/** Texto pronto para o Canal do WhatsApp / Telegram (sem emoji demais, link no fim). */
export function textoOfertaCanal(o: { titulo: string; preco: number; preco_promo: number | null; link: string }): string {
  const d = descontoDe(o);
  const por = o.preco_promo && o.preco_promo < o.preco ? o.preco_promo : o.preco;
  return [
    '🔥 OFERTA DO DIA · Comprei Barato',
    '',
    o.titulo,
    d > 0 ? `De ${brl(o.preco)} por ${brl(por)} (−${d}%)` : `Por ${brl(por)}`,
    'Só hoje, até meia-noite. Pix com dinheiro protegido até a entrega.',
    '',
    `👉 ${o.link}`,
  ].join('\n');
}

// ---------- 4. Tema Black (Black November) ----------
// O site inteiro entra no clima da Black Friday: faixa com contagem em todas as páginas, cores, selo BLACK
// nos descontos e vitrines da campanha. "auto" liga sozinho 30 dias antes do início e desliga no fim.
export type ModoTema = 'auto' | 'ligado' | 'desligado';
export const ESQUENTA_DIAS = 30;
export const lerModoTema = (v: unknown): ModoTema => {
  const s = String(v ?? '').replace(/"/g, '').trim();
  return s === 'ligado' || s === 'desligado' ? s : 'auto';
};
export type FaseTema = 'esquenta' | 'black';
export function temaBlack(modo: ModoTema, cfg: CfgBF, agora = Date.now()): { ativo: boolean; fase: FaseTema | null } {
  const off = { ativo: false, fase: null };
  if (modo === 'desligado') return off;
  const f = faseBF(cfg, agora);
  if (f === 'depois') return off;
  if (f === 'durante') return { ativo: true, fase: 'black' };
  if (modo === 'ligado' || agora >= Date.parse(cfg.inicio) - ESQUENTA_DIAS * 86400000) return { ativo: true, fase: 'esquenta' };
  return off;
}

/** Só descontos reais (promo menor que o preço), do maior para o menor; mínimo em %. */
export function ordenarPorDesconto<T extends { preco: number; preco_promo: number | null }>(lista: T[], minimoPct = 1): T[] {
  return lista
    .map((p) => ({ p, d: descontoDe({ preco: Number(p.preco), preco_promo: p.preco_promo == null ? null : Number(p.preco_promo) }) }))
    .filter((x) => x.d >= minimoPct)
    .sort((a, b) => b.d - a.d)
    .map((x) => x.p);
}

/** Texto para compartilhar a Black Friday no WhatsApp (o link leva UTM para medir). */
export function textoCompartilharBF(cfg: CfgBF, site: string): string {
  const d = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `🔥 Black Friday Gamer no Comprei Barato: contas, skins, moedas e gift cards com desconto de verdade, de ${d(cfg.inicio)} a ${d(cfg.fim)}. Entra na lista pra ser avisado: ${site.replace(/\/+$/, '')}/black-friday?utm_source=whatsapp&utm_medium=compartilhar&utm_campaign=black-friday`;
}
