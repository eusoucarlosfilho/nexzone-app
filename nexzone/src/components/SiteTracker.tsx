'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Rastreador anônimo de audiência (sem IP, sem cookies).
 * - vid: id persistente do visitante (localStorage)
 * - sid: id da sessão desta aba (sessionStorage), renovado após 30 min parado
 * Envia 'view' a cada troca de rota e 'ping' a cada 30 s com a aba visível.
 */
const SID_KEY = 'cb_sid';
const VID_KEY = 'cb_vid';
const IDLE_MS = 30 * 60 * 1000;
const PING_MS = 30 * 1000;

let memVid: string | null = null;
let memSid: { id: string; t: number } | null = null;

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function getVid(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) { v = uuid(); localStorage.setItem(VID_KEY, v); }
    return v;
  } catch {
    if (!memVid) memVid = uuid();
    return memVid;
  }
}

/** Retorna o sid atual e se ele acabou de ser criado (sessão nova). */
function getSid(): { sid: string; fresh: boolean } {
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

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // Blob com o JSON; tipo text/plain evita preflight/bloqueio de sendBeacon em alguns navegadores.
      // O servidor faz JSON.parse do texto, então o conteúdo continua sendo JSON.
      const ok = navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      if (ok) return;
    }
    fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch {}
}

const skip = (p: string | null) => !p || p.startsWith('/admin') || p.startsWith('/api');

export default function SiteTracker() {
  const pathname = usePathname();
  const pathRef = useRef<string | null>(null);
  const lastSent = useRef<string | null>(null);

  function view(path: string) {
    const { sid } = getSid();
    send({ sid, vid: getVid(), path, ref: typeof document !== 'undefined' ? document.referrer || '' : '', type: 'view' });
  }

  function ping() {
    const path = pathRef.current;
    if (skip(path) || document.visibilityState !== 'visible') return;
    const { sid, fresh } = getSid();
    // Sessão expirou por inatividade: abre uma nova com 'view'
    if (fresh) send({ sid, vid: getVid(), path, ref: '', type: 'view' });
    else send({ sid, vid: getVid(), path, type: 'ping' });
  }

  useEffect(() => {
    pathRef.current = pathname;
    if (lastSent.current === pathname) return; // evita duplicar no StrictMode
    lastSent.current = pathname;
    if (skip(pathname)) return;
    view(pathname!);
  }, [pathname]);

  useEffect(() => {
    const id = window.setInterval(ping, PING_MS);
    const onVis = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
