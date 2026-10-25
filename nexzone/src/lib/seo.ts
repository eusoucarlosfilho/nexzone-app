/**
 * SEO do anúncio — pontuação determinística (0–100).
 * Função pura: roda no client (painel do vendedor, ao vivo) e no servidor.
 * NÃO importe nada server-only aqui.
 */

export type SeoInput = {
  titulo?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  preco?: number | string | null;
  precoPromo?: number | string | null;
  temCapa?: boolean;
  tipoEntrega?: string | null;
  garantiaDias?: number | string | null;
};

export type SeoNivel = 'Fraco' | 'Regular' | 'Bom' | 'Excelente';

export type SeoCheck = {
  id: string;
  label: string;
  ok: boolean;
  peso: number;
  /** pontos efetivamente obtidos (permite crédito parcial) */
  pontos: number;
  dica: string;
};

export type SeoResult = { score: number; nivel: SeoNivel; checks: SeoCheck[] };

export const SITE_URL_FALLBACK = 'https://www.compreibarato.com.br';

// ---------------- utilitários ----------------

// Emojis e pictogramas (inclui seletores de variação, ZWJ, bandeiras e tons de pele)
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

export function stripEmoji(s: string): string {
  return (s || '').replace(EMOJI_RE, '');
}

export function hasEmoji(s: string): boolean {
  EMOJI_RE.lastIndex = 0;
  const r = EMOJI_RE.test(s || '');
  EMOJI_RE.lastIndex = 0;
  return r;
}

/** minúsculas, sem acentos */
export function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugify(s: string): string {
  return norm(stripEmoji(s || ''))
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Corta no limite sem quebrar palavra; acrescenta reticências se cortou. */
export function cortar(s: string, max: number, reticencias = true): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  const lim = reticencias ? max - 1 : max;
  let cut = t.slice(0, lim);
  const sp = cut.lastIndexOf(' ');
  if (sp > lim * 0.6) cut = cut.slice(0, sp);
  cut = cut.replace(/[\s,;:.\-–—|•]+$/g, '');
  return reticencias ? cut + '…' : cut;
}

