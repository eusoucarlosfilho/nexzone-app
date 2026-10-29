'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// Liga a notificação na tela do celular (Web Push) NESTE aparelho.
// iPhone: só funciona com o app instalado na tela de início (iOS 16.4+) e aberto pelo ícone.
type Estado = 'carregando' | 'sem-suporte' | 'instalar-iphone' | 'desligado' | 'bloqueado' | 'ligado' | 'indisponivel';

const b64 = (s: string) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function registro() {
  const r = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  await navigator.serviceWorker.ready;
  return r;
}

export default function AtivarCelular({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [ocupado, setOcupado] = useState(false);
  // no topo do painel (compacto) o aviso pode ser recolhido; a página Notificações sempre mostra
  const [recolhido, setRecolhido] = useState(true);
  useEffect(() => { try { setRecolhido(localStorage.getItem('cb_aviso_celular') === '1'); } catch { setRecolhido(false); } }, []);
  const recolher = () => { setRecolhido(true); try { localStorage.setItem('cb_aviso_celular', '1'); } catch {} };

  const verificar = useCallback(async () => {
    try {
      const ua = navigator.userAgent || '';
      const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      const instalado = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      if (ios && !instalado) return setEstado('instalar-iphone');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setEstado('sem-suporte');
      const g = await fetch('/api/push', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (!g?.ativo) return setEstado('indisponivel');
      if (Notification.permission === 'denied') return setEstado('bloqueado');
      const r = await navigator.serviceWorker.getRegistration('/');
      const s = r ? await r.pushManager.getSubscription() : null;
      setEstado(s && Notification.permission === 'granted' ? 'ligado' : 'desligado');
    } catch { setEstado('sem-suporte'); }
  }, []);
  useEffect(() => { verificar(); }, [verificar]);

  async function ligar() {
    setOcupado(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setEstado(perm === 'denied' ? 'bloqueado' : 'desligado'); return; }
      const g = await fetch('/api/push', { cache: 'no-store' }).then((r) => r.json());
      if (!g?.publica) { setEstado('indisponivel'); return; }
      const reg = await registro();
      let s = await reg.pushManager.getSubscription();
      if (!s) s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(g.publica) });
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.toJSON()) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível ativar.', 'error'); return; }
      setEstado('ligado');
      toast('Notificações ligadas neste aparelho.', 'success');
      await fetch('/api/push/teste', { method: 'POST' }).catch(() => null);
    } catch {
      toast('Não foi possível ativar neste navegador.', 'error');
    } finally { setOcupado(false); }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const r = await navigator.serviceWorker.getRegistration('/');
      const s = r ? await r.pushManager.getSubscription() : null;
      if (s) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) }).catch(() => null);
        await s.unsubscribe().catch(() => null);
      }
      setEstado('desligado');
    } finally { setOcupado(false); }
  }

  async function testar() {
    setOcupado(true);
    try {
      const r = await fetch('/api/push/teste', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      toast(r.ok ? 'Teste enviado. Olhe a tela do celular.' : j.error || 'Não foi possível enviar.', r.ok ? 'success' : 'error');
    } finally { setOcupado(false); }
  }

  if (estado === 'carregando' || estado === 'indisponivel') return null;
  if (compacto && (estado === 'ligado' || recolhido)) return null;

  return (
    <div className="ac-box" role="region" aria-label="Notificações no celular">
      <style dangerouslySetInnerHTML={{ __html: `
        .ac-box{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#16162A;color:#fff;border-radius:16px;padding:16px 18px;margin-bottom:18px}
        .ac-box b{font-family:'Outfit';font-size:15.5px;display:block;margin-bottom:3px}
        .ac-box p{margin:0;font-size:13.5px;line-height:1.5;opacity:.85;max-width:520px}
        .ac-box .ac-b{display:flex;gap:8px;flex-wrap:wrap}
        .ac-box button{border:0;border-radius:50px;padding:10px 18px;font-weight:800;font-family:'Outfit';font-size:14px;cursor:pointer}
        .ac-box .ac-pri{background:#FF6B00;color:#16162A}
        .ac-box .ac-sec{background:rgba(255,255,255,.12);color:#fff}
        .ac-box button:disabled{opacity:.6;cursor:default}
        .ac-box .ac-fechar{background:none;color:#fff;opacity:.7;padding:10px 12px;font-family:'Nunito';font-weight:700;font-size:13px}
      ` }} />
      <div style={{ flex: '1 1 260px' }}>
        {estado === 'ligado' && <><b>🔔 Notificações ligadas neste aparelho</b><p>Vendas, mensagens, perguntas e avisos chegam na tela, mesmo com o site fechado.</p></>}
        {estado === 'desligado' && <><b>🔔 Receba as vendas na tela do celular</b><p>Venda, mensagem de cliente e aviso chegam na hora, como notificação de app, mesmo com o site fechado.</p></>}
        {estado === 'bloqueado' && <><b>Notificações bloqueadas neste navegador</b><p>Libere em Configurações do celular → Notificações → Comprei Barato (ou no cadeado ao lado do endereço do site) e volte aqui.</p></>}
        {estado === 'instalar-iphone' && <><b>No iPhone, instale o app primeiro</b><p>Toque em Compartilhar (quadrado com a seta) → <strong>Adicionar à Tela de Início</strong>. Depois abra o Comprei Barato pelo ícone e ative aqui. Precisa do iOS 16.4 ou mais novo.</p></>}
        {estado === 'sem-suporte' && <><b>Este navegador não recebe notificações</b><p>No Android, use o Chrome. No iPhone, instale o app na tela de início e abra por ele.</p></>}
      </div>
      <div className="ac-b">
        {estado === 'desligado' && <button className="ac-pri" disabled={ocupado} onClick={ligar}>{ocupado ? 'Ativando…' : 'Ativar notificações'}</button>}
        {estado === 'ligado' && <><button className="ac-pri" disabled={ocupado} onClick={testar}>Enviar teste</button><button className="ac-sec" disabled={ocupado} onClick={desligar}>Desligar</button></>}
        {estado === 'bloqueado' && <button className="ac-sec" onClick={verificar}>Já liberei</button>}
        {compacto && <button className="ac-fechar" onClick={recolher} title="Dá para ativar depois em Notificações">{estado === 'instalar-iphone' ? 'Já fiz, ocultar' : 'Agora não'}</button>}
      </div>
    </div>
  );
}
