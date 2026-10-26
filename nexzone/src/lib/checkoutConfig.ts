// ============================================================
// Construtor do checkout — formato do products.checkout_config.
// Só APARÊNCIA e CONTEÚDO da página: valor, pagamento, pedido e entrega não passam por aqui.
// Fase 2: até 4 order bumps. QUAIS produtos e POR QUANTO ficam em products.bumps (validado no
// servidor); aqui ficam só os textos/imagem de cada bump, ligados pelo product_id.
//
// Versão 2: lista ordenada de blocos. O bloco "pagamento" (formulário de compra) é fixo e
// sempre existe; o vendedor arruma os outros em volta dele. Configurações antigas (versão 1:
// headline, subtitle, banner_url, badge_text, countdown_until) são convertidas automaticamente.
// ============================================================
import { MSG_MAX } from './textoFormatado';
import { normalizarRastreio, validarRastreio, RASTREIO_VAZIO, type RastreioProduto } from './rastreioVenda';

export type TipoBloco = 'imagem' | 'titulo' | 'texto' | 'contador' | 'pagamento' | 'recebe' | 'garantia' | 'selos' | 'depoimentos';

export type Depoimento = { nome: string; foto: string | null; nota: number; texto: string };

export type Bloco =
  | { id: string; tipo: 'imagem'; ativo: boolean; url: string }
  | { id: string; tipo: 'titulo'; ativo: boolean; titulo: string; subtitulo: string; selo: string }
  | { id: string; tipo: 'texto'; ativo: boolean; texto: string }
  | { id: string; tipo: 'contador'; ativo: boolean; ate: string }
  | { id: string; tipo: 'depoimentos'; ativo: boolean; titulo: string; itens: Depoimento[] }
  | { id: string; tipo: 'pagamento' | 'recebe' | 'garantia' | 'selos'; ativo: boolean };

export type BumpVisual = { product_id: string; chamada: string; texto: string; imagem: string | null };
/** Um order bump do produto: qual produto e o preço no bump (products.bumps). */
export type BumpItem = { product_id: string; valor: number };

export type CheckoutConfig = {
  versao: 2;
  cor: string | null;
  blocos: Bloco[];
  bumps: BumpVisual[];
  depoimentosConfirmados: boolean;
  rastreio: RastreioProduto; // pixels e página de obrigado (Sprint 1)
};

export const LIMITES = { blocos: 20, textos: 5, imagens: 3, depoimentos: 6, titulo: 120, subtitulo: 300, selo: 40, nome: 60, depoimento: 600, chamada: 120, bumpTexto: 400, bumps: 4 };

export const ROTULO_BLOCO: Record<TipoBloco, string> = {
  imagem: 'Imagem', titulo: 'Título e selo', texto: 'Texto', contador: 'Contador regressivo', pagamento: 'Formulário de pagamento',
  recebe: 'O que você recebe', garantia: 'Garantia', selos: 'Selos de segurança', depoimentos: 'Depoimentos (prova social)',
};

/** Blocos que só podem aparecer uma vez. */
export const UNICOS: TipoBloco[] = ['titulo', 'contador', 'pagamento', 'recebe', 'garantia', 'selos', 'depoimentos'];

