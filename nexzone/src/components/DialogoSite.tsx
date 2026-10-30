'use client';
import { useEffect, useRef, useState } from 'react';

// Janela de confirmação do próprio site (no lugar do prompt/confirm do navegador).
// Com `campo`, pede um texto (ex.: motivo do cancelamento) e só libera o botão com o mínimo de letras.
export default function DialogoSite({ aberto, titulo, texto, campo, confirmar = 'Confirmar', cancelar = 'Voltar', perigo = false, carregando = false, onConfirmar, onFechar }: {
  aberto: boolean;
  titulo: string;
  texto?: React.ReactNode;
  campo?: { rotulo: string; placeholder?: string; minimo?: number; dica?: string };
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
  carregando?: boolean;
  onConfirmar: (valor: string) => void;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setValor('');
    const t = setTimeout(() => (campo ? ref.current?.focus() : btn.current?.focus()), 30);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !carregando) onFechar(); };
    window.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); window.removeEventListener('keydown', esc); document.body.style.overflow = overflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!aberto) return null;
  const minimo = campo?.minimo ?? 0;
  const ok = !campo || valor.trim().length >= minimo;
  const cor = perigo ? '#D92D20' : '#FF6B00';

  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !carregando) onFechar(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(16,16,32,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dlg-titulo"
        style={{ width: '100%', maxWidth: 440, background: '#fff', color: '#1A1A2E', borderRadius: 18, boxShadow: '0 24px 60px rgba(16,16,32,.3)', padding: '20px 20px 16px', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}>
        <h3 id="dlg-titulo" style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 18, margin: '0 0 6px' }}>{titulo}</h3>
        {texto && <div style={{ fontSize: 14, color: '#5A5A70', lineHeight: 1.5 }}>{texto}</div>}
        {campo && (
          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{campo.rotulo}</span>
            <textarea ref={ref} value={valor} onChange={(e) => setValor(e.target.value)} placeholder={campo.placeholder} rows={3} maxLength={500}
              style={{ width: '100%', border: '1.5px solid #E4E4EC', borderRadius: 12, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            <small style={{ display: 'block', fontSize: 12, color: '#8A8A9E', marginTop: 4 }}>
              {campo.dica || ''}{minimo > 0 && valor.trim().length < minimo ? `${campo.dica ? ' · ' : ''}mínimo de ${minimo} letras` : ''}
            </small>
          </label>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, flexWrap: 'wrap-reverse' }}>
          <button type="button" onClick={onFechar} disabled={carregando}
            style={{ height: 44, padding: '0 18px', borderRadius: 12, border: '1.5px solid #E4E4EC', background: '#fff', fontWeight: 800, fontFamily: 'Outfit', cursor: 'pointer', color: '#1A1A2E' }}>{cancelar}</button>
          <button ref={btn} type="button" onClick={() => ok && !carregando && onConfirmar(valor.trim())} disabled={!ok || carregando}
            style={{ height: 44, padding: '0 18px', borderRadius: 12, border: 0, background: cor, color: '#fff', fontWeight: 800, fontFamily: 'Outfit', cursor: ok && !carregando ? 'pointer' : 'not-allowed', opacity: ok && !carregando ? 1 : 0.5 }}>
            {carregando ? 'Aguarde…' : confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
