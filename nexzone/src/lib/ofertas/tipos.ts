// Ofertas parceiras: produtos digitais hospedados em plataformas externas (Hotmart, Kiwify, Monetizze...).
// Ficam numa tabela SEPARADA (partner_offers) e NUNCA passam por pedidos, saldo, comissão interna ou CB Points.

export type StatusOferta = 'rascunho' | 'ativo' | 'pausado' | 'arquivado';
export const STATUS_OFERTA: StatusOferta[] = ['rascunho', 'ativo', 'pausado', 'arquivado'];
export const ROTULO_STATUS: Record<StatusOferta, string> = {
  rascunho: 'Rascunho', ativo: 'Ativa', pausado: 'Pausada', arquivado: 'Arquivada',
};

export type Plataforma =
  | 'mercadolivre' | 'shopee' | 'amazon' | 'magalu' | 'aliexpress'
  | 'hotmart' | 'kiwify' | 'monetizze' | 'eduzz' | 'braip' | 'direto' | 'outra';
export const PLATAFORMAS: Plataforma[] = [
  'mercadolivre', 'shopee', 'amazon', 'magalu', 'aliexpress',
  'hotmart', 'kiwify', 'monetizze', 'eduzz', 'braip', 'direto', 'outra',
];
export const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  mercadolivre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu', aliexpress: 'AliExpress',
  hotmart: 'Hotmart', kiwify: 'Kiwify', monetizze: 'Monetizze', eduzz: 'Eduzz', braip: 'Braip',
  direto: 'Parceiro direto', outra: 'Outro site',
};

/** Aceita o nome como as pessoas escrevem (no CSV ou no formulário): "Mercado Livre", "ML", "Outro site"... */
const APELIDOS: Record<string, Plataforma> = {
  mercadolivre: 'mercadolivre', mercadolibre: 'mercadolivre', ml: 'mercadolivre', meli: 'mercadolivre',
  shopee: 'shopee', amazon: 'amazon', amazonbr: 'amazon', magalu: 'magalu', magazineluiza: 'magalu',
  aliexpress: 'aliexpress', ali: 'aliexpress', hotmart: 'hotmart', kiwify: 'kiwify', monetizze: 'monetizze',
  eduzz: 'eduzz', braip: 'braip', direto: 'direto', parceirodireto: 'direto',
  outra: 'outra', outro: 'outra', outrosite: 'outra', outraplataforma: 'outra',
};
export function normalizarPlataforma(v: unknown): Plataforma | null {
  const k = String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  return APELIDOS[k] ?? null;
}

export const MOEDAS = ['BRL', 'USD', 'EUR'] as const;
export type Moeda = typeof MOEDAS[number];

export type OfertaParceira = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  category: string;
  tags: string[] | null;
  external_platform: Plataforma;
  external_product_url: string;
  affiliate_url: string | null;
  price_reference: number | null;
  price_from: number | null; // preço "de" (opcional, para mostrar desconto)
  currency: Moeda;
  producer_name: string | null;
  authorization_note: string | null;
  status: StatusOferta;
  featured: boolean;
  priority: number;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Colunas públicas (vitrine): sem nota de autorização e sem URLs de destino. */
export const COLUNAS_VITRINE =
  'id, title, slug, short_description, image_url, category, external_platform, price_reference, price_from, currency, producer_name, featured, priority, created_at';
/** Página individual: + descrição e data de verificação. O link continua só no servidor (rota de saída). */
export const COLUNAS_PAGINA = COLUNAS_VITRINE + ', description, tags, last_verified_at';

export type OfertaVitrine = Pick<OfertaParceira,
  'id' | 'title' | 'slug' | 'short_description' | 'image_url' | 'category' | 'external_platform' |
  'price_reference' | 'price_from' | 'currency' | 'producer_name' | 'featured' | 'priority' | 'created_at'>;

/** Dias sem verificação a partir dos quais a oferta é sinalizada no admin. */
export const DIAS_VERIFICACAO = 30;

export function precisaVerificar(lastVerifiedAt: string | null, agora = Date.now()) {
  if (!lastVerifiedAt) return true;
  const t = new Date(lastVerifiedAt).getTime();
  return !Number.isFinite(t) || agora - t > DIAS_VERIFICACAO * 86400000;
}

export function formatarPreco(valor: number | null, moeda: string) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return null;
  const n = Number(valor);
  if (moeda === 'USD') return 'US$ ' + n.toFixed(2);
  if (moeda === 'EUR') return '€ ' + n.toFixed(2).replace('.', ',');
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}

export function gerarSlug(titulo: string) {
  return titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '') || 'oferta';
}

/** Desconto em % quando o preço "de" é maior que o preço atual; senão 0. */
export function descontoPct(preco: number | null, de: number | null) {
  if (preco === null || de === null || !(Number(de) > Number(preco)) || !(Number(preco) > 0)) return 0;
  return Math.round((1 - Number(preco) / Number(de)) * 100);
}
