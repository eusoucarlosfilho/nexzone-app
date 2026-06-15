'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function CBPointsClient({ pontos, perBrl, temLoja }: { pontos: number; perBrl: number; temLoja: boolean }) {
  const router = useRouter();
  const [qtd, setQtd] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Math.floor(Number(qtd) || 0);
  const valor = perBrl ? n / perBrl : 0;

  async function resgatar() {
    if (n < 100) { toast('Resgate mínimo de 100 pontos.', 'error'); return; }
    if (n > pontos) { toast('Você não tem pontos suficientes.', 'error'); return; }
    setBusy(true);
    const r = await fetch('/api/cb-points/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ pontos: n }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { toast(`Resgatado! ${money(d.valor)} adicionados ao seu saldo.`, 'success'); setQtd(''); router.refresh(); }
    else toast(d.error || 'Falha no resgate.', 'error');
  }

  if (!temLoja) {
    return (
      <div className="card" style={{ background: 'var(--soft)' }}>
        <strong style={{ fontFamily: 'Outfit' }}>Como usar seus pontos</strong>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Use seus CB Points como desconto na hora de comprar — no checkout, é só ativar a opção “Usar meus CB Points”. Cada {perBrl} pontos valem {money(1)}.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <strong style={{ fontFamily: 'Outfit' }}>Trocar pontos por saldo</strong>
      <p className="muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>Converta seus CB Points em saldo disponível para saque. Cada {perBrl} pontos = {money(1)}. Mínimo de 100 pontos.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Quantos pontos?"
          style={{ flex: '1 1 160px', height: 44, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14 }} />
        <span className="muted" style={{ fontSize: 14 }}>= <strong style={{ color: 'var(--green)' }}>{money(valor)}</strong></span>
        <button className="btn btn-pri" onClick={resgatar} disabled={busy || n < 100}>{busy ? 'Resgatando…' : 'Resgatar'}</button>
      </div>
    </div>
  );
}
