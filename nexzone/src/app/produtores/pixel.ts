'use client';
// Pixel do Meta só da página de recrutamento (/produtores). Separado dos pixels dos vendedores.
// Cada evento leva um eventID; o servidor manda o mesmo id pela API de Conversões e o Meta não conta duas vezes.
import { uuid } from '@/lib/rastreio-cliente';

declare global { interface Window { fbq?: any; _fbq?: any; __cbRecrut?: string } }

export function iniciarPixel(id: string) {
  if (typeof window === 'undefined' || !/^\d{10,20}$/.test(id) || window.__cbRecrut === id) return;
  try {
    const w = window;
    if (!w.fbq) {
      const n: any = function (...a: any[]) { n.callMethod ? n.callMethod(...a) : n.queue.push(a); };
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      w.fbq = n; if (!w._fbq) w._fbq = n;
      const s = document.createElement('script');
      s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(s);
    }
    w.fbq('init', id);
    w.fbq('trackSingle', id, 'PageView');
    window.__cbRecrut = id;
  } catch { /* pixel nunca trava a página */ }
}

export const novoEventId = (prefixo: string) => `${prefixo}-${uuid()}`;

export function evento(nome: string, eventId?: string, dados: Record<string, any> = {}, personalizado = false) {
  try {
    if (!window.fbq || !window.__cbRecrut) return;
    const extra = eventId ? { eventID: eventId } : undefined;
    window.fbq(personalizado ? 'trackSingleCustom' : 'trackSingle', window.__cbRecrut, nome, { content_name: 'Produtor fundador', content_category: 'recrutamento_produtores', ...dados }, extra);
  } catch {}
}
