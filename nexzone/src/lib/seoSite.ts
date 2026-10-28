// ============================================================
// SEO do SITE (marca, dados estruturados, títulos automáticos). Funções puras.
// Complementa src/lib/seo.ts (nota do anúncio no painel do vendedor).
// Referência: Google Search Central — nomes de site (WebSite.name/alternateName na página inicial),
// dados estruturados de Produto/Oferta e trilha de navegação (BreadcrumbList).
// ============================================================
import { cortar, metaDescription, stripEmoji, SITE_URL_FALLBACK } from './seo';
import { CATEGORIAS, type Categoria } from './categorias';

export const MARCA = 'Comprei Barato';
export const MARCA_ALTERNATIVAS = ['CompreiBarato', 'Comprei Barato Marketplace', 'compreibarato.com.br'];
export const SLOGAN = 'Marketplace de produtos digitais';
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '');
export const OG_PADRAO = '/og-padrao.png';

/** Dados estruturados embutidos com segurança (sem fechar a tag <script>). */
export const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

/** Só endereços https de perfis (Instagram, YouTube, TikTok, Facebook, LinkedIn, X...). */
export function limparPerfis(lista: unknown): string[] {
  const arr = Array.isArray(lista) ? lista : typeof lista === 'string' ? lista.split(/[\s,]+/) : [];
  const out: string[] = [];
  for (const v of arr) {
    const s = String(v || '').trim();
    if (!s) continue;
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
      u.protocol = 'https:';
      const t = u.toString().replace(/\/$/, '');
      if (!out.includes(t) && t.length <= 200) out.push(t);
    } catch { /* ignora */ }
    if (out.length >= 10) break;
  }
  return out;
}

/** WebSite (nome do site no Google + caixa de busca) — vai SÓ na página inicial. */
export function dadosWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    name: MARCA,
    alternateName: MARCA_ALTERNATIVAS,
    url: `${SITE}/`,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${SITE}/#organizacao` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/produtos?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Organization (logo e perfis oficiais da marca). */
export function dadosOrganizacao(perfis: string[] = [], email?: string | null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE}/#organizacao`,
    name: MARCA,
    alternateName: MARCA_ALTERNATIVAS,
    url: `${SITE}/`,
    logo: { '@type': 'ImageObject', url: `${SITE}/logo.png`, width: 1774, height: 887 },
    description: 'Marketplace brasileiro de produtos digitais: cursos, ebooks, planilhas, templates, prompts, automações e ferramentas, com pagamento via Pix ou cartão e entrega imediata.',
    ...(perfis.length ? { sameAs: perfis } : {}),
    ...(email ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email, availableLanguage: ['Portuguese'] } } : {}),
  };
}

export type Migalha = { nome: string; url: string };
export function dadosTrilha(itens: Migalha[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.nome, item: m.url.startsWith('http') ? m.url : `${SITE}${m.url}` })),
  };
}

/**
 * Título automático do anúncio no Google: "Título do produto | Categoria | Comprei Barato"
 * — tira emoji/CAIXA ALTA exagerada e corta sem quebrar palavra. Até ~65 caracteres antes da marca.
 */
export function tituloDoProduto(titulo: string, categoria?: string | null): string {
  let t = stripEmoji(String(titulo || '')).replace(/[!?]{2,}/g, '!').replace(/\s+/g, ' ').trim();
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letras.length >= 8 && letras.replace(/[^A-ZÀ-Þ]/g, '').length / letras.length > 0.7) {
    const menores = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'a', 'o', 'as', 'os', 'no', 'na', 'por']);
    t = t.toLowerCase().split(' ').map((w, i) => (i > 0 && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }
  if (!t) t = 'Produto digital';
  const base = cortar(t, 62, false);
  const cat = String(categoria || '').trim();
  const comCat = cat && base.length + cat.length + 3 <= 62 ? `${base} | ${cat}` : base;
  return `${comCat} | ${MARCA}`;
}

/** Descrição automática: usa a do vendedor; se for curta, completa com tipo, entrega e garantia. */
export function descricaoDoProduto(descricao: string | null | undefined, titulo: string, preco?: number | null) {
  const d = metaDescription(descricao, titulo);
  if (d.length >= 110 || !preco) return d;
  const v = Number(preco).toFixed(2).replace('.', ',');
  return cortar(`${d.replace(/[.…\s]+$/, '')}. Por R$ ${v}, com Pix ou cartão e acesso imediato.`, 155);
}

