'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function SettingsForm({ settings }: any) {
  const [comissao, setComissao] = useState(String(settings.commission_percent));
  const [planos, setPlanos] = useState(settings.boost_plans.map((p: any) => ({ ...p })));
  const [suporte, setSuporte] = useState(settings.support_email || '');

  const [ptCompra, setPtCompra] = useState(String(settings.cb_points_per_purchase ?? 3));
  const [ptBrl, setPtBrl] = useState(String(settings.cb_points_per_brl ?? 100));
  const [ptBonus, setPtBonus] = useState(String(settings.cb_points_review_bonus ?? 3));
  const [janela, setJanela] = useState(String(settings.review_window_days ?? 5));
  const [rapido, setRapido] = useState(String(settings.fast_release_days ?? 1));

  const pay = settings.payment || { gateway: 'mercadopago', misticpay_ci: '', misticpay_cs_set: false };
  const [gateway, setGateway] = useState<string>(pay.gateway || 'mercadopago');
  const [ci, setCi] = useState<string>(pay.misticpay_ci || '');
  const [cs, setCs] = useState<string>('');
  const csSet = !!pay.misticpay_cs_set;

  const [busy, setBusy] = useState(false);

  // ===== Administradores =====
  const [admins, setAdmins] = useState<any[]>(settings.admins || []);
  const [novoAdmin, setNovoAdmin] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);

  async function setAdminRole(email: string, action: 'promote' | 'demote') {
    setAdminBusy(true);
    const r = await fetch('/api/admin/set-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email, action }),
    });
    const d = await r.json();
    setAdminBusy(false);
    if (!r.ok) { toast(d.error || 'Erro ao atualizar admin', 'error'); return; }
    if (action === 'promote') {
      toast('Administrador adicionado!', 'success');
      if (!admins.some((a) => (a.email || '').toLowerCase() === email.toLowerCase())) {
        setAdmins((a) => [...a, { id: 'novo-' + email, email }]);
      }
      setNovoAdmin('');
    } else {
      toast('Administrador removido.', 'success');
      setAdmins((a) => a.filter((x) => (x.email || '').toLowerCase() !== email.toLowerCase()));
    }
  }

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
        cb_points_per_purchase: Number(ptCompra),
        cb_points_per_brl: Number(ptBrl),
        cb_points_review_bonus: Number(ptBonus),
        review_window_days: Number(janela),
        fast_release_days: Number(rapido),
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

      {/* ===== CB Points e liberação de saldo ===== */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 22 }}>
        <label style={lbl}>CB Points</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px' }}>
            <small style={hint}>Pontos por compra (cliente e vendedor)</small>
            <input type="number" step="1" value={ptCompra} onChange={(e) => setPtCompra(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <small style={hint}>Bônus por avaliar</small>
            <input type="number" step="1" value={ptBonus} onChange={(e) => setPtBonus(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <small style={hint}>Pontos por R$ 1,00</small>
            <input type="number" step="1" value={ptBrl} onChange={(e) => setPtBrl(e.target.value)} style={inp} />
          </div>
        </div>
        <small style={hint}>
          Valor atual: <strong>{Number(ptBrl) ? `${(1000)} pontos = R$ ${(1000 / Number(ptBrl)).toFixed(2).replace('.', ',')}` : '—'}</strong>. Cada compra dá {ptCompra} pontos para os dois lados.
        </small>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 22 }}>
        <label style={lbl}>Liberação de saldo do vendedor</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <small style={hint}>Dias para liberar (janela de reclamação)</small>
            <input type="number" step="1" value={janela} onChange={(e) => setJanela(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <small style={hint}>Dias quando há avaliação positiva (libera mais rápido)</small>
            <input type="number" step="1" value={rapido} onChange={(e) => setRapido(e.target.value)} style={inp} />
          </div>
        </div>
        <small style={hint}>O cliente tem {janela} dias para reclamar. Com avaliação positiva (4-5★), o saldo libera em {rapido} dia(s). Reclamação aberta segura o saldo até ser resolvida.</small>
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

      {/* ===== Administradores ===== */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 22 }}>
        <label style={lbl}>Administradores</label>
        <small style={hint}>Quem tem acesso total a este painel. A pessoa precisa <strong>já ter conta</strong> no site (criar com o e-mail dela primeiro).</small>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {admins.length ? admins.map((a: any) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--soft)', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ flex: 1, fontSize: 13, wordBreak: 'break-all' }}>{a.email}</span>
              <button type="button" className="adm-btn" disabled={adminBusy} onClick={() => setAdminRole(a.email, 'demote')} style={{ fontSize: 12 }}>Remover</button>
            </div>
          )) : <small style={hint}>Nenhum admin listado.</small>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input type="email" value={novoAdmin} onChange={(e) => setNovoAdmin(e.target.value)} placeholder="email-do-novo-admin@exemplo.com" style={{ ...inp, marginBottom: 0 }} autoComplete="off" />
          <button type="button" className="adm-btn ap" disabled={adminBusy || !novoAdmin.trim()} onClick={() => setAdminRole(novoAdmin.trim(), 'promote')}>Adicionar</button>
        </div>
      </div>

      <button className="adm-btn ap" disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar configurações'}</button>
    </div>
  );
}
const lbl = { display: 'block', fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, marginBottom: 8 } as const;
const inp = { width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, marginBottom: 6, background: '#fff' } as const;
const hint = { color: 'var(--muted)', fontSize: 12 } as const;
