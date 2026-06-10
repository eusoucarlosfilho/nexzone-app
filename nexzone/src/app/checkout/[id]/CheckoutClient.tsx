'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function CheckoutClient({ productId, titulo, emoji, loja, preco }: any) {
  const router = useRouter();
  const [cupom, setCupom] = useState('');
  const [aplicado, setAplicado] = useState<{ codigo: string; desconto: number; final: number } | null>(null);
  const [checando, setChecando] = useState(false);
  const [gerando, setGerando] = useState(false);

  const total = aplicado ? aplicado.final : preco;

  async function aplicarCupom() {
    if (!cupom.trim()) return;
    setChecando(true);
    const r = await fetch('/api/coupon/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ codigo: cupom, productId }),
    });
    const d = await r.json();
    setChecando(false);
    if (r.ok) { setAplicado({ codigo: d.codigo, desconto: d.desconto, final: d.final }); toast('Cupom aplicado!', 'success'); }
    else { setAplicado(null); toast(d.error || 'Cupom inválido', 'error'); }
  }

  async function pagar() {
    setGerando(true);
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ productId, cupom: aplicado?.codigo || null }),
    });
    if (res.status === 401) { router.push('/login'); return; }
    const data = await res.json();
    if (!res.ok) { setGerando(false); toast(data.error || 'Falha ao gerar o Pix.', 'error'); return; }
    router.push(`/pedido/${data.orderId}`);
  }

  return (
    <div className="card">
      <div className="li" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="em">{emoji}</div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{titulo}</strong>
          <div className="muted">{loja}</div>
        </div>
      </div>

      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>Tem um cupom?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} placeholder="CUPOM" disabled={!!aplicado}
            style={{ flex: 1, height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, textTransform: 'uppercase' }} />
          {aplicado
            ? <button className="btn btn-ghost btn-sm" onClick={() => { setAplicado(null); setCupom(''); }}>Remover</button>
            : <button className="btn btn-dark btn-sm" onClick={aplicarCupom} disabled={checando}>{checando ? '…' : 'Aplicar'}</button>}
        </div>
      </div>

      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
          <span className="muted">Subtotal</span><span>{money(preco)}</span>
        </div>
        {aplicado && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, color: 'var(--green)' }}>
            <span>Cupom {aplicado.codigo}</span><span>- {money(aplicado.desconto)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Outfit', fontWeight: 900, fontSize: 20, marginTop: 8 }}>
          <span>Total</span><span>{money(total)}</span>
        </div>
      </div>

      <button className="btn btn-pri" style={{ width: '100%' }} onClick={pagar} disabled={gerando}>
        {gerando ? 'Gerando Pix…' : '⚡ Pagar com Pix'}
      </button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>🔒 Pagamento seguro · entrega imediata após o pagamento</p>
    </div>
  );
}