let seq = 0;
export function novoId(tipo: string) {
  seq = (seq + 1) % 1e6;
  return `${tipo}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

const txt = (v: any, max: number) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '');
const linha = (v: any, max: number) => txt(v, max).replace(/\s*\n\s*/g, ' ');
const COR = /^#[0-9a-f]{6}$/i;

export function blocoPadrao(tipo: TipoBloco): Bloco {
  const id = novoId(tipo);
  switch (tipo) {
    case 'imagem': return { id, tipo, ativo: true, url: '' };
    case 'titulo': return { id, tipo, ativo: true, titulo: 'Finalizar compra', subtitulo: '', selo: '' };
    case 'texto': return { id, tipo, ativo: true, texto: '' };
    case 'contador': return { id, tipo, ativo: true, ate: '' };
    case 'depoimentos': return { id, tipo, ativo: true, titulo: 'Quem já comprou', itens: [] };
    default: return { id, tipo, ativo: true };
  }
}

/** Página padrão (produto sem personalização). */
export function configPadrao(): CheckoutConfig {
  return {
    versao: 2, cor: null, depoimentosConfirmados: false,
    bumps: [], rastreio: { ...RASTREIO_VAZIO },
    blocos: [blocoPadrao('titulo'), blocoPadrao('pagamento'), blocoPadrao('recebe'), blocoPadrao('garantia'), blocoPadrao('selos')]
      .map((b, i) => ({ ...b, id: `${b.tipo}-${i}` })),
  };
}

/**
 * Lê qualquer coisa salva (v1, v2 ou lixo) e devolve uma config v2 válida.
 * `urlOk` decide quais imagens são aceitas (no servidor: só do nosso armazenamento).
 */
export function normalizarCheckout(raw: any, urlOk: (u: string) => boolean = urlHttps): CheckoutConfig {
  const base = configPadrao();
  if (!raw || typeof raw !== 'object') return base;
  const img = (u: any) => (typeof u === 'string' && urlOk(u.trim()) ? u.trim() : '');

  // Versão 1 → blocos
  if (raw.versao !== 2) {
    const blocos: Bloco[] = [];
    const ban = img(raw.banner_url);
    if (ban) blocos.push({ id: 'imagem-0', tipo: 'imagem', ativo: true, url: ban });
    blocos.push({ id: 'titulo-0', tipo: 'titulo', ativo: true, titulo: linha(raw.headline, LIMITES.titulo) || 'Finalizar compra', subtitulo: txt(raw.subtitle, LIMITES.subtitulo), selo: linha(raw.badge_text, LIMITES.selo) });
    if (dataValida(raw.countdown_until)) blocos.push({ id: 'contador-0', tipo: 'contador', ativo: true, ate: new Date(raw.countdown_until).toISOString() });
    blocos.push({ id: 'pagamento-0', tipo: 'pagamento', ativo: true }, { id: 'recebe-0', tipo: 'recebe', ativo: true }, { id: 'garantia-0', tipo: 'garantia', ativo: true }, { id: 'selos-0', tipo: 'selos', ativo: true });
    return { ...base, cor: COR.test(raw.cor || '') ? raw.cor : null, blocos, rastreio: normalizarRastreio(raw.rastreio) };
  }

  const vistos = new Set<string>();
  const ids = new Set<string>();
  let textos = 0, imagens = 0;
  const blocos: Bloco[] = [];
  for (const b of Array.isArray(raw.blocos) ? raw.blocos : []) {
    if (!b || typeof b !== 'object' || blocos.length >= LIMITES.blocos) continue;
    const tipo = b.tipo as TipoBloco;
    if (!(tipo in ROTULO_BLOCO)) continue;
    if (UNICOS.includes(tipo)) { if (vistos.has(tipo)) continue; vistos.add(tipo); }
    let id = typeof b.id === 'string' && /^[\w-]{1,60}$/.test(b.id) ? b.id : novoId(tipo);
    if (ids.has(id)) id = novoId(tipo);
    ids.add(id);
    const ativo = tipo === 'pagamento' ? true : b.ativo !== false;
    if (tipo === 'imagem') {
      if (imagens >= LIMITES.imagens) continue;
      imagens++;
      blocos.push({ id, tipo, ativo, url: img(b.url) });
    } else if (tipo === 'titulo') {
      blocos.push({ id, tipo, ativo, titulo: linha(b.titulo, LIMITES.titulo), subtitulo: txt(b.subtitulo, LIMITES.subtitulo), selo: linha(b.selo, LIMITES.selo) });
    } else if (tipo === 'texto') {
      if (textos >= LIMITES.textos) continue;
      textos++;
      blocos.push({ id, tipo, ativo, texto: txt(b.texto, MSG_MAX) });
    } else if (tipo === 'contador') {
      blocos.push({ id, tipo, ativo, ate: dataValida(b.ate) ? new Date(b.ate).toISOString() : '' });
    } else if (tipo === 'depoimentos') {
      const itens: Depoimento[] = (Array.isArray(b.itens) ? b.itens : []).slice(0, LIMITES.depoimentos)
        .map((d: any) => ({
          nome: linha(d?.nome, LIMITES.nome),
          foto: img(d?.foto) || null,
          nota: Math.min(5, Math.max(1, Math.round(Number(d?.nota) || 5))),
          texto: txt(d?.texto, LIMITES.depoimento),
        }))
        .filter((d: Depoimento) => d.nome && d.texto);
      blocos.push({ id, tipo, ativo, titulo: linha(b.titulo, 80), itens });
    } else {
      blocos.push({ id, tipo, ativo } as Bloco);
    }
  }
  if (!vistos.has('pagamento')) blocos.push({ id: 'pagamento-0', tipo: 'pagamento', ativo: true });

  return {
    versao: 2,
    cor: COR.test(raw.cor || '') ? raw.cor : null,
    blocos,
    depoimentosConfirmados: raw.depoimentosConfirmados === true,
    bumps: visuaisDosBumps(raw, img),
    rastreio: normalizarRastreio(raw.rastreio),
  };
}

/** Validação de quem SALVA (mensagens claras); devolve a config já limpa. */
export function validarCheckout(raw: any, urlOk: (u: string) => boolean): { ok: true; config: CheckoutConfig } | { ok: false; erro: string } {
  if (!raw || typeof raw !== 'object' || raw.versao !== 2) return { ok: false, erro: 'Configuração inválida.' };
  const brutos: any[] = Array.isArray(raw.blocos) ? raw.blocos : [];
  if (brutos.length > LIMITES.blocos) return { ok: false, erro: `Use no máximo ${LIMITES.blocos} blocos.` };
  for (const b of brutos) {
    if (b?.tipo === 'imagem' && b.url && !urlOk(String(b.url))) return { ok: false, erro: 'Envie as imagens pelo botão "Escolher imagem".' };
    if (b?.tipo === 'contador' && b.ativo !== false && b.ate && !dataValida(b.ate)) return { ok: false, erro: 'Data do contador inválida.' };
    if (b?.tipo === 'depoimentos') {
      const itens = Array.isArray(b.itens) ? b.itens : [];
      if (itens.length > LIMITES.depoimentos) return { ok: false, erro: `Use no máximo ${LIMITES.depoimentos} depoimentos.` };
      for (const d of itens) {
        if (!String(d?.nome || '').trim() || !String(d?.texto || '').trim()) return { ok: false, erro: 'Cada depoimento precisa de nome e texto.' };
        if (d?.foto && !urlOk(String(d.foto))) return { ok: false, erro: 'Envie as fotos dos depoimentos pelo botão "Foto".' };
      }
      if (itens.length && b.ativo !== false && raw.depoimentosConfirmados !== true) {
        return { ok: false, erro: 'Confirme que os depoimentos são de clientes reais e que você tem autorização para publicá-los.' };
      }
    }
  }
  const visuais = Array.isArray(raw.bumps) ? raw.bumps : raw.bump ? [raw.bump] : [];
  if (visuais.length > LIMITES.bumps) return { ok: false, erro: `Use no máximo ${LIMITES.bumps} order bumps.` };
  for (const v of visuais) {
    if (v?.imagem && !urlOk(String(v.imagem))) return { ok: false, erro: 'Envie a imagem do order bump pelo botão "Escolher imagem".' };
  }
  if (raw.cor && !COR.test(String(raw.cor))) return { ok: false, erro: 'Cor inválida.' };
  const erroRastreio = validarRastreio(raw.rastreio);
  if (erroRastreio) return { ok: false, erro: erroRastreio };
  return { ok: true, config: normalizarCheckout(raw, urlOk) };
}

// Textos/imagem de cada bump. Config antiga (um só "bump", sem product_id) vira o 1º da lista,
// com product_id '' (= "o primeiro bump", seja qual for o produto).
function visuaisDosBumps(raw: any, img: (u: any) => string): BumpVisual[] {
  const lista: any[] = Array.isArray(raw.bumps) ? raw.bumps : raw.bump && typeof raw.bump === 'object' ? [{ ...raw.bump, product_id: '' }] : [];
  const vistos = new Set<string>();
  const out: BumpVisual[] = [];
  for (const v of lista) {
    if (!v || typeof v !== 'object' || out.length >= LIMITES.bumps) continue;
    const pid = typeof v.product_id === 'string' && UUID.test(v.product_id) ? v.product_id.toLowerCase() : '';
    if (vistos.has(pid)) continue;
    vistos.add(pid);
    out.push({ product_id: pid, chamada: linha(v.chamada, LIMITES.chamada), texto: txt(v.texto, LIMITES.bumpTexto), imagem: img(v.imagem) || null });
  }
  return out;
}

/** Textos do bump de um produto (posição `i` na lista). Sem textos próprios, usa os da config antiga no 1º. */
export function visualDoBump(cfg: CheckoutConfig, productId: string, i: number): BumpVisual {
  const pid = String(productId || '').toLowerCase();
  const v = cfg.bumps.find((b) => b.product_id && b.product_id === pid) || (i === 0 ? cfg.bumps.find((b) => b.product_id === '') : undefined);
  return v ? { ...v, product_id: pid } : { product_id: pid, chamada: '', texto: '', imagem: null };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valorBump = (v: any) => Math.round(Number(v) * 100) / 100;

/**
 * Lista de bumps salva no produto (products.bumps), já limpa: até 4, sem repetir, preço >= R$ 1,00.
 * Produto que ainda não tem a lista usa o bump antigo (bump_product_id / bump_valor).
 * Quem chama ainda precisa conferir se cada produto é da mesma loja e está ativo.
 */
export function listaDeBumps(produto: { id?: string; bumps?: any; bump_product_id?: any; bump_valor?: any } | null | undefined): BumpItem[] {
  if (!produto) return [];
  const bruta: any[] = Array.isArray(produto.bumps) && produto.bumps.length
    ? produto.bumps
    : produto.bump_product_id && produto.bump_valor ? [{ product_id: produto.bump_product_id, valor: produto.bump_valor }] : [];
  const vistos = new Set<string>();
  const out: BumpItem[] = [];
  for (const b of bruta) {
    if (out.length >= LIMITES.bumps) break;
    const pid = typeof b?.product_id === 'string' ? b.product_id.toLowerCase() : '';
    const valor = valorBump(b?.valor);
    if (!UUID.test(pid) || vistos.has(pid) || pid === String(produto.id || '').toLowerCase()) continue;
    if (!Number.isFinite(valor) || valor < 1 || valor > 100000) continue;
    vistos.add(pid);
    out.push({ product_id: pid, valor });
  }
  return out;
}

/** Validação de quem SALVA a lista de bumps (mensagens claras). Não confere a loja: isso é no servidor. */
export function validarListaBumps(raw: any, principalId: string): { ok: true; lista: BumpItem[] } | { ok: false; erro: string } {
  const lista: any[] = Array.isArray(raw) ? raw : [];
  if (lista.length > LIMITES.bumps) return { ok: false, erro: `Use no máximo ${LIMITES.bumps} order bumps.` };
  const vistos = new Set<string>();
  const out: BumpItem[] = [];
  for (const b of lista) {
    const pid = typeof b?.product_id === 'string' ? b.product_id.toLowerCase() : '';
    if (!UUID.test(pid) || pid === String(principalId).toLowerCase()) return { ok: false, erro: 'Produto do order bump inválido.' };
    if (vistos.has(pid)) return { ok: false, erro: 'O mesmo produto aparece em dois order bumps. Escolha produtos diferentes.' };
    const valor = valorBump(b?.valor);
    if (!Number.isFinite(valor) || valor < 1 || valor > 100000) return { ok: false, erro: 'Preço do order bump: use um valor a partir de R$ 1,00.' };
    vistos.add(pid);
    out.push({ product_id: pid, valor });
  }
  return { ok: true, lista: out };
}

export function dataValida(v: any): boolean {
  if (typeof v !== 'string' || !v) return false;
  const t = new Date(v).getTime();
  return Number.isFinite(t) && t > Date.UTC(2020, 0, 1) && t < Date.UTC(2100, 0, 1);
}

export function urlHttps(u: string): boolean {
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
}

/** Só imagens do nosso armazenamento (bucket público "capas"). */
export function urlDoArmazenamento(supabaseUrl: string | undefined) {
  const base = String(supabaseUrl || '').replace(/\/+$/, '');
  const prefixo = `${base}/storage/v1/object/public/capas/`;
  return (u: string) => !!base && typeof u === 'string' && u.startsWith(prefixo) && !u.includes('..') && urlHttps(u);
}
