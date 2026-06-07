'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BuyButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<string | null>(null);
  const router = useRouter();

  async function comprar() {
    setLoading(true);
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    if (res.status === 401) { router.push('/login'); return; }
    const data = await res.json();
    setPix(data.pix ?? 'Pix gerado (configure o gateway para o copia-e-cola real).');
    setLoading(false);
  }

  if (pix) return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)' }}>Pix gerado ✓</div>
      <div className="muted" style={{ maxWidth: 280, wordBreak: 'break-all', fontSize: 12 }}>{pix}</div>
    </div>
  );

  return <button className="btn btn-pri btn-lg" onClick={comprar} disabled={loading}>{loading ? 'Gerando…' : '⚡ Comprar agora'}</button>;
}
