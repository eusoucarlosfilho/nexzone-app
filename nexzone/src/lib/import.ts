import { lookup } from 'dns/promises';
import net from 'net';

// ---------------- Segurança (anti-SSRF) ----------------
function ipBloqueado(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 127) return true;                 // loopback
    if (p[0] === 10) return true;                  // 10.0.0.0/8
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local
    if (p[0] === 192 && p[1] === 168) return true; // 192.168.0.0/16
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16-31
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::' ) return true;
  if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true; // local/ULA
  if (low.startsWith('::ffff:')) return ipBloqueado(low.replace('::ffff:', ''));
  return false;
}

async function urlSegura(raw: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, error: 'Link inválido.' }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'Use um link http ou https.' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return { ok: false, error: 'Endereço não permitido.' };
  if (net.isIP(host) && ipBloqueado(host)) return { ok: false, error: 'Endereço não permitido.' };
  try {
    const recs = await lookup(host, { all: true });
    if (recs.some((r) => ipBloqueado(r.address))) return { ok: false, error: 'Endereço não permitido.' };
  } catch { return { ok: false, error: 'Não consegui resolver esse endereço.' }; }
  return { ok: true, url };
}

// Lê o corpo com limite de bytes
async function lerComLimite(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, maxBytes);
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) { chunks.push(value); total += value.length; if (total >= maxBytes) { try { await reader.cancel(); } catch {} break; } }
  }
  return new TextDecoder('utf-8').decode(concat(chunks).slice(0, maxBytes));
}
function concat(arr: Uint8Array[]): Uint8Array {
  const total = arr.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const a of arr) { out.set(a, o); o += a.length; }
  return out;
}

// ---------------- Extração de conteúdo ----------------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

type Extracao = { ok: true; conteudo: string } | { ok: false; bloqueado: boolean; error: string };

export async function fetchAndExtract(rawUrl: string): Promise<Extracao> {
  const seg = await urlSegura(rawUrl);
  if (!seg.ok) return { ok: false, bloqueado: false, error: seg.error };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let res: Response;
  try {
    res = await fetch(seg.url.toString(), {
      redirect: 'follow', signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false, bloqueado: true, error: 'Não consegui abrir o link (tempo esgotado ou recusado).' };
  }
  clearTimeout(timer);

  if (res.status === 403 || res.status === 401 || res.status === 429 || res.status === 503) {
    return { ok: false, bloqueado: true, error: 'O site bloqueou a leitura automática.' };
  }
  if (!res.ok) return { ok: false, bloqueado: true, error: `O link respondeu com erro (${res.status}).` };
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('html') && !ct.includes('xml')) return { ok: false, bloqueado: true, error: 'O link não é uma página de produto.' };

  const html = await lerComLimite(res, 2 * 1024 * 1024);
  if (/just a moment|checking your browser|cf-browser-verification|captcha/i.test(html)) {
    return { ok: false, bloqueado: true, error: 'O site exige verificação (Cloudflare/captcha).' };
  }

  const partes: string[] = [];
  const pega = (re: RegExp) => { const m = html.match(re); return m ? m[1].trim() : ''; };

  const title = pega(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) partes.push('TÍTULO: ' + decode(title));
  const desc = metaContent(html, 'name', 'description');
  if (desc) partes.push('DESCRIÇÃO: ' + decode(desc));

  for (const key of ['og:title', 'og:description', 'og:image', 'og:price:amount', 'product:price:amount', 'twitter:title', 'twitter:description', 'twitter:image']) {
    const v = metaContent(html, 'property', key) || metaContent(html, 'name', key);
    if (v) partes.push(`${key}: ${decode(v)}`);
  }

  // JSON-LD Product
  const lds = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of lds) {
    try {
      const json = JSON.parse(m[1].trim());
      for (const node of flattenLd(json)) {
        const t = node['@type'];
        const isProd = (Array.isArray(t) ? t.includes('Product') : t === 'Product');
        if (isProd) {
          if (node.name) partes.push('PRODUTO/nome: ' + node.name);
          if (node.description) partes.push('PRODUTO/desc: ' + node.description);
          const img = Array.isArray(node.image) ? node.image[0] : node.image;
          if (img) partes.push('PRODUTO/imagem: ' + (typeof img === 'string' ? img : img?.url || ''));
          const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          if (offers?.price) partes.push('PRODUTO/preço: ' + offers.price + ' ' + (offers.priceCurrency || ''));
        }
      }
    } catch {}
  }

  // Texto visível
  let texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  texto = decode(texto).replace(/\s+/g, ' ').trim();
  if (texto) partes.push('TEXTO DA PÁGINA: ' + texto);

  const conteudo = partes.join('\n').slice(0, 8000);
  if (conteudo.replace(/\s/g, '').length < 40) return { ok: false, bloqueado: true, error: 'Quase não consegui ler conteúdo dessa página.' };

  // Bloqueio "suave": o Mercado Livre entrega uma página genérica (cookies/login) para
  // acessos de servidor (IP de datacenter). Se for ML e não achamos NENHUM dado de
  // produto, tratamos como bloqueado para o usuário cair no "cole o texto".
  const achouProduto = partes.some((p) => p.startsWith('PRODUTO/') || p.startsWith('og:price') || p.startsWith('product:price'));
  if (/mercadolivre|mercadolibre/i.test(seg.url.hostname) && !achouProduto) {
    return { ok: false, bloqueado: true, error: 'O Mercado Livre bloqueia a leitura automática e entregou uma página genérica. Cole o texto do anúncio.' };
  }

  return { ok: true, conteudo };
}

