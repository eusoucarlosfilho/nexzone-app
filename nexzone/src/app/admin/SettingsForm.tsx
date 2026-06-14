'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function SettingsForm({ settings }: any) {
  const [comissao, setComissao] = useState(String(settings.commission_percent));
  const [planos, setPlanos] = useState(settings.boost_plans.map((p: any) => ({ ...p })));
  const [suporte, setSuporte] = useState(settings.support_email || '');

  const pay = settings.payment || { gateway: 'mercadopago', misticpay_ci: '', misticpay_cs_set: false };
  const [gateway, setGateway] = useState<string>(pay.gateway || 'mercadopago');
  const [ci, setCi] = useState<string>(pay.misticpay_ci || '');
  const [cs, setCs] = useState<string>('');
  const csSet = !!pay.misticpay_cs_set;

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
        payment_gateway: gateway,
        misticpay_ci: ci,
        misticpay_cs: cs, // em branco = mantém o atual
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { toast('Configurações salvas!', 'success'); setCs(''); }
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

      {/* ===== Gateway de pagamento ===== */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 22 }}>
        <label style={lbl}>Gateway de pagamento (Pix)</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {[['misticpay', 'MisticPay'], ['mercadopago', 'Mercado Pago']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => setGateway(val)}
              className="adm-btn"
              style={{
                flex: '1 1 140px',
                border: gateway === val ? '2px solid var(--orange, #FF6B00)' : '1px solid var(--border)',
                background: gateway === val ? 'var(--soft, #FFF3EC)' : '#fff',
                fontWeight: gateway === val ? 800 : 500,
              }}>
              {gateway === val ? '● ' : '○ '}{label}
            </button>
          ))}
        </div>
        <small style={hint}>Gateway usado para gerar os Pix do checkout e dos destaques. Ativo: <strong>{gateway === 'misticpay' ? 'MisticPay' : 'Mercado Pago'}</strong>.</small>
      </div>

      {gateway === 'misticpay' && (
        <div style={{ marginBottom: 22, padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--soft, #FAFAFA)' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>MisticPay — Client ID (ci)</label>
            <input value={ci} onChange={(e) => setCi(e.target.value)} placeholder="seu_client_id" style={inp} autoComplete="off" />
          </div>
          <div>
            <label style={lbl}>MisticPay — Client Secret (cs)</label>
            <input type="password" value={cs} onChange={(e) => setCs(e.target.value)}
              placeholder={csSet ? '•••••••••• (já cadastrado — deixe em branco para manter)' : 'seu_client_secret'}
              style={inp} autoComplete="off" />
            <small style={hint}>
              {csSet
                ? 'Secret já cadastrado. Só preencha se quiser substituí-lo.'
                : 'Cole o Client Secret gerado no painel da MisticPay. Fica guardado de forma segura no servidor.'}
            </small>
          </div>
          <small style={{ ...hint, display: 'block', marginTop: 10 }}>
            ⚙️ Configure o webhook na MisticPay para: <code>{(typeof window !== 'undefined' ? window.location.origin : '')}/api/webhooks/payment</code>
          </small>
        </div>
      )}

      <button className="adm-btn ap" disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar configurações'}</button>
    </div>
  );
}
const lbl = { display: 'block', fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, marginBottom: 8 } as const;
const inp = { width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, marginBottom: 6, background: '#fff' } as const;
const hint = { color: 'var(--muted)', fontSize: 12 } as const;
