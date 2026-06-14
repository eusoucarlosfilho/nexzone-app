'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

export default function BoostButton({ productId, destaqueAte, planos }: { productId: string; destaqueAte?: string | null; planos: { dias: number; valor: number; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cpf, setCpf] = useState('');
  const router = useRouter();
  const ativo = destaqueAte && new Date(destaqueAte) > new Date();

  const cpfDigits = cpf.replace(/\D/g, '');
  function formatCpf(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  async function comprar(dias: number) {
    if (cpfDigits.length !== 11) { toast('Informe um CPF válido para gerar o Pix.', 'error'); return; }
    setBusy(true);
    const r = await fetch('/api/boost/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ productId, dias, cpf: cpfDigits }),
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
        <span style={{ position: 'absolute', right: 0, top: '115%', background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 10, zIndex: 20, boxShadow: '0 10px 28px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 210 }}>
          <input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="CPF do pagador" inputMode="numeric"
            style={{ height: 38, borderRadius: 8, border: '1px solid var(--border)', padding: '0 10px', fontSize: 13, marginBottom: 2 }} />
          {planos.map((p) => (
            <button key={p.dias} className="btn btn-pri btn-sm" disabled={busy} onClick={() => comprar(p.dias)}>
              {p.label} — R$ {p.valor.toFixed(2).replace('.', ',')}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
