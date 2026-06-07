'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function BuyButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pago, setPago] = useState(false);
  const [conteudo, setConteudo] = useState<string | null>(null);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (data.orderId) startPolling(data.orderId);
  }

  function startPolling(orderId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/order-status?id=${orderId}`, { credentials: 'include' });
        const d = await r.json();
        if (d.status === 'pago' || d.status === 'entregue') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPago(true);
          setConteudo(d.conteudo ?? null);
        }
      } catch {}
    }, 4000);
  }

  if (pago) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', fontSize: 18 }}>✓ Pagamento confirmado!</div>
      <p className="muted" style={{ margin: '6px 0 12px' }}>Seu produto foi liberado.</p>
      {conteudo && String(conteudo).startsWith('http')
        ? <a className="btn btn-pri" href={conteudo} target="_blank" rel="noreferrer">Acessar produto</a>
        : conteudo
          ? <div className="muted" style={{ maxWidth: 320, margin: '0 auto', fontSize: 13, wordBreak: 'break-word' }}>{conteudo}</div>
          : null}
      <div><a className="btn btn-ghost btn-sm" href="/minhas-compras" style={{ marginTop: 12, display: 'inline-block' }}>Ver em Minhas Compras</a></div>
    </div>
  );

  if (pix || qr) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', marginBottom: 8 }}>Pix gerado ✓ — escaneie ou copie</div>
      {qr && <img alt="QR Pix" src={`data:image/png;base64,${qr}`} style={{ width: 180, height: 180 }} />}
      {pix && <div className="muted" style={{ maxWidth: 320, wordBreak: 'break-all', fontSize: 12, margin: '8px auto' }}>{pix}</div>}
      {pix && <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(pix)}>Copiar código Pix</button>}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Aguardando confirmação do pagamento…</p>
    </div>
  );

  return (
    <div style={{ textAlign: 'right' }}>
      <button className="btn btn-pri btn-lg" onClick={comprar} disabled={loading}>{loading ? 'Gerando…' : '⚡ Comprar agora'}</button>
      {erro && <div className="muted" style={{ color: 'var(--red)', fontSize: 12, marginTop: 8, maxWidth: 320 }}>{erro}</div>}
    </div>
  );
}
