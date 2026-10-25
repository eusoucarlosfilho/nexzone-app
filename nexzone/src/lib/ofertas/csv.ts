// Importador CSV de ofertas parceiras: leitura, mapeamento de colunas e validação linha a linha.
// Funções puras (rodam no navegador para a pré-visualização e no servidor na confirmação).
import { validarOferta, type DadosOferta } from './validar';
import { chaveDuplicidade } from './url';

export const MAX_BYTES_CSV = 1024 * 1024; // 1 MB
export const MAX_LINHAS_CSV = 500;

/** Cabeçalhos aceitos (pt-BR do modelo) → campo interno. */
export const COLUNAS_CSV: Record<string, keyof DadosOferta> = {
  nome: 'title',
  categoria: 'category',
  plataforma: 'external_platform',
  descricao: 'description',
  resumo: 'short_description',
  url_imagem: 'image_url',
  url_produto: 'external_product_url',
  url_afiliado: 'affiliate_url',
  preco_referencia: 'price_reference',
  preco: 'price_reference',
  preco_de: 'price_from',
  url_compra: 'external_product_url',
  moeda: 'currency',
  produtor: 'producer_name',
  tags: 'tags',
  autorizacao: 'authorization_note',
  prioridade: 'priority',
  destaque: 'featured',
};
export const OBRIGATORIAS = ['nome', 'categoria', 'plataforma'];
/** O link de compra pode vir como url_compra (modelo novo) ou url_produto (modelo antigo). */
export const COLUNAS_LINK = ['url_compra', 'url_produto'];

/** Parser CSV (RFC 4180): aspas, aspas duplicadas, quebras de linha dentro de aspas; separador , ou ; */
export function lerCsv(texto: string): string[][] {
  const s = texto.replace(/^﻿/, '');
  const primeira = s.split(/\r?\n/, 1)[0] || '';
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === '"') { if (s[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
  return linhas;
}

export type LinhaPrevia = {
  linha: number; // número da linha no arquivo (cabeçalho = 1)
  ok: boolean;
  dados?: DadosOferta;
  erros: string[];
  duplicada?: 'no_arquivo' | 'ja_cadastrada';
};
export type Previa = { erroGeral?: string; linhas: LinhaPrevia[]; validas: number; comErro: number; duplicadas: number };

/**
 * Valida o CSV inteiro. `existentes` = slugs e chaves de URL já cadastrados (quando disponíveis).
 * Linhas válidas entram SEMPRE como rascunho: nada é publicado sem revisão.
 */
export function validarCsv(texto: string, existentes: { slugs?: string[]; urls?: string[] } = {}): Previa {
  const vazio = { linhas: [], validas: 0, comErro: 0, duplicadas: 0 };
  if (new TextEncoder().encode(texto).length > MAX_BYTES_CSV) return { ...vazio, erroGeral: 'Arquivo maior que 1 MB.' };
  const tabela = lerCsv(texto);
  if (tabela.length < 2) return { ...vazio, erroGeral: 'O arquivo precisa ter o cabeçalho e pelo menos uma linha.' };
  if (tabela.length - 1 > MAX_LINHAS_CSV) return { ...vazio, erroGeral: `Máximo de ${MAX_LINHAS_CSV} ofertas por arquivo.` };

  const cab = tabela[0].map((h) => h.trim().toLowerCase());
  const faltando = OBRIGATORIAS.filter((c) => !cab.includes(c));
  if (!COLUNAS_LINK.some((c) => cab.includes(c))) faltando.push('url_compra');
  if (faltando.length) return { ...vazio, erroGeral: `Colunas obrigatórias ausentes: ${faltando.join(', ')}.` };
  const desconhecidas = cab.filter((c) => c && !(c in COLUNAS_CSV));

  const slugs = new Set(existentes.slugs ?? []);
  const urls = new Set(existentes.urls ?? []);
  const slugsArq = new Set<string>(), urlsArq = new Set<string>();
  const linhas: LinhaPrevia[] = [];

  tabela.slice(1).forEach((cols, i) => {
    const entrada: Record<string, unknown> = {};
    cab.forEach((c, j) => { const campo = COLUNAS_CSV[c]; const v = (cols[j] ?? '').trim(); if (campo && (v || !(campo in entrada))) entrada[campo] = v; });
    entrada.status = 'rascunho';
    const r = validarOferta(entrada);
    const num = i + 2;
    if (!r.ok) { linhas.push({ linha: num, ok: false, erros: Object.values(r.erros) }); return; }
    const d = r.dados;
    const chave = chaveDuplicidade(d.external_product_url);
    let duplicada: LinhaPrevia['duplicada'];
    if (slugs.has(d.slug) || urls.has(chave)) duplicada = 'ja_cadastrada';
    else if (slugsArq.has(d.slug) || urlsArq.has(chave)) duplicada = 'no_arquivo';
    slugsArq.add(d.slug); urlsArq.add(chave);
    linhas.push({
      linha: num, ok: !duplicada, dados: d, duplicada,
      erros: duplicada ? [duplicada === 'ja_cadastrada' ? 'Já existe oferta com este nome ou link.' : 'Repetida neste arquivo (mesmo nome ou link).'] : [],
    });
  });

  const res: Previa = {
    linhas,
    validas: linhas.filter((l) => l.ok).length,
    comErro: linhas.filter((l) => !l.ok && !l.duplicada).length,
    duplicadas: linhas.filter((l) => !!l.duplicada).length,
  };
  if (desconhecidas.length) res.erroGeral = `Colunas ignoradas: ${desconhecidas.join(', ')}.`;
  return res;
}

/** Texto SQL (para revisão humana) que insere as linhas válidas. Escapa aspas simples. */
export function gerarSqlImportacao(dados: DadosOferta[], publicar: boolean) {
  const q = (v: string | null) => (v === null ? 'null' : "'" + v.replace(/\u0000/g, '').replace(/'/g, "''") + "'");
  const arr = (a: string[]) => (a.length ? `array[${a.map((t) => q(t)).join(', ')}]::text[]` : "'{}'::text[]");
  const status = publicar ? 'ativo' : 'rascunho';
  const linhas = dados.map((d) =>
    `  (${q(d.title)}, ${q(d.slug)}, ${q(d.description)}, ${q(d.short_description)}, ${q(d.image_url)}, ${q(d.category)}, ${arr(d.tags)}, ` +
    `${q(d.external_platform)}, ${q(d.external_product_url)}, ${q(d.affiliate_url)}, ${d.price_reference === null ? 'null' : d.price_reference.toFixed(2)}, ${d.price_from === null ? 'null' : d.price_from.toFixed(2)}, ` +
    `${q(d.currency)}, ${q(d.producer_name)}, ${q(d.authorization_note)}, ${q(status)}, ${d.featured ? 'true' : 'false'}, ${d.priority}, now())`);
  return [
    '-- ============================================================',
    '-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA',
    `-- Importação de ${dados.length} oferta(s) parceira(s) gerada pelo painel em ${new Date().toISOString()}`,
    `-- Status ao inserir: ${status}. Requer os scripts 01 e 05 (tabela public.partner_offers + plataformas novas e preço "de").`,
    '-- Ofertas com o mesmo slug já cadastrado são ignoradas (on conflict do nothing).',
    '-- ============================================================',
    'insert into public.partner_offers',
    '  (title, slug, description, short_description, image_url, category, tags, external_platform, external_product_url,',
    '   affiliate_url, price_reference, price_from, currency, producer_name, authorization_note, status, featured, priority, last_verified_at)',
    'values',
    linhas.join(',\n'),
    'on conflict (slug) do nothing;',
    '',
  ].join('\n');
}
