'use client';
import { useEffect } from 'react';
import type { RastreioProduto } from '@/lib/rastreioVenda';
import { origemGuardada } from '@/lib/rastreio-cliente';

// Pixels do VENDEDOR (Meta, TikTok, Google) no checkout e na página do pedido.
// Os IDs já chegam validados (só números/códigos), então nada de texto livre vira script.
declare global {
  interface Window { fbq?: any; _fbq?: any; ttq?: any; dataLayer?: any[]; gtag?: (...a: any[]) => void; __cbPix?: Record<string, boolean>; }
}

function carregarScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.async = true; s.src = src; s.id = id;
  document.head.appendChild(s);
}

function iniciarMeta(id: string) {
  const w = window;
  if (!w.fbq) {
    const n: any = function (...args: any[]) { n.callMethod ? n.callMethod(...args) : n.queue.push(args); };
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    w.fbq = n; if (!w._fbq) w._fbq = n;
    carregarScript('https://connect.facebook.net/en_US/fbevents.js', 'cb-px-meta');
  }
  w.fbq('init', id);
  w.fbq('track', 'PageView');
}

function iniciarTikTok(id: string) {
  const w = window as any;
  if (!w.ttq) {
    const ttq: any = []; w.TiktokAnalyticsObject = 'ttq'; w.ttq = ttq;
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = (t: any, e: string) => { t[e] = (...a: any[]) => { t.push([e, ...a]); }; };
    ttq.methods.forEach((m: string) => ttq.setAndDefer(ttq, m));
    ttq.instance = (t: string) => { const e = ttq._i[t] || []; ttq.methods.forEach((m: string) => ttq.setAndDefer(e, m)); return e; };
    ttq.load = (e: string) => {
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = {};
      carregarScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(e)}&lib=ttq`, 'cb-px-tt');
    };
  }
  w.ttq.load(id);
  w.ttq.page();
}

function iniciarGoogle(ids: string[]) {
  const w = window;
  if (!w.gtag) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () { (w.dataLayer as any[]).push(arguments); } as any;
    w.gtag!('js', new Date());
    carregarScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0])}`, 'cb-px-gtag');
  }
  ids.forEach((id) => w.gtag!('config', id));
}

/** Carrega os pixels configurados no produto (uma vez por página). */
export function usePixels(r: RastreioProduto | null | undefined) {
  useEffect(() => {
    if (!r || typeof window === 'undefined') return;
    window.__cbPix = window.__cbPix || {};
    try {
      if (r.meta && !window.__cbPix['m' + r.meta]) { window.__cbPix['m' + r.meta] = true; iniciarMeta(r.meta); }
      if (r.tiktok && !window.__cbPix['t' + r.tiktok]) { window.__cbPix['t' + r.tiktok] = true; iniciarTikTok(r.tiktok); }
      const g = [r.ga4, r.adsId].filter(Boolean);
      if (g.length && !window.__cbPix['g' + g.join()]) { window.__cbPix['g' + g.join()] = true; iniciarGoogle(g); }
    } catch { /* pixel nunca trava a página */ }
  }, [r]);
}

export type EventoVenda = 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase';

/** Dispara o evento nos pixels carregados. Purchase usa o id do pedido para não duplicar. */
export function dispararPixel(r: RastreioProduto | null | undefined, evento: EventoVenda, d: { valor: number; produtoId: string; titulo: string; pedidoId?: string }) {
  if (!r || typeof window === 'undefined') return;
  const w = window;
  const valor = Math.round(Number(d.valor || 0) * 100) / 100;
  try {
    if (r.meta && w.fbq) {
      const dados = { value: valor, currency: 'BRL', content_ids: [d.produtoId], content_type: 'product', content_name: d.titulo };
      w.fbq('track', evento, dados, d.pedidoId ? { eventID: `${evento}-${d.pedidoId}` } : undefined);
    }
    if (r.tiktok && w.ttq) {
      const nome = evento === 'Purchase' ? 'CompletePayment' : evento;
      w.ttq.track(nome, { value: valor, currency: 'BRL', contents: [{ content_id: d.produtoId, content_name: d.titulo, quantity: 1, price: valor }] },
        d.pedidoId ? { event_id: `${evento}-${d.pedidoId}` } : undefined);
    }
    if (w.gtag && (r.ga4 || r.adsId)) {
      const nome = evento === 'Purchase' ? 'purchase' : evento === 'InitiateCheckout' ? 'begin_checkout' : 'add_payment_info';
      w.gtag('event', nome, { currency: 'BRL', value: valor, ...(d.pedidoId ? { transaction_id: d.pedidoId } : {}), items: [{ item_id: d.produtoId, item_name: d.titulo, price: valor, quantity: 1 }] });
      if (evento === 'Purchase' && r.adsId && r.adsLabel) {
        w.gtag('event', 'conversion', { send_to: `${r.adsId}/${r.adsLabel}`, value: valor, currency: 'BRL', transaction_id: d.pedidoId || '' });
      }
    }
  } catch { /* nunca trava */ }
}

/** Purchase só uma vez por pedido neste navegador. */
export function dispararCompraUmaVez(r: RastreioProduto | null | undefined, d: { valor: number; produtoId: string; titulo: string; pedidoId: string }): boolean {
  const chave = `cb_px_compra_${d.pedidoId}`;
  try { if (localStorage.getItem(chave)) return false; localStorage.setItem(chave, '1'); } catch { /* sem armazenamento: dispara */ }
  dispararPixel(r, 'Purchase', d);
  return true;
}

// ---------- Origem e cliques (vão junto com o pedido) ----------
const CHAVES = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'];

/** UTM do link do checkout (o vendedor repassa da página dele) ou, se não tiver, a origem do 1º acesso ao site. */
export function coletarOrigem(): Record<string, string> | null {
  try {
    const sp = new URLSearchParams(window.location.search);
    const daUrl: Record<string, string> = {};
    CHAVES.forEach((k) => { const v = sp.get(k); if (v) daUrl[k] = v.slice(0, 100); });
    let ref = '';
    try { const h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h && !h.endsWith(window.location.hostname.replace(/^www\./, ''))) ref = h; } catch {}
    if (Object.keys(daUrl).length) return ref ? { ...daUrl, ref } : daUrl;
    const g: any = origemGuardada();
    if (!g) return ref ? { ref } : null;
    const out: Record<string, string> = {};
    CHAVES.forEach((k) => { if (g[k]) out[k] = String(g[k]); });
    if (g.ref || ref) out.ref = String(g.ref || ref);
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}

function cookie(nome: string) {
  try { return document.cookie.split('; ').find((c) => c.startsWith(nome + '='))?.split('=').slice(1).join('=') || ''; } catch { return ''; }
}

/** Identificadores de clique dos anúncios (fbp/fbc/ttclid/gclid) para a API de Conversões. */
export function coletarCliques(): Record<string, string> | null {
  try {
    const sp = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    const fbp = cookie('_fbp'); if (fbp) out.fbp = decodeURIComponent(fbp);
    const fbclid = sp.get('fbclid');
    const fbc = cookie('_fbc') || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : '');
    if (fbc) out.fbc = decodeURIComponent(fbc);
    if (fbclid) out.fbclid = fbclid;
    const ttclid = sp.get('ttclid'); if (ttclid) out.ttclid = ttclid;
    const ttp = cookie('_ttp'); if (ttp) out.ttp = decodeURIComponent(ttp);
    const gclid = sp.get('gclid'); if (gclid) out.gclid = gclid;
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}
