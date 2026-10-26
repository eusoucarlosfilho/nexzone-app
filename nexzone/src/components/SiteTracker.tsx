'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { enviar, getSid, getVid, registrarOrigem } from '@/lib/rastreio-cliente';

/**
 * Rastreador anônimo de audiência (sem IP, sem cookies).
 * - vid: id persistente do visitante (localStorage)
 * - sid: id da sessão desta aba (sessionStorage), renovado após 30 min parado
 * Envia 'view' a cada troca de rota e 'ping' a cada 30 s com a aba visível.
 * V3: na visita, envia só as 4 chaves UTM (nunca a URL com parâmetros) e o endereço de origem.
 */
const PING_MS = 30 * 1000;

const skip = (p: string | null) => !p || p.startsWith('/admin') || p.startsWith('/api');

export default function SiteTracker() {
  const pathname = usePathname();
  const pathRef = useRef<string | null>(null);
  const lastSent = useRef<string | null>(null);

  function view(path: string) {
    const utm = registrarOrigem(path);
    const { sid } = getSid();
    enviar({ sid, vid: getVid(), path, ref: typeof document !== 'undefined' ? document.referrer || '' : '', utm, type: 'view' });
  }

  function ping() {
    const path = pathRef.current;
    if (skip(path) || document.visibilityState !== 'visible') return;
    const { sid, fresh } = getSid();
    // Sessão expirou por inatividade: abre uma nova com 'view'
    if (fresh) enviar({ sid, vid: getVid(), path, ref: '', type: 'view' });
    else enviar({ sid, vid: getVid(), path, type: 'ping' });
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