/** Meta description limpa (≤155 caracteres) a partir da descrição; usa o título se não houver descrição. */
export function metaDescription(descricao?: string | null, titulo?: string | null): string {
  let d = stripEmoji(String(descricao || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_#`>]+/g, ' ')
    .replace(/^\s*(?:[-•*–]|\d+[.)])\s+/gm, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .replace(/([:;!?])\./g, '$1')
    .trim();
  if (d.length < 40) {
    const t = stripEmoji(String(titulo || '')).replace(/\s+/g, ' ').trim();
    const base = t ? `${t}: produto digital com entrega imediata e garantia no Comprei Barato.` : 'Produto digital com entrega imediata e garantia no Comprei Barato.';
    d = d ? `${d.replace(/[.\s]+$/, '')}. ${base}` : base;
  }
  return cortar(d, 155);
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return NaN;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return isFinite(n) ? n : NaN;
};

// Tipos de produto que deixam claro "o que é" já no título (sem acento)
const TIPOS = [
  'pack', 'kit', 'combo', 'bundle', 'colecao', 'biblioteca', 'planilha', 'planilhas', 'template', 'templates', 'modelo', 'modelos',
  'curso', 'cursos', 'aula', 'aulas', 'videoaula', 'videoaulas', 'treinamento', 'masterclass', 'mentoria', 'workshop', 'metodo', 'desafio',
  'ebook', 'e-book', 'ebooks', 'livro', 'apostila', 'guia', 'manual', 'workbook', 'checklist', 'planner', 'agenda', 'calendario',
  'prompt', 'prompts', 'gpt', 'gpts', 'chatbot', 'bot', 'automacao', 'automacoes', 'workflow', 'fluxo', 'script', 'scripts', 'roteiro', 'roteiros',
  'plugin', 'extensao', 'software', 'app', 'aplicativo', 'sistema', 'ferramenta', 'dashboard', 'painel',
  'preset', 'presets', 'mockup', 'mockups', 'fonte', 'fontes', 'icones', 'arte', 'artes', 'criativos', 'carrossel', 'carrosseis', 'posts', 'stories',
  'feed', 'banner', 'banners', 'logo', 'logos', 'flyer', 'flyers', 'vetores', 'pdf', 'canva', 'notion', 'excel', 'licenca', 'assinatura', 'acesso',
];

const STOP = new Set([
  'para', 'pra', 'com', 'sem', 'por', 'que', 'uma', 'umas', 'uns', 'dos', 'das', 'nos', 'nas', 'pelo', 'pela', 'mais', 'menos', 'seu', 'sua',
  'seus', 'suas', 'meu', 'minha', 'voce', 'como', 'todo', 'toda', 'todos', 'todas', 'novo', 'nova', 'completo', 'completa', 'melhor',
  'super', 'mega', 'ultra', 'premium', 'oficial', 'atualizado', 'atualizada', 'promocao', 'gratis', 'bonus', 'and', 'the', 'for', 'with',
]);

/** Palavras relevantes do título (sem acento, ≥4 letras, fora de stopwords e números). */
export function palavrasDoTitulo(titulo: string): string[] {
  const ws = norm(stripEmoji(titulo || '')).split(/[^a-z0-9-]+/).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
  return Array.from(new Set(ws));
}

const RECEBE_RE = /\b(receb\w*|voce vai ter|vai receber|inclu\w*|contem|conteudo|acesso|download|baix\w*|pdf|formato|arquivo\w*|link|canva|excel|xlsx|docx|google (sheets|docs|planilhas)|notion|mp4|video\w*|aula\w*|modulo\w*|entrega\w*|editave\w*|pagina\w*|licenca|chave)\b/;

// ---------------- pontuação ----------------

export function calcularSeo(i: SeoInput): SeoResult {
  const titulo = String(i.titulo || '').trim();
  const desc = String(i.descricao || '').trim();
  const tN = norm(titulo);
  const dN = norm(desc);
  const preco = num(i.preco);
  const promo = num(i.precoPromo);
  const garantia = num(i.garantiaDias);
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, peso: number, ok: boolean, dica: string, pontos?: number) =>
    checks.push({ id, label, peso, ok, dica: ok ? '' : dica, pontos: ok ? peso : Math.max(0, Math.min(peso, pontos ?? 0)) });

  // 1. Tamanho do título
  const tl = titulo.length;
  add('titulo_tamanho', 'Título entre 30 e 70 caracteres', 12, tl >= 30 && tl <= 70,
    tl === 0 ? 'Escreva um título: ele é o principal fator para o produto aparecer nas buscas.'
      : tl < 30 ? `Seu título tem ${tl} caracteres. Detalhe mais (tipo do produto + benefício + público), mirando 30 a 70.`
        : `Seu título tem ${tl} caracteres. Acima de 70 o Google corta; deixe o essencial no começo e enxugue.`,
    tl >= 20 && tl <= 90 ? 6 : 0);

  // 2. Tipo de produto claro
  const temTipo = TIPOS.some((k) => new RegExp(`(^|[^a-z0-9])${k.replace('-', '\\-')}([^a-z0-9]|$)`).test(tN));
  add('titulo_tipo', 'Título diz o tipo de produto', 10, temTipo,
    'Diga o que é o produto já no título (ex.: "Pack", "Planilha", "Template", "Curso", "Ebook", "Guia", "Kit", "Prompts", "Automação").');

  // 3. Sem CAIXA ALTA
  const letras = titulo.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maius = letras.replace(/[^A-ZÀ-Þ]/g, '').length;
  const caps = letras.length >= 8 && maius / letras.length > 0.7;
  add('titulo_caps', 'Título sem CAIXA ALTA', 4, titulo.length > 0 && !caps,
    titulo.length === 0 ? 'Preencha o título.' : 'Evite escrever tudo em maiúsculas: parece spam e reduz cliques. Use só a inicial das palavras principais.');

  // 4. Sem emoji / pontuação exagerada
  const sujo = hasEmoji(titulo) || /[!?]{2,}|\.{4,}|[*#~^|<>$]{1,}|(!.*){3,}/.test(titulo);
  add('titulo_limpo', 'Título sem emoji ou pontuação exagerada', 4, titulo.length > 0 && !sujo,
    titulo.length === 0 ? 'Preencha o título.' : 'Remova emojis, "!!!", "$$$" e símbolos do título: buscadores e compradores confiam mais em títulos limpos.');

  // 5. Tamanho da descrição (crédito parcial ≥120)
  const dl = desc.length;
  add('desc_tamanho', 'Descrição com 300+ caracteres', 14, dl >= 300,
    dl === 0 ? 'Escreva uma descrição de pelo menos 300 caracteres explicando o que é, para quem é e o que a pessoa recebe.'
      : `Sua descrição tem ${dl} caracteres. Chegue a 300+ explicando para quem é, o que resolve e o que vem dentro.`,
    dl >= 120 ? 7 : 0);

  // 6. Lista de benefícios / itens
  const linhas = desc.split(/\n/).filter((l) => l.trim()).length;
  const temLista = /(^|\n)\s*(?:[-•*–\u2713\u2714]|\d+[.)])\s+\S/.test(desc) || linhas >= 4;
  add('desc_lista', 'Descrição com lista de benefícios', 8, temLista,
    'Organize o que vem no produto em tópicos (uma linha por item, começando com "•" ou "-"). Fica fácil de escanear.');

  // 7. O que recebe / formato
  add('desc_entrega', 'Explica o que recebe e o formato', 8, RECEBE_RE.test(dN),
    'Diga o que o comprador recebe e em qual formato (PDF, link do Canva, planilha Excel/Google, vídeo-aulas, acesso...).');

  // 8. Palavra-chave do título repetida na descrição
  const kws = palavrasDoTitulo(titulo);
  const presentes = kws.filter((w) => dN.includes(w));
  const precisa = Math.min(2, kws.length);
  const kwOk = kws.length > 0 && presentes.length >= precisa;
  add('desc_keyword', 'Descrição repete a palavra-chave do título', 8, kwOk,
    kws.length === 0 ? 'Defina um título com a palavra-chave principal e repita essa palavra na descrição.'
      : `Use na descrição as palavras-chave do título (ex.: "${kws.slice(0, 3).join('", "')}"), de forma natural.`,
    presentes.length > 0 ? 4 : 0);

  // 9. Capa
  add('capa', 'Imagem de capa', 10, !!i.temCapa,
    'Envie uma capa (1200×900px). Anúncios com imagem própria recebem muito mais cliques e aparecem melhor no Google e nas redes.');

  // 10. Preço
  const precoOk = isFinite(preco) && preco > 0;
  add('preco', 'Preço definido', 6, precoOk, 'Informe o preço do produto.');

  // 11. Promoção ≥10%
  const descontoPct = precoOk && isFinite(promo) && promo > 0 && promo < preco ? (1 - promo / preco) * 100 : 0;
  add('promo', 'Preço promocional (10%+ de desconto)', 6, descontoPct >= 10,
    !precoOk ? 'Defina o preço e um preço promocional pelo menos 10% menor.'
      : isFinite(promo) && promo >= preco ? 'O preço promocional precisa ser menor que o preço cheio.'
        : descontoPct > 0 ? `O desconto atual é de ${Math.round(descontoPct)}%. Com 10% ou mais o selo de desconto chama mais atenção.`
          : 'Adicione um preço promocional pelo menos 10% menor que o preço cheio: o selo de desconto aumenta a conversão.',
    descontoPct > 0 ? 3 : 0);

  // 12. Garantia
  add('garantia', 'Garantia de 7+ dias', 5, isFinite(garantia) && garantia >= 7,
    'Ofereça pelo menos 7 dias de garantia: reduz o medo de comprar e é o mínimo do Código de Defesa do Consumidor para compras online.');

  // 13. Categoria
  add('categoria', 'Categoria escolhida', 5, !!String(i.categoria || '').trim(), 'Escolha a categoria que melhor descreve o produto.');

  const score = Math.round(Math.max(0, Math.min(100, checks.reduce((s, c) => s + c.pontos, 0))));
  const nivel: SeoNivel = score >= 85 ? 'Excelente' : score >= 70 ? 'Bom' : score >= 40 ? 'Regular' : 'Fraco';
  return { score, nivel, checks };
}

/** Cor do nível (contraste acessível sobre branco). */
export function corDoScore(score: number): { fg: string; bg: string } {
  if (score < 40) return { fg: '#C62828', bg: '#FDEBEB' };
  if (score < 70) return { fg: '#9A5B00', bg: '#FFF1C7' };
  return { fg: '#00875A', bg: '#E3F6EE' };
}
