// Validação ÚNICA de uma oferta parceira: usada pelo formulário, pela API e pelo importador CSV.
import { acharCategoria } from '../categorias';
import { MOEDAS, PLATAFORMAS, STATUS_OFERTA, gerarSlug, normalizarPlataforma, type Moeda, type Plataforma, type StatusOferta } from './tipos';
import { validarUrlExterna, validarUrlImagem } from './url';

export const LIMITES = {
  titulo: 140, curta: 200, descricao: 5000, produtor: 120, tag: 30, tags: 10, autorizacao: 500, prioridade: 1000,
};

export type DadosOferta = {
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  category: string;
  tags: string[];
  external_platform: Plataforma;
  external_product_url: string;
  affiliate_url: string | null;
  price_reference: number | null;
  price_from: number | null;
  currency: Moeda;
  producer_name: string | null;
  authorization_note: string | null;
  featured: boolean;
  priority: number;
  status: StatusOferta;
};

export type ResultadoValidacao = { ok: true; dados: DadosOferta } | { ok: false; erros: Record<string, string> };

const texto = (v: unknown) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim() : v == null ? '' : String(v).trim());

/** Aceita "97", "97,00", "1.297,90", "1297.90". Vazio = sem preço de referência. */
export function lerPreco(v: unknown): number | null | 'invalido' {
  const s = texto(v).replace(/^(R\$|US\$|\$|€)\s*/i, '');
  if (!s) return null;
  let n: number;
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  else if (/^\d+(,\d{1,2})?$/.test(s)) n = Number(s.replace(',', '.'));
  else if (/^\d+(\.\d{1,2})?$/.test(s)) n = Number(s);
  else return 'invalido';
  if (!Number.isFinite(n) || n < 0 || n > 1000000) return 'invalido';
  return Math.round(n * 100) / 100;
}

export function validarOferta(entrada: Record<string, unknown>, opcoes: { statusPadrao?: StatusOferta } = {}): ResultadoValidacao {
  const erros: Record<string, string> = {};

  const title = texto(entrada.title);
  if (!title) erros.title = 'Informe o nome do produto.';
  else if (title.length > LIMITES.titulo) erros.title = `Nome com mais de ${LIMITES.titulo} caracteres.`;

  const cat = acharCategoria(texto(entrada.category));
  if (!cat) erros.category = 'Categoria inexistente. Use uma das categorias do site.';

  const plat = (normalizarPlataforma(entrada.external_platform) ?? texto(entrada.external_platform).toLowerCase()) as Plataforma;
  if (!PLATAFORMAS.includes(plat)) erros.external_platform = `Plataforma inválida. Use: ${PLATAFORMAS.join(', ')}.`;

  const prod = validarUrlExterna(entrada.external_product_url, PLATAFORMAS.includes(plat) ? plat : null);
  if (!prod.ok) erros.external_product_url = prod.erro;

  let affiliate_url: string | null = null;
  if (texto(entrada.affiliate_url)) {
    const af = validarUrlExterna(entrada.affiliate_url, PLATAFORMAS.includes(plat) ? plat : null);
    if (!af.ok) erros.affiliate_url = af.erro; else affiliate_url = af.url;
  }

  let image_url: string | null = null;
  if (texto(entrada.image_url)) {
    const im = validarUrlImagem(entrada.image_url);
    if (!im.ok) erros.image_url = im.erro; else image_url = im.url;
  }

  const preco = lerPreco(entrada.price_reference);
  if (preco === 'invalido') erros.price_reference = 'Preço inválido (ex.: 97,00).';
  const precoDe = lerPreco(entrada.price_from);
  if (precoDe === 'invalido') erros.price_from = 'Preço "de" inválido (ex.: 129,90).';
  else if (precoDe !== null && (preco === null || preco === 'invalido')) erros.price_from = 'Para usar o preço "de", informe também o preço atual.';
  else if (precoDe !== null && typeof preco === 'number' && precoDe <= preco) erros.price_from = 'O preço "de" precisa ser maior que o preço atual.';

  const moeda = (texto(entrada.currency) || 'BRL').toUpperCase() as Moeda;
  if (!MOEDAS.includes(moeda)) erros.currency = `Moeda inválida. Use: ${MOEDAS.join(', ')}.`;

  const description = texto(entrada.description);
  if (description.length > LIMITES.descricao) erros.description = `Descrição com mais de ${LIMITES.descricao} caracteres.`;
  const short_description = texto(entrada.short_description);
  if (short_description.length > LIMITES.curta) erros.short_description = `Resumo com mais de ${LIMITES.curta} caracteres.`;
  const producer_name = texto(entrada.producer_name);
  if (producer_name.length > LIMITES.produtor) erros.producer_name = 'Nome do produtor muito longo.';
  const authorization_note = texto(entrada.authorization_note);
  if (authorization_note.length > LIMITES.autorizacao) erros.authorization_note = 'Nota de autorização muito longa.';

  const tagsBrutas = Array.isArray(entrada.tags) ? entrada.tags.map(texto) : texto(entrada.tags).split(/[;,|]/).map((t) => t.trim());
  const tags = Array.from(new Set(tagsBrutas.filter(Boolean).map((t) => t.toLowerCase().slice(0, LIMITES.tag)))).slice(0, LIMITES.tags);

  const prioridadeN = Number(texto(entrada.priority) || 0);
  if (!Number.isInteger(prioridadeN) || prioridadeN < 0 || prioridadeN > LIMITES.prioridade) erros.priority = `Prioridade de 0 a ${LIMITES.prioridade}.`;

  const statusBruto = texto(entrada.status) as StatusOferta;
  const status = statusBruto ? statusBruto : (opcoes.statusPadrao ?? 'rascunho');
  if (!STATUS_OFERTA.includes(status)) erros.status = 'Status inválido.';

  const slugBruto = texto(entrada.slug);
  const slug = gerarSlug(slugBruto || title);

  const f = entrada.featured;
  const featured = f === true || f === 'true' || f === '1' || f === 'sim' || f === 'on';

  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      title, slug,
      description: description || null,
      short_description: short_description || null,
      image_url, category: cat!.nome, tags,
      external_platform: plat,
      external_product_url: (prod as { url: string }).url,
      affiliate_url,
      price_reference: preco as number | null,
      price_from: precoDe as number | null,
      currency: moeda,
      producer_name: producer_name || null,
      authorization_note: authorization_note || null,
      featured, priority: prioridadeN, status,
    },
  };
}

/** Link usado na saída: o de afiliado autorizado, se houver; senão o da página do produto. */
export function linkDeSaida(o: { affiliate_url: string | null; external_product_url: string; external_platform: Plataforma }) {
  const r = o.affiliate_url ? validarUrlExterna(o.affiliate_url, o.external_platform) : null;
  if (r && r.ok) return r.url;
  const p = validarUrlExterna(o.external_product_url, o.external_platform);
  return p.ok ? p.url : null;
}
