// ============================================================
// FONTE ÚNICA das categorias do Comprei Barato (ordem de exibição).
// Usada no site, no painel do vendedor, na importação por IA e no admin.
// A tabela public.categories recebe a mesma lista pela migração 0007.
//
// ATENÇÃO: os produtos guardam a categoria pelo NOME (products.categoria = 'IA & Ferramentas').
// Não renomeie nem mude o slug das categorias existentes sem migrar os produtos.
// ============================================================

export type IconeCategoria =
  | 'ia' | 'templates' | 'design' | 'automacoes' | 'marketing' | 'cursos'
  | 'jogos' | 'programacao' | 'video' | 'musica' | 'fotografia' | 'negocios'
  | 'concursos' | 'idiomas' | 'saude' | 'culinaria' | 'infantil' | 'religiao'
  | 'moda' | 'artesanato';

export type Categoria = {
  nome: string;
  slug: string;
  icone: IconeCategoria;
  cor: { bg: string; fg: string };
  emoji: string; // só para a coluna legada categories.emoji
};

export const CATEGORIAS: readonly Categoria[] = [
  { nome: 'IA & Ferramentas',           slug: 'ia-ferramentas',           icone: 'ia',          cor: { bg: '#FFE3CC', fg: '#8F3A00' }, emoji: '🤖' },
  { nome: 'Templates & Planilhas',      slug: 'templates-planilhas',      icone: 'templates',   cor: { bg: '#DDF3E8', fg: '#00603F' }, emoji: '📊' },
  { nome: 'Design',                     slug: 'design',                   icone: 'design',      cor: { bg: '#E6E4FF', fg: '#3B33A8' }, emoji: '🎨' },
  { nome: 'Automações',                 slug: 'automacoes',               icone: 'automacoes',  cor: { bg: '#FFF1C7', fg: '#7A5200' }, emoji: '⚡' },
  { nome: 'Marketing Digital',          slug: 'marketing-digital',        icone: 'marketing',   cor: { bg: '#FFDCDC', fg: '#A61B1B' }, emoji: '📈' },
  { nome: 'Cursos & Ebooks',            slug: 'cursos-ebooks',            icone: 'cursos',      cor: { bg: '#D9EEFF', fg: '#0B5394' }, emoji: '📚' },
  { nome: 'Jogos & Games',              slug: 'jogos-games',              icone: 'jogos',       cor: { bg: '#E9DDFF', fg: '#5B21B6' }, emoji: '🎮' },
  { nome: 'Programação & Código',       slug: 'programacao-codigo',       icone: 'programacao', cor: { bg: '#DCEBE4', fg: '#1F4D3A' }, emoji: '💻' },
  { nome: 'Vídeo & Edição',             slug: 'video-edicao',             icone: 'video',       cor: { bg: '#FFE0EC', fg: '#9D174D' }, emoji: '🎬' },
  { nome: 'Música & Áudio',             slug: 'musica-audio',             icone: 'musica',      cor: { bg: '#E0E7FF', fg: '#3730A3' }, emoji: '🎵' },
  { nome: 'Fotografia & Presets',       slug: 'fotografia-presets',       icone: 'fotografia',  cor: { bg: '#E5ECF2', fg: '#334E68' }, emoji: '📷' },
  { nome: 'Negócios & Finanças',        slug: 'negocios-financas',        icone: 'negocios',    cor: { bg: '#E3F1D8', fg: '#3F6212' }, emoji: '💼' },
  { nome: 'Concursos & Educação',       slug: 'concursos-educacao',       icone: 'concursos',   cor: { bg: '#FDEBD3', fg: '#8A4B08' }, emoji: '🎓' },
  { nome: 'Idiomas',                    slug: 'idiomas',                  icone: 'idiomas',     cor: { bg: '#D6F2F2', fg: '#0F5E5E' }, emoji: '🗣️' },
  { nome: 'Saúde & Bem-estar',          slug: 'saude-bem-estar',          icone: 'saude',       cor: { bg: '#FFE4E1', fg: '#B42318' }, emoji: '💚' },
  { nome: 'Culinária & Receitas',       slug: 'culinaria-receitas',       icone: 'culinaria',   cor: { bg: '#FFEBD6', fg: '#9A3412' }, emoji: '🍳' },
  { nome: 'Infantil & Família',         slug: 'infantil-familia',         icone: 'infantil',    cor: { bg: '#FFF4CC', fg: '#854D0E' }, emoji: '🧸' },
  { nome: 'Religião & Espiritualidade', slug: 'religiao-espiritualidade', icone: 'religiao',    cor: { bg: '#EFE7DA', fg: '#6B4F1D' }, emoji: '🙏' },
  { nome: 'Moda & Beleza',              slug: 'moda-beleza',              icone: 'moda',        cor: { bg: '#FCE7F6', fg: '#86198F' }, emoji: '👗' },
  { nome: 'Artesanato & DIY',           slug: 'artesanato-diy',           icone: 'artesanato',  cor: { bg: '#E8F0DA', fg: '#4D5E1A' }, emoji: '✂️' },
];

export const NOMES_CATEGORIAS: string[] = CATEGORIAS.map((c) => c.nome);
export const CATEGORIA_PADRAO = CATEGORIAS[0].nome;

const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const POR_CHAVE: Record<string, Categoria> = Object.fromEntries(
  CATEGORIAS.flatMap((c) => [[c.slug, c], [semAcento(c.nome), c]]),
);

/** Acha a categoria pelo slug ('jogos-games') ou pelo nome ('Jogos & Games'). */
export function acharCategoria(v?: string | null): Categoria | null {
  if (!v) return null;
  return POR_CHAVE[v] || POR_CHAVE[semAcento(v)] || null;
}

// ---------- Regra da categoria Jogos & Games ----------
export const SLUG_JOGOS = 'jogos-games';
export const AVISO_JOGOS =
  "Permitido: guias, e-books, mods/skins/assets feitos por você, jogos do próprio desenvolvedor e keys de distribuidor autorizado com nota. " +
  "Proibido: contas compartilhadas ou 'offline', 'métodos', moedas/itens de jogo de terceiros, keys aleatórias e assinaturas revendidas — " +
  "o produto será reprovado e a conta pode ser restrita.";

/** true se a categoria (nome ou slug) é Jogos & Games. */
export const ehJogos = (v?: string | null) => acharCategoria(v)?.slug === SLUG_JOGOS;

/** Conta produtos por nome de categoria a partir de linhas { categoria }. */
export function contarPorCategoria(linhas: { categoria?: string | null }[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas ?? []) {
    const c = acharCategoria(l.categoria);
    if (c) out[c.nome] = (out[c.nome] || 0) + 1;
  }
  return out;
}
