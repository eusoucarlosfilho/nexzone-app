'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLANOS_DESTAQUE } from '@/lib/boost';
import { toast } from '@/lib/toast';

export default function BoostButton({ productId, destaqueAte }: { productId: string; destaqueAte?: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const ativo = destaqueAte && new Date(destaqueAte) > new Date();

  async function comprar(dias: number) {
    setBusy(true);
    const r = await fetch('/api/boost/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ productId, dias }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) router.push(`/destaque/${d.boostId}`);
    else toast(d.error || 'Erro ao criar destaque', 'error');
  }

  if (ativo) return <span className="pill act" style={{ marginLeft: 4 }}>⭐ Em destaque</span>;

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setOpen(!open)}>🚀 Destacar</button>
      {open && (
        <span style={{ position: 'absolute', right: 0, top: '115%', background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 8, zIndex: 20, boxShadow: '0 10px 28px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
          {PLANOS_DESTAQUE.map((p) => (
            <button key={p.dias} className="btn btn-pri btn-sm" disabled={busy} onClick={() => comprar(p.dias)}>
              {p.label} — R$ {p.valor.toFixed(2).replace('.', ',')}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
