// ============================================================
// Rastreamento de vendas para quem roda tráfego (Sprint 1).
//
//  • Pixels por produto (Meta, TikTok, Google) — guardados em products.checkout_config.rastreio
//  • Página de obrigado própria do vendedor (https)
//  • Origem da venda (UTM + src/sck) — gravada em orders.origem
//  • Identificadores de clique (fbp/fbc/ttclid/gclid) — gravados à parte (order_rastreio, só servidor)
//
// Tudo validado com listas fechadas: nenhum texto livre vira script na página.
// ============================================================

export type RastreioProduto = {
  meta: string;        // ID do pixel do Meta (só números)
  tiktok: string;      // ID do pixel do TikTok
  ga4: string;         // G-XXXXXXX
  adsId: string;       // AW-123456789
  adsLabel: string;    // rótulo da conversão de compra do Google Ads
  obrigadoUrl: string; // https://… (página de obrigado do vendedor)
};

export const RASTREIO_VAZIO: RastreioProduto = { meta: '', tiktok: '', ga4: '', adsId: '', adsLabel: '', obrigadoUrl: '' };

const RE = {
  meta: /^\d{10,20}$/,
  tiktok: /^[A-Z0-9]{15,30}$/,
  ga4: /^G-[A-Z0-9]{4,15}$/,
  adsId: /^AW-\d{6,15}$/,
  adsLabel: /^[A-Za-z0-9_-]{4,60}$/,
};

/** Link da página de obrigado: só https, sem credenciais, até 500 caracteres. */
export function urlObrigadoValida(u: string): boolean {
  if (!u || u.length > 500) return false;
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && !x.username && !x.password && !!x.hostname && x.hostname.includes('.');
  } catch { return false; }
}

const limpa = (v: any) => (typeof v === 'string' ? v.trim() : '');

/** Lê o que foi salvo; o que não passar no formato é descartado (fica vazio). */
export function normalizarRastreio(raw: any): RastreioProduto {
  if (!raw || typeof raw !== 'object') return { ...RASTREIO_VAZIO };
  const meta = limpa(raw.meta).replace(/\s/g, '');
  const tiktok = limpa(raw.tiktok).toUpperCase();
  const ga4 = limpa(raw.ga4).toUpperCase();
  const adsId = limpa(raw.adsId).toUpperCase();
  const adsLabel = limpa(raw.adsLabel);
  const obrigadoUrl = limpa(raw.obrigadoUrl);
  return {
    meta: RE.meta.test(meta) ? meta : '',
    tiktok: RE.tiktok.test(tiktok) ? tiktok : '',
    ga4: RE.ga4.test(ga4) ? ga4 : '',
    adsId: RE.adsId.test(adsId) ? adsId : '',
    adsLabel: RE.adsId.test(adsId) && RE.adsLabel.test(adsLabel) ? adsLabel : '',
    obrigadoUrl: urlObrigadoValida(obrigadoUrl) ? obrigadoUrl : '',
  };
}

/** Validação para quem salva (mensagens claras). */
export function validarRastreio(raw: any): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const meta = limpa(raw.meta).replace(/\s/g, '');
  if (meta && !RE.meta.test(meta)) return 'Pixel do Meta: use só o número do pixel (ex.: 1234567890123456).';
  const tiktok = limpa(raw.tiktok).toUpperCase();
  if (tiktok && !RE.tiktok.test(tiktok)) return 'Pixel do TikTok: use o código do pixel (ex.: C4A1B2C3D4E5F6G7H8I9).';
  const ga4 = limpa(raw.ga4).toUpperCase();
  if (ga4 && !RE.ga4.test(ga4)) return 'Google Analytics: use o ID de medição (ex.: G-ABC123XYZ).';
  const adsId = limpa(raw.adsId).toUpperCase();
  if (adsId && !RE.adsId.test(adsId)) return 'Google Ads: use o ID da conversão (ex.: AW-123456789).';
  const adsLabel = limpa(raw.adsLabel);
  if (adsLabel && !adsId) return 'Google Ads: informe também o ID (AW-…).';
  if (adsId && adsLabel && !RE.adsLabel.test(adsLabel)) return 'Google Ads: rótulo de conversão inválido.';
  const ob = limpa(raw.obrigadoUrl);
  if (ob && !urlObrigadoValida(ob)) return 'Página de obrigado: use um link completo começando com https://';
  return null;
}

export const temPixel = (r: RastreioProduto) => !!(r.meta || r.tiktok || r.ga4 || r.adsId);

// ---------- Origem da venda ----------
export const CHAVES_ORIGEM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'] as const;
export type OrigemVenda = Partial<Record<(typeof CHAVES_ORIGEM)[number] | 'ref', string>>;

const texto = (v: any, max = 100) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>"'`\\]/g, '').trim().slice(0, max) : '');

/** Limpa a origem enviada pelo navegador (UTM da URL do checkout ou do 1º acesso). */
export function limparOrigem(raw: any): OrigemVenda | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: OrigemVenda = {};
  for (const k of CHAVES_ORIGEM) { const t = texto(raw[k]); if (t) out[k] = t; }
  const ref = texto(raw.ref, 80).toLowerCase();
  if (ref && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(ref)) out.ref = ref;
  return Object.keys(out).length ? out : null;
}

/** Identificadores de clique dos anúncios (para a API de Conversões na Sprint 2). */
export function limparCliques(raw: any): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, string> = {};
  const fbp = texto(raw.fbp, 120); if (/^fb\.\d\.\d{10,16}\.\d{5,25}$/.test(fbp)) out.fbp = fbp;
  const fbc = texto(raw.fbc, 300); if (/^fb\.\d\.\d{10,16}\.[\w-]{10,250}$/.test(fbc)) out.fbc = fbc;
  for (const k of ['fbclid', 'ttclid', 'gclid', 'ttp']) { const v = texto(raw[k], 250); if (/^[\w.-]{8,250}$/.test(v)) out[k] = v; }
  return Object.keys(out).length ? out : null;
}

/** "Origem" legível para relatórios: campanha › conteúdo, ou fonte, ou site de referência. */
export function rotuloOrigem(o: OrigemVenda | null | undefined): { fonte: string; campanha: string; conteudo: string } {
  if (!o) return { fonte: 'Direto / sem rastreio', campanha: '—', conteudo: '—' };
  const fonte = o.utm_source || o.src || o.ref || 'Direto / sem rastreio';
  return { fonte, campanha: o.utm_campaign || '—', conteudo: o.utm_content || o.sck || '—' };
}

// ---------- Identificação do comprador no checkout sem login ----------
export function emailValido(e: string): boolean {
  return typeof e === 'string' && e.length <= 160 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(e);
}
export function nomeValido(n: string): boolean {
  const t = String(n || '').trim();
  return t.length >= 3 && t.length <= 80 && /\S+\s+\S+/.test(t) && !/[<>{}]/.test(t);
}

// ---------- Postback (Sprint 2): eventos que o vendedor pode receber ----------
export const EVENTOS_POSTBACK = [
  { id: 'venda_aprovada', rotulo: 'Venda aprovada' },
  { id: 'pix_gerado', rotulo: 'Pix gerado (aguardando pagamento)' },
  { id: 'reembolso', rotulo: 'Reembolso' },
] as const;
