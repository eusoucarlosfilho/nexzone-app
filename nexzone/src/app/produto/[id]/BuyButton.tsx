'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BuyButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function comprar() {
    setLoading(true); setErro(null);
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId }),
    });
    if (res.status === 401) { router.push('/login'); return; }
    const data = await res.json();
    if (!res.ok) { setLoading(false); setErro(data.error || 'Falha ao gerar o Pix.'); return; }
    router.push(`/pedido/${data.orderId}`);
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <button className="btn btn-pri btn-lg" onClick={comprar} disabled={loading}>{loading ? 'Gerando…' : '⚡ Comprar agora'}</button>
      {erro && <div className="muted" style={{ color: 'var(--red)', fontSize: 12, marginTop: 8, maxWidth: 320 }}>{erro}</div>}
    </div>
  );
}
