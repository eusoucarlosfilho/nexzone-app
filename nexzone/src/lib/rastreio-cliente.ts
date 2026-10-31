'use client';
// Rastreamento anônimo no navegador (V3). Compartilhado pelo SiteTracker e pelos eventos de funil.
// - vid: id anônimo persistente (localStorage) · sid: id da sessão da aba (sessionStorage, 30 min parado)
// - Sem cookies, sem IP no cliente, sem gravação de tela, sem conteúdo de campos.
// - Origem (UTM) "primeiro toque": só as 4 chaves UTM + domínio de referência + página de entrada, por 30 dias.
import { utmDe, hostDe, type NomeEvento, type PropsEvento, type Utm } from './eventos';

const SID_KEY = 'cb_sid';
const VID_KEY = 'cb_vid';
const ORIGEM_KEY = 'cb_origem';
const IDLE_MS = 30 * 60 * 1000;
const ORIGEM_MS = 30 * 24 * 3600 * 1000;

let memVid: string | null = null;
let memSid: { id: string; t: number } | null = null;

export function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getVid(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) { v = uuid(); localStorage.setItem(VID_KEY, v); }
    return v;
  } catch {
    if (!memVid) memVid = uuid();
    return memVid;
  }
}

/** Sid atual e se acabou de ser criado (sessão nova). */
export function getSid(): { sid: string; fresh: boolean } {
  const now = Date.now();
  let cur: { id: string; t: number } | null = null;
  try {
    const raw = sessionStorage.getItem(SID_KEY);
    if (raw) cur = JSON.parse(raw);
  } catch { cur = memSid; }
  let fresh = false;
  if (!cur || typeof cur.id !== 'string' || !cur.t || now - cur.t > IDLE_MS) {
    cur = { id: uuid(), t: now };
    fresh = true;
  } else {
    cur = { id: cur.id, t: now };
  }
  memSid = cur;
  try { sessionStorage.setItem(SID_KEY, JSON.stringify(cur)); } catch {}
  return { sid: cur.id, fresh };
}

export function enviar(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      if (ok) return;
    }
    fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch {}
}

export type Origem = Utm & { ref?: string; entrada?: string; t?: number };

/** Lê a origem "primeiro toque" guardada (ou null). */
export function origemGuardada(): Origem | null {
  try {
    const raw = localStorage.getItem(ORIGEM_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || !o.t || Date.now() - o.t > ORIGEM_MS) return null;
    return o as Origem;
  } catch { return null; }
}

/**
 * Registra a origem da visita. Campanha nova (com UTM) substitui a anterior; sem UTM,
 * só grava se ainda não houver origem. Retorna as UTMs da URL atual (para a sessão).
 */
export function registrarOrigem(path: string): Utm {
  if (typeof window === 'undefined') return {};
  let utm = utmDe(window.location.search || '');
  // Link de indicação (?ref=CODIGO): vira a origem "indicação" (só quando o link não traz UTM própria)
  const ind = codigoIndicacaoDaUrl(window.location.search || '');
  if (ind) {
    guardarIndicacao(ind);
    if (!Object.keys(utm).length) utm = { utm_source: 'indicacao', utm_medium: 'link', utm_content: ind.toLowerCase() };
  }
  try {
    const atual = origemGuardada();
    const temUtm = Object.keys(utm).length > 0;
    if (temUtm || !atual) {
      const ref = hostDe(document.referrer || '');
      const proprio = window.location.hostname.replace(/^www\./, '');
      const o: Origem = { ...utm, t: Date.now(), entrada: (path || '/').split('?')[0].slice(0, 120) };
      if (ref && ref !== proprio) o.ref = ref;
      if (temUtm || o.ref || !atual) localStorage.setItem(ORIGEM_KEY, JSON.stringify(o));
    }
  } catch {}
  return utm;
}

const pular = (p: string) => !p || p.startsWith('/admin') || p.startsWith('/api');

// Evita disparos repetidos do mesmo evento (cliques duplos, re-render): 1,5 s por nome+chave.
const recentes = new Map<string, number>();

/** Envia um evento de funil anônimo. Nunca lança. */
export function trackEvento(nome: NomeEvento, props: PropsEvento = {}) {
  try {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname || '/';
    if (pular(path)) return;
    const chave = nome + '|' + JSON.stringify(props);
    const agora = Date.now();
    if ((recentes.get(chave) || 0) > agora - 1500) return;
    recentes.set(chave, agora);
    if (recentes.size > 50) recentes.clear();
    const { sid } = getSid();
    enviar({ type: 'event', sid, vid: getVid(), path, nome, props });
  } catch {}
}

// ---------- Indicação de compradores ----------
const IND_KEY = 'cb_indicacao';
const IND_MS = 30 * 24 * 3600 * 1000; // o convite vale 30 dias neste navegador
const COD = /^[A-Z2-9]{8}$/;

/** Código do link ?ref= (8 caracteres, letras maiúsculas e dígitos 2-9). Qualquer outra coisa é ignorada. */
export function codigoIndicacaoDaUrl(search: string): string | null {
  try { const c = String(new URLSearchParams(search).get('ref') || '').trim().toUpperCase(); return COD.test(c) ? c : null; } catch { return null; }
}
/** Guarda o convite (o primeiro vale: outro link depois não troca quem indicou). */
export function guardarIndicacao(codigo: string) {
  try {
    const atual = indicacaoGuardada();
    if (atual) return;
    localStorage.setItem(IND_KEY, JSON.stringify({ c: codigo, t: Date.now() }));
  } catch {}
}
export function indicacaoGuardada(): string | null {
  try {
    const o = JSON.parse(localStorage.getItem(IND_KEY) || 'null');
    if (!o || !COD.test(o.c) || !o.t || Date.now() - o.t > IND_MS) return null;
    return o.c;
  } catch { return null; }
}
export function limparIndicacao() { try { localStorage.removeItem(IND_KEY); } catch {} }
