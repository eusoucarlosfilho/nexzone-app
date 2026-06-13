'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function SettingsForm({ settings }: any) {
  const [comissao, setComissao] = useState(String(settings.commission_percent));
  const [planos, setPlanos] = useState(settings.boost_plans.map((p: any) => ({ ...p })));
  const [suporte, setSuporte] = useState(settings.support_email || '');
  const [busy, setBusy] = useState(false);

  function setPreco(i: number, v: string) {
    setPlanos((ps: any[]) => ps.map((p, idx) => idx === i ? { ...p, valor: v } : p));
  }

  async function salvar() {
    setBusy(true);
    const r = await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        commission_percent: Number(comissao),
        boost_plans: planos.map((p: any) => ({ dias: Number(p.dias), valor: Number(p.valor), label: p.label })),
        support_email: suporte,
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) toast('Configurações salvas!', 'success');
    else toast(d.error || 'Erro ao salvar', 'error');
  }

  return (
    <div className="adm-card" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 22 }}>
        <label style={lbl}>Comissão da plataforma (%)</label>
        <input type="number" step="0.1" value={comissao} onChange={(e) => setComissao(e.target.value)} style={inp} />
        <small style={hint}>Percentual cobrado sobre cada venda. Atual: {comissao}%.</small>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={lbl}>Preços dos planos de destaque (R$)</label>
        {planos.map((p: any, i: number) => (
          <div key={p.dias} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 70, fontWeight: 700, fontFamily: 'Outfit' }}>{p.dias} dias</span>
            <input type="number" step="0.01" value={p.valor} onChange={(e) => setPreco(i, e.target.value)} style={{ ...inp, marginBottom: 0, maxWidth: 160 }} />
          </div>
        ))}
        <small style={hint}>Valores que o vendedor paga para destacar um produto.</small>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={lbl}>E-mail de suporte</label>
        <input type="email" value={suporte} onChange={(e) => setSuporte(e.target.value)} placeholder="contato@seudominio.com.br" style={inp} />
        <small style={hint}>Aparece no rodapé do site para os usuários.</small>
      </div>

      <button className="adm-btn ap" disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar configurações'}</button>
    </div>
  );
}
const lbl = { display: 'block', fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, marginBottom: 8 } as const;
const inp = { width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, marginBottom: 6, background: '#fff' } as const;
const hint = { color: 'var(--muted)', fontSize: 12 } as const;
