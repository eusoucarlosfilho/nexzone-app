'use client';
// Pixel INSTITUCIONAL da Comprei Barato (Meta) — usado só nas campanhas da marca
// (ex.: Black Friday Gamer). Fica separado dos pixels dos vendedores e do pixel de /produtores:
// todo evento sai com trackSingle, então nada daqui vai para outro pixel e nada dos outros chega aqui.
import { uuid } from '@/lib/rastreio-cliente';

export const PIXEL_INSTITUCIONAL = '1011953058327448';

declare global { interface Window { fbq?: any; _fbq?: any; __cbInst?: boolean } }

function garantirFbq() {
  const w = window;
  if (w.fbq) return;
  const n: any = function (...a: any[]) { n.callMethod ? n.callMethod(...a) : n.queue.push(a); };
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  w.fbq = n; if (!w._fbq) w._fbq = n;
  const s = document.createElement('script');
  s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
}

/** Carrega o pixel institucional (uma vez) e registra a visualização da página. */
export function pageViewInstitucional() {
  if (typeof window === 'undefined') return;
  try {
    garantirFbq();
    if (!window.__cbInst) {
      // Sem eventos automáticos: o pixel continua carregado se a pessoa navegar para outras páginas,
      // e não queremos cliques de produto/checkout entrando no pixel da marca.
      window.fbq('set', 'autoConfig', false, PIXEL_INSTITUCIONAL);
      window.fbq('init', PIXEL_INSTITUCIONAL);
      window.__cbInst = true;
    }
    window.fbq('trackSingle', PIXEL_INSTITUCIONAL, 'PageView');
  } catch { /* pixel nunca trava a página */ }
}

/** Evento só no pixel institucional (ex.: Lead da lista de espera). */
export function eventoInstitucional(nome: string, dados: Record<string, any> = {}, eventId?: string) {
  try {
    if (typeof window === 'undefined' || !window.fbq || !window.__cbInst) return;
    window.fbq('trackSingle', PIXEL_INSTITUCIONAL, nome, dados, { eventID: eventId || `${nome}-${uuid()}` });
  } catch { /* nunca trava */ }
}
