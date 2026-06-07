'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BuyButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
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
    setLoading(false);
    if (!res.ok) { setErro(data.error || 'Falha ao gerar o Pix.'); return; }
    setPix(data.pix ?? null); setQr(data.qr ?? null);
  }

  if (pix || qr) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', marginBottom: 8 }}>Pix gerado ✓ — escaneie ou copie</div>
      {qr && <img alt="QR Pix" src={`data:image/png;base64,${qr}`} style={{ width: 180, height: 180 }} />}
      {pix && <div className="muted" style={{ maxWidth: 320, wordBreak: 'break-all', fontSize: 12, margin: '8px auto' }}>{pix}</div>}
      {pix && <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(pix)}>Copiar código Pix</button>}
    </div>
  );

  return (
    <div style={{ textAlign: 'right' }}>
      <button className="btn btn-pri btn-lg" onClick={comprar} disabled={loading}>{loading ? 'Gerando…' : '⚡ Comprar agora'}</button>
      {erro && <div className="muted" style={{ color: 'var(--red)', fontSize: 12, marginTop: 8, maxWidth: 320 }}>{erro}</div>}
    </div>
  );
}
