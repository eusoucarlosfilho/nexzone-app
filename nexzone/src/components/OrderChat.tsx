'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

type Msg = { id: string; papel: string; texto: string; created_at: string; mine: boolean };

const hora = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function OrderChat({ orderId, theme = 'light', readOnly = false }: { orderId: string; theme?: 'light' | 'dark'; readOnly?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const dark = theme === 'dark';
  const C = {
    panel: dark ? '#16161F' : '#fff',
    bd: dark ? '#2A2A3A' : '#ECECF2',
    tx: dark ? '#EDEDF5' : '#1A1A2E',
    sub: dark ? '#9292AC' : '#8A8A9E',
    bubbleOther: dark ? '#1C1C28' : '#F1F1F6',
    inputBg: dark ? '#1C1C28' : '#fff',
  };

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat?orderId=${orderId}`, { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      setMsgs(d.messages || []);
      setCarregou(true);
    } catch {}
  }, [orderId]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTexto('');
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ orderId, texto: t }),
      });
      const d = await r.json();
      if (r.ok && d.message) setMsgs((m) => [...m, d.message]);
      else setTexto(t);
    } catch { setTexto(t); }
    finally { setEnviando(false); }
  }

  return (
    <div style={{ border: `1px solid ${C.bd}`, borderRadius: 14, overflow: 'hidden', background: C.panel }}>
      <div ref={boxRef} style={{ maxHeight: 360, minHeight: 180, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!carregou && <p style={{ color: C.sub, fontSize: 13, textAlign: 'center', margin: 'auto' }}>Carregando conversa…</p>}
        {carregou && msgs.length === 0 && <p style={{ color: C.sub, fontSize: 13, textAlign: 'center', margin: 'auto' }}>Nenhuma mensagem ainda. Diga olá! 👋</p>}
        {msgs.map((m) => {
          if (m.papel === 'sistema') {
            return (
              <div key={m.id} style={{ textAlign: 'center', margin: '4px 0' }}>
                <span style={{ display: 'inline-block', background: dark ? '#1C1C28' : '#F4F4F8', color: C.sub, fontSize: 12, padding: '6px 12px', borderRadius: 10, maxWidth: '85%' }}>{m.texto}</span>
              </div>
            );
          }
          const own = m.mine;
          const bg = own ? 'linear-gradient(135deg,#FF6B00,#FF9A3C)' : C.bubbleOther;
          const col = own ? '#fff' : C.tx;
          const tag = m.papel === 'admin' ? 'Suporte' : m.papel === 'vendedor' ? 'Vendedor' : 'Cliente';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start' }}>
              <div style={{ fontSize: 10, color: C.sub, margin: '0 6px 3px', fontWeight: 700 }}>{own ? 'Você' : tag}</div>
              <div style={{ background: bg, color: col, padding: '9px 13px', borderRadius: own ? '14px 14px 4px 14px' : '14px 14px 14px 4px', maxWidth: '78%', fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.texto}</div>
              <div style={{ fontSize: 10, color: C.sub, margin: '3px 6px 0' }}>{hora(m.created_at)}</div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${C.bd}` }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Escreva uma mensagem…"
            style={{ flex: 1, height: 42, borderRadius: 10, border: `1px solid ${C.bd}`, background: C.inputBg, color: C.tx, padding: '0 14px', fontSize: 14, outline: 'none' }}
          />
          <button onClick={enviar} disabled={enviando || !texto.trim()}
            style={{ height: 42, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontFamily: 'Outfit', color: '#fff', background: 'linear-gradient(135deg,#FF6B00,#FF9A3C)', opacity: enviando || !texto.trim() ? 0.6 : 1 }}>
            {enviando ? '…' : 'Enviar'}
          </button>
        </div>
      )}
    </div>
  );
}
