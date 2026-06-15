'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

function Step({ n, label, active, done }: { n: number; label: string; active?: boolean; done?: boolean }) {
  const bg = done ? 'var(--green, #00B87A)' : active ? 'var(--orange, #FF6B00)' : '#E4E4ED';
  const col = done || active ? '#fff' : '#9A9AAE';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit', fontWeight: 800, fontSize: 14 }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--text)' : 'var(--muted)', fontFamily: 'Outfit' }}>{label}</span>
    </div>
  );
}

export default function CheckoutClient({ productId, titulo, emoji, loja, preco, cor, bump, aceitaCupom, meusPontos = 0, perBrl = 100 }: any) {
  const router = useRouter();
  const [cupom, setCupom] = useState('');
  const [aplicado, setAplicado] = useState<{ codigo: string; desconto: number; final: number } | null>(null);
  const [checando, setChecando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [bumpAceito, setBumpAceito] = useState(false);
  const [erro, setErro] = useState('');

  const subtotalProduto = aplicado ? aplicado.final : preco;
  const totalBruto = subtotalProduto + (bumpAceito && bump ? Number(bump.valor) : 0);

  const [usarPontos, setUsarPontos] = useState(false);
  // valor máximo dos pontos, deixando ao menos R$1,00 para pagar via Pix
  const valorPontos = perBrl ? Math.floor((meusPontos / perBrl) * 100) / 100 : 0;
  const descontoPontos = usarPontos ? Math.max(0, Math.min(valorPontos, +(totalBruto - 1).toFixed(2))) : 0;
  const total = +(totalBruto - descontoPontos).toFixed(2);
  const podeUsarPontos = meusPontos > 0 && valorPontos >= 0.01 && totalBruto > 1;
  const accent = cor || 'var(--orange)';

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
    setErro('');
    setGerando(true);
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ productId, cupom: aplicado?.codigo || null, bump: bumpAceito, usarPontos }),
    });
    if (res.status === 401) { router.push('/login'); return; }
    const data = await res.json();
    if (!res.ok) { setGerando(false); setErro(data.error || 'Falha ao gerar o Pix.'); return; }
    router.push(`/pedido/${data.orderId}`);
  }

  return (
    <div className="card">
      {/* Etapas */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '4px 0 18px', borderBottom: '1px solid var(--border)' }}>
        <Step n={1} label="Revisar" active />
        <div style={{ flex: 1, height: 2, background: '#E4E4ED', marginTop: 14 }} />
        <Step n={2} label="Pagar" />
        <div style={{ flex: 1, height: 2, background: '#E4E4ED', marginTop: 14 }} />
        <Step n={3} label="Receber" />
      </div>

      {/* Produto */}
      <div className="li" style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <div className="em">{emoji}</div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{titulo}</strong>
          <div className="muted">{loja}</div>
        </div>
        <strong style={{ fontFamily: 'Outfit' }}>{money(preco)}</strong>
      </div>

      {aceitaCupom && (
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
      )}

      {bump && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '14px', margin: '14px 0', border: `2px dashed ${accent}`, borderRadius: 12, cursor: 'pointer', background: 'var(--soft)' }}>
          <input type="checkbox" checked={bumpAceito} onChange={(e) => setBumpAceito(e.target.checked)} style={{ marginTop: 3 }} />
          <span style={{ flex: 1 }}>
            <strong style={{ fontFamily: 'Outfit', display: 'block' }}>➕ Sim! Adicione {bump.titulo}</strong>
            <span className="muted" style={{ fontSize: 13 }}>{bump.descricao || 'Oferta especial só nesta compra.'} Por apenas <strong style={{ color: accent }}>+{money(Number(bump.valor))}</strong></span>
          </span>
        </label>
      )}

      {/* Resumo */}
      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
          <span className="muted">Subtotal</span><span>{money(preco)}</span>
        </div>
        {bumpAceito && bump && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span className="muted">+ {bump.titulo}</span><span>{money(Number(bump.valor))}</span>
          </div>
        )}
        {aplicado && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, color: 'var(--green)' }}>
            <span>Cupom {aplicado.codigo}</span><span>- {money(aplicado.desconto)}</span>
          </div>
        )}
        {descontoPontos > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, color: 'var(--green)' }}>
            <span>CB Points</span><span>- {money(descontoPontos)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Outfit', fontWeight: 900, fontSize: 20, marginTop: 8 }}>
          <span>Total</span><span>{money(total)}</span>
        </div>
      </div>

      {podeUsarPontos && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px', margin: '14px 0', border: `1.5px solid ${usarPontos ? accent : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', background: usarPontos ? 'var(--soft)' : '#fff' }}>
          <input type="checkbox" checked={usarPontos} onChange={(e) => setUsarPontos(e.target.checked)} />
          <span style={{ flex: 1 }}>
            <strong style={{ fontFamily: 'Outfit', display: 'block', fontSize: 14 }}>Usar meus CB Points</strong>
            <span className="muted" style={{ fontSize: 12.5 }}>Você tem <strong>{meusPontos}</strong> pontos (vale {money(valorPontos)}). Aplica até {money(Math.max(0, +(totalBruto - 1).toFixed(2)))} neste pedido.</span>
          </span>
        </label>
      )}

      {/* Forma de pagamento */}
      <div style={{ padding: '16px 0 4px' }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>Forma de pagamento</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', border: `2px solid ${accent}`, borderRadius: 12, background: 'var(--soft)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 2 12l10 10 10-10z" /><path d="M7 12l5 5 5-5-5-5z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontFamily: 'Outfit', fontSize: 15 }}>Pix</strong>
            <div className="muted" style={{ fontSize: 12 }}>Aprovação na hora · entrega imediata</div>
          </div>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `6px solid ${accent}`, background: '#fff' }} />
        </div>
      </div>

      {erro && (
        <div style={{ background: '#FDECEC', border: '1px solid #F5C2C2', color: '#C0392B', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '14px 0' }}>
          ⚠️ {erro}
        </div>
      )}

      <button className="btn btn-pri" style={{ width: '100%', marginTop: 16, ...(cor ? { background: cor } : {}) }} onClick={pagar} disabled={gerando}>
        {gerando ? 'Gerando Pix…' : `⚡ Pagar ${money(total)} com Pix`}
      </button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>🔒 Pagamento seguro · entrega imediata após o pagamento</p>
    </div>
  );
}