function metaContent(html: string, attr: 'name' | 'property', key: string): string {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = html.match(new RegExp(`<meta[^>]+${attr}=["']${esc}["'][^>]*content=["']([^"']*)["']`, 'i'));
  if (m) return m[1];
  m = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${esc}["']`, 'i'));
  return m ? m[1] : '';
}
function flattenLd(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json.flatMap(flattenLd);
  let out = [json];
  if (json['@graph']) out = out.concat(flattenLd(json['@graph']));
  return out;
}
function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// ---------------- Re-hospedar imagem (com segurança) ----------------
export async function baixarImagemSegura(rawUrl: string): Promise<{ ok: true; bytes: Uint8Array; contentType: string; ext: string } | { ok: false; error: string }> {
  const seg = await urlSegura(rawUrl);
  if (!seg.ok) return { ok: false, error: seg.error };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let res: Response;
  try {
    res = await fetch(seg.url.toString(), { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept': 'image/*' } });
  } catch { clearTimeout(timer); return { ok: false, error: 'Não consegui baixar a imagem.' }; }
  clearTimeout(timer);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok || !ct.startsWith('image/')) return { ok: false, error: 'O link não aponta para uma imagem.' };
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 6 * 1024 * 1024) return { ok: false, error: 'A imagem é grande demais (máx. 6MB).' };
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
  return { ok: true, bytes: buf, contentType: ct, ext };
}

// ---------------- IA (DeepSeek) ----------------
export type ImportData = { titulo: string; descricao: string; preco: number | null; categoria: string; emoji: string; imagem_url: string };

export async function askDeepSeek(conteudo: string, categorias: string[], apiKey?: string): Promise<{ ok: true; data: ImportData } | { ok: false; error: string }> {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) return { ok: false, error: 'A importação por IA ainda não foi configurada. Cadastre a chave da DeepSeek em Configurações.' };

  const system = `Você recebe dados brutos de uma página de venda de um produto digital. Devolva SOMENTE um objeto JSON com as chaves: titulo, descricao, preco (número em BRL ou null), categoria (escolha exatamente UMA desta lista: ${categorias.join(' | ')} — ou string vazia se nenhuma encaixar), emoji (1 emoji que combine), imagem_url (melhor URL de imagem do produto ou vazio). A descrição deve ser reescrita em português, vendedora e adequada ao nosso marketplace. Não use markdown, não escreva nada fora do JSON.`;

  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat', temperature: 0.2, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: conteudo.slice(0, 8000) }],
      }),
    });
    clearTimeout(timer);
  } catch {
    return { ok: false, error: 'A IA demorou demais para responder. Tente de novo.' };
  }
  if (!res.ok) return { ok: false, error: 'A IA não conseguiu processar agora. Tente de novo em instantes.' };

  let raw = '';
  try { const j = await res.json(); raw = j?.choices?.[0]?.message?.content || ''; } catch {}
  raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  let obj: any;
  try { obj = JSON.parse(raw); } catch { return { ok: false, error: 'Não entendi a resposta da IA. Tente novamente.' }; }

  const precoNum = typeof obj.preco === 'number' ? obj.preco : (obj.preco ? Number(String(obj.preco).replace(/[^\d.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) : null);
  const cat = categorias.includes(obj.categoria) ? obj.categoria : '';
  return {
    ok: true,
    data: {
      titulo: String(obj.titulo || '').slice(0, 140),
      descricao: String(obj.descricao || '').slice(0, 2000),
      preco: precoNum != null && !isNaN(precoNum) ? precoNum : null,
      categoria: cat,
      emoji: String(obj.emoji || '').slice(0, 4),
      imagem_url: String(obj.imagem_url || '').slice(0, 600),
    },
  };
}