// Palavras de busca por categoria (texto visível + meta). Mantidas curtas e reais (sem promessas).
const BUSCAS: Record<string, string[]> = {
  'ia-ferramentas': ['prompts para ChatGPT', 'ferramentas de IA', 'GPTs prontos', 'agentes de IA'],
  'templates-planilhas': ['planilhas Excel', 'planilhas Google Sheets', 'templates Notion', 'modelos prontos'],
  'design': ['artes para Canva', 'mockups', 'packs de design', 'templates para Instagram'],
  'automacoes': ['automações para WhatsApp', 'fluxos n8n e Make', 'scripts prontos', 'bots'],
  'marketing-digital': ['criativos para anúncios', 'roteiros de vendas', 'estratégias de tráfego', 'copys prontas'],
  'cursos-ebooks': ['cursos online', 'ebooks em PDF', 'apostilas', 'guias completos'],
  'jogos-games': ['guias de jogos', 'contas e itens digitais', 'mods e recursos', 'tutoriais gamer'],
  'programacao-codigo': ['códigos-fonte', 'templates de sites', 'sistemas prontos', 'cursos de programação'],
  'video-edicao': ['presets de vídeo', 'transições', 'packs para Premiere e CapCut', 'efeitos'],
  'musica-audio': ['beats', 'samples', 'efeitos sonoros', 'cursos de música'],
  'fotografia-presets': ['presets Lightroom', 'filtros', 'cursos de fotografia', 'ações para Photoshop'],
  'negocios-financas': ['planilhas financeiras', 'modelos de contrato', 'planos de negócio', 'controle financeiro'],
  'concursos-educacao': ['materiais para concursos', 'apostilas', 'resumos', 'questões comentadas'],
  'idiomas': ['cursos de inglês', 'apostilas de espanhol', 'vocabulário', 'conversação'],
  'saude-bem-estar': ['planos de treino', 'cardápios', 'guias de bem-estar', 'meditação'],
  'culinaria-receitas': ['ebooks de receitas', 'receitas fit', 'confeitaria', 'marmitas'],
};

export function buscasDaCategoria(c: Categoria): string[] {
  return BUSCAS[c.slug] || [`${c.nome.toLowerCase()} digitais`, 'produtos digitais', 'material em PDF', 'acesso imediato'];
}

export function metaDaCategoria(c: Categoria) {
  const b = buscasDaCategoria(c);
  return {
    titulo: `${c.nome}: ${b.slice(0, 2).join(' e ')} | ${MARCA}`.replace(/\s+/g, ' '),
    descricao: cortar(`Compre ${b.slice(0, 3).join(', ')} e outros produtos digitais de ${c.nome}. Pagamento via Pix ou cartão, acesso imediato e garantia. ${MARCA}.`, 155),
  };
}

/** Texto visível no fim da página da categoria (conteúdo próprio para o Google entender a página). */
export function textoDaCategoria(c: Categoria): { titulo: string; paragrafos: string[] } {
  const b = buscasDaCategoria(c);
  return {
    titulo: `${c.nome} no ${MARCA}`,
    paragrafos: [
      `Aqui você encontra ${b.slice(0, -1).join(', ')} e ${b[b.length - 1]} criados por produtores brasileiros. Cada produto passa por aprovação antes de entrar na vitrine.`,
      `A compra é feita no próprio ${MARCA}, com Pix ou cartão. O acesso é liberado assim que o pagamento é confirmado, e você encontra tudo em Minhas compras. Produtos com garantia permitem pedir reembolso dentro do prazo informado no anúncio.`,
    ],
  };
}

/** Lista de páginas públicas fixas para o mapa do site. */
export const PAGINAS_FIXAS: { caminho: string; prioridade: number; freq: 'daily' | 'weekly' | 'monthly' }[] = [
  { caminho: '/', prioridade: 1, freq: 'daily' },
  { caminho: '/produtos', prioridade: 0.9, freq: 'daily' },
  { caminho: '/seja-vendedor', prioridade: 0.6, freq: 'monthly' },
  { caminho: '/produtores', prioridade: 0.6, freq: 'monthly' },
  { caminho: '/como-funciona', prioridade: 0.5, freq: 'monthly' },
  { caminho: '/ajuda', prioridade: 0.4, freq: 'monthly' },
  { caminho: '/termos', prioridade: 0.2, freq: 'monthly' },
  { caminho: '/privacidade', prioridade: 0.2, freq: 'monthly' },
];

export const categoriasDoSite = () => CATEGORIAS;

/** Áreas privadas que nunca devem ser indexadas. */
export const BLOQUEADOS = ['/admin', '/vender', '/api', '/checkout', '/pedido', '/minhas-compras', '/conta', '/curso', '/notificacoes', '/favoritos', '/produtores/obrigado', '/login', '/esqueci-senha', '/redefinir-senha', '/auth', '/conta-suspensa', '/suporte/'];
