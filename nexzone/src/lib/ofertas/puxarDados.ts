// "Puxar dados do link": lê as metatags PÚBLICAS (Open Graph / JSON-LD) de uma página de produto
// para pré-preencher o cadastro. SÓ SERVIDOR e só para administrador autorizado.
//
// Proteções contra SSRF (o servidor buscar endereços internos):
// - só https, porta padrão, sem usuário/senha, sem IP literal, sem encurtador (validarUrlExterna);
// - resolve o DNS e recusa IP privado, loopback, link-local, CGNAT, ULA e metadados de nuvem;
// - redirecionamentos seguidos MANUALMENTE (até 3), revalidando cada destino;
// - tempo máximo de 8 s, até 1,5 MB, só respostas HTML;
// - nenhum cookie ou credencial é enviado.
// Se o site bloquear (comum em grandes marketplaces), devolve erro e o cadastro segue manual.
import { lookup } from 'dns/promises';
import net from 'net';
import { validarUrlExterna } from './url';

const TEMPO_MS = 8000;
const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function ipPrivado(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224 || (a === 198 && (b === 18 || b === 19));
  }
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return true;
  if (s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb') || s.startsWith('fc') || s.startsWith('fd')) return true;
  if (s.startsWith('::ffff:')) return ipPrivado(s.slice(7));
  return false;
}

async function destinoSeguro(url: string): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const v = validarUrlExterna(url, null);
  if (!v.ok) return { ok: false, erro: v.erro };
  try {
    const recs = await lookup(v.host, { all: true });
    if (!recs.length || recs.some((r) => ipPrivado(r.address))) return { ok: false, erro: 'Endereço não permitido.' };
  } catch {
    return { ok: false, erro: 'Não foi possível encontrar esse endereço.' };
  }
  return { ok: true, url: v.url };
}

async function lerHtml(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    partes.push(value); total += value.length;
  }
  try { await reader.cancel(); } catch {}
  const junto = new Uint8Array(Math.min(total, MAX_BYTES));
  let o = 0;
  for (const p of partes) { const pedaco = p.slice(0, junto.length - o); junto.set(pedaco, o); o += pedaco.length; if (o >= junto.length) break; }
  return new TextDecoder('utf-8').decode(junto);
}

const ENT: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
export const decodificar = (s: string) => s.replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENT[m] ?? m)
  .replace(/&#(\d{1,6});/g, (_, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ''; }).trim();

function meta(html: string, chave: string) {
  const k = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${k}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodificar(m[1]) : '';
}

export type DadosPuxados = { title: string | null; image_url: string | null; price_reference: string | null; currency: string | null; short_description: string | null };

/** Extrai dados de um HTML (função pura, testável). */
export function extrairDados(html: string): DadosPuxados {
  let title = meta(html, 'og:title') || meta(html, 'twitter:title');
  if (!title) { const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); title = t ? decodificar(t[1]) : ''; }
  let image = meta(html, 'og:image') || meta(html, 'og:image:secure_url') || meta(html, 'twitter:image');
  let price = meta(html, 'product:price:amount') || meta(html, 'og:price:amount') || meta(html, 'price');
  let currency = meta(html, 'product:price:currency') || meta(html, 'og:price:currency') || meta(html, 'priceCurrency');
  const desc = meta(html, 'og:description') || meta(html, 'description');

  // JSON-LD Product (preço e imagem costumam estar aqui)
  for (const m of Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)).slice(0, 10)) {
    try {
      const raiz = JSON.parse(m[1].trim());
      const nos: any[] = Array.isArray(raiz) ? raiz : raiz && raiz['@graph'] ? raiz['@graph'] : [raiz];
      for (const n of nos) {
        const tipo = n && n['@type'];
        if (!(tipo === 'Product' || (Array.isArray(tipo) && tipo.includes('Product')))) continue;
        if (!title && typeof n.name === 'string') title = n.name;
        if (!image) image = typeof n.image === 'string' ? n.image : Array.isArray(n.image) && typeof n.image[0] === 'string' ? n.image[0] : n.image?.url || '';
        const of = Array.isArray(n.offers) ? n.offers[0] : n.offers;
        if (!price && of) price = String(of.price ?? of.lowPrice ?? '');
        if (!currency && of?.priceCurrency) currency = String(of.priceCurrency);
      }
    } catch { /* JSON-LD inválido: ignora */ }
  }

  const img = image && validarUrlExterna(image, null).ok ? image : '';
  const n = Number(String(price).replace(',', '.'));
  return {
    title: title ? title.slice(0, 140) : null,
    image_url: img || null,
    price_reference: Number.isFinite(n) && n > 0 && n < 1000000 ? n.toFixed(2).replace('.', ',') : null,
    currency: currency && /^(BRL|USD|EUR)$/i.test(currency) ? currency.toUpperCase() : null,
    short_description: desc ? desc.slice(0, 200) : null,
  };
}

export async function puxarDados(urlBruta: string): Promise<{ ok: true; dados: DadosPuxados } | { ok: false; erro: string }> {
  let alvo = await destinoSeguro(urlBruta);
  if (!alvo.ok) return alvo;
  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TEMPO_MS);
    let res: Response;
    try {
      res = await fetch(alvo.url, {
        redirect: 'manual', signal: ctrl.signal, cache: 'no-store', credentials: 'omit',
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' },
      });
    } catch {
      clearTimeout(timer);
      return { ok: false, erro: 'O site não respondeu a tempo. Preencha manualmente.' };
    }
    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const loc = res.headers.get('location');
      if (!loc) return { ok: false, erro: 'Redirecionamento inválido.' };
      let prox: string;
      try { prox = new URL(loc, alvo.url).toString(); } catch { return { ok: false, erro: 'Redirecionamento inválido.' }; }
      alvo = await destinoSeguro(prox);
      if (!alvo.ok) return { ok: false, erro: 'O link redireciona para um endereço não permitido.' };
      continue;
    }
    if (!res.ok) { clearTimeout(timer); return { ok: false, erro: `O site recusou a leitura (código ${res.status}). Preencha manualmente.` }; }
    const tipo = (res.headers.get('content-type') || '').toLowerCase();
    if (!tipo.includes('html')) { clearTimeout(timer); return { ok: false, erro: 'O link não é uma página.' }; }
    let html = '';
    try { html = await lerHtml(res); } catch { clearTimeout(timer); return { ok: false, erro: 'Não foi possível ler a página.' }; }
    clearTimeout(timer);
    const dados = extrairDados(html);
    if (!dados.title && !dados.image_url && !dados.price_reference) return { ok: false, erro: 'A página não informa nome, imagem ou preço de forma pública. Preencha manualmente.' };
    return { ok: true, dados };
  }
  return { ok: false, erro: 'Redirecionamentos demais.' };
}
