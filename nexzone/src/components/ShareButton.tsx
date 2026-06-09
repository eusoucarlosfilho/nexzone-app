'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function ShareButton({ titulo, full }: { titulo: string; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const url = () => (typeof window !== 'undefined' ? window.location.href : '');

  function copiar() { navigator.clipboard.writeText(url()); toast('Link copiado!', 'success'); setOpen(false); }
  function whats() {
    const txt = encodeURIComponent(`Olha esse produto: ${titulo}\n${url()}`);
    window.open(`https://wa.me/?text=${txt}`, '_blank');
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', marginTop: full ? 12 : 0 }}>
      <button className="btn btn-ghost" style={{ width: full ? '100%' : 'auto' }} onClick={() => setOpen(!open)}>🔗 Compartilhar</button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, right: full ? 0 : 'auto', minWidth: 180, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.14)', padding: 8, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={whats}>📱 Enviar no WhatsApp</button>
          <button className="btn btn-ghost btn-sm" onClick={copiar}>📋 Copiar link</button>
        </div>
      )}
    </div>
  );
}
