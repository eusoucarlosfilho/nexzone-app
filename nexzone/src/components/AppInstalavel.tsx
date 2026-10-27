'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Icon from './Icon';

// App instalável (Fase B): registra o service worker e guarda o convite de instalação do navegador.
// <RegistrarApp /> vai uma vez no layout; <BotaoInstalarApp /> pode aparecer em vários lugares.

let convite: any = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
function assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

export function RegistrarApp() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (location.hostname === 'localhost' && !location.search.includes('sw=1')) return; // em desenvolvimento não registra
    const registrar = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    if (document.readyState === 'complete') registrar(); else window.addEventListener('load', registrar, { once: true });
    const aoConvite = (e: Event) => { e.preventDefault(); convite = e; avisar(); };
    const aoInstalar = () => { convite = null; avisar(); try { localStorage.setItem('cb_app_instalado', '1'); } catch {} };
    window.addEventListener('beforeinstallprompt', aoConvite);
    window.addEventListener('appinstalled', aoInstalar);
    return () => { window.removeEventListener('beforeinstallprompt', aoConvite); window.removeEventListener('appinstalled', aoInstalar); };
  }, []);
  return null;
}

function ambiente() {
  if (typeof window === 'undefined') return { standalone: false, ios: false };
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
  return { standalone, ios };
}

/** Botão "Instalar app". Android/Chrome: abre o convite do navegador. iPhone: mostra o passo a passo. */
export function BotaoInstalarApp({ className = 'btn btn-ghost btn-sm', rotulo = 'Instalar o app', compacto = false }: { className?: string; rotulo?: string; compacto?: boolean }) {
  const temConvite = useSyncExternalStore(assinar, () => !!convite, () => false);
  const [env, setEnv] = useState({ standalone: false, ios: false, pronto: false });
  const [ajuda, setAjuda] = useState(false);
  useEffect(() => { setEnv({ ...ambiente(), pronto: true }); }, []);
  if (!env.pronto || env.standalone) return null;
  if (!temConvite && !env.ios) return null;

  async function instalar() {
    if (convite) {
      convite.prompt();
      try { await convite.userChoice; } catch {}
      convite = null; avisar();
    } else setAjuda(true);
  }
  return (
    <>
      <button type="button" className={className} onClick={instalar}><Icon name="download" size={compacto ? 18 : 16} /> {rotulo}</button>
      {ajuda && (
        <div role="dialog" aria-modal="true" aria-label="Como instalar no iPhone" onClick={() => setAjuda(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(22,22,42,.5)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 20, maxWidth: 420, width: '100%', marginBottom: 'env(safe-area-inset-bottom)' }}>
            <b style={{ fontFamily: 'Outfit', fontSize: 18, display: 'block', marginBottom: 8 }}>Instale o Comprei Barato no iPhone</b>
            <ol style={{ margin: '0 0 14px', paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
              <li>Abra este site no <b>Safari</b>.</li>
              <li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
              <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
            </ol>
            <button type="button" className="btn btn-pri" style={{ width: '100%' }} onClick={() => setAjuda(false)}>Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}
