'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';

export default function SettingsForm({ settings }: any) {
  const [comissao, setComissao] = useState(String(settings.commission_percent));
  const [planos, setPlanos] = useState(settings.boost_plans.map((p: any) => ({ ...p })));
  const [suporte, setSuporte] = useState(settings.support_email || '');

  const [cbAtivo, setCbAtivo] = useState<boolean>(settings.cb_points_ativo === true);
  const [ptCompra, setPtCompra] = useState(String(settings.cb_points_per_purchase ?? 3));
  const [ptBrl, setPtBrl] = useState(String(settings.cb_points_per_brl ?? 100));
  const [ptBonus, setPtBonus] = useState(String(settings.cb_points_review_bonus ?? 3));
  const [janela, setJanela] = useState(String(settings.review_window_days ?? 5));
  const [rapido, setRapido] = useState(String(settings.fast_release_days ?? 1));
  const [exigeVerif, setExigeVerif] = useState<boolean>(settings.verificacao_saque !== false);

  const pay = settings.payment || { gateway: 'mercadopago', misticpay_ci: '', misticpay_cs_set: false };
  const [gateway, setGateway] = useState<string>(pay.gateway || 'mercadopago');
  const [ci, setCi] = useState<string>(pay.misticpay_ci || '');
  const [cs, setCs] = useState<string>('');
  const csSet = !!pay.misticpay_cs_set;

  // Stripe (cartão)
  const stripeInfo = settings.stripe || { enabled: false, secret_set: false, webhook_set: false, test_mode: false };
  const [stripeOn, setStripeOn] = useState<boolean>(!!stripeInfo.enabled);
  const stripeEnvOk = !!stripeInfo.secret_set && !!stripeInfo.webhook_set;

  // DeepSeek (importação por IA)
  const [deepseek, setDeepseek] = useState('');
  const dsSet = !!settings.deepseek_key_set;

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
        cb_points_ativo: cbAtivo,
        cb_points_per_purchase: Number(ptCompra),
        cb_points_per_brl: Number(ptBrl),
        cb_points_review_bonus: Number(ptBonus),
        review_window_days: Number(janela),
        fast_release_days: Number(rapido),
        verificacao_saque: exigeVerif,
        payment_gateway: gateway,
        misticpay_ci: ci,
        misticpay_cs: cs, // em branco = mantém o atual
        deepseek_api_key: deepseek, // em branco = mantém o atual
        stripe_enabled: stripeOn,
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { toast('Configurações salvas!', 'success'); setCs(''); setDeepseek(''); }
    else toast(d.error || 'Erro ao salvar', 'error');
  }

  return (
    <div className="adm-card" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 22 }}>
        <label style={lbl}>Comissão antiga (%)</label>
        <input type="number" step="0.1" value={comissao} onChange={(e) => setComissao(e.target.value)} style={inp} />
        <small style={hint}>Só vale enquanto o SQL 21 não rodou. Depois disso, a taxa do vendedor é a do plano (acima, em Planos e taxas).</small>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={lbl}>Destaque pago avulso (modelo antigo, R$)</label>
        {planos.map((p: any, i: number) => (
          <div key={p.dias} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 70, fontWeight: 700, fontFamily: 'Outfit' }}>{p.dias} dias</span>
            <input type="number" step="0.01" value={p.valor} onChange={(e) => setPreco(i, e.target.value)} style={{ ...inp, marginBottom: 0, maxWidth: 160 }} />
          </div>
        ))}
        <small style={hint}>Substituído pelos planos Destaque e Topo. Os destaques já comprados continuam valendo até vencer.</small>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={lbl}>E-mail de suporte</label>
        <input type="text" inputMode="email" value={suporte} onChange={(e) => setSuporte(e.target.value)} placeholder="contato@seudominio.com.br" style={inp} />
        <small style={hint}>Recebe os avisos da Central de Suporte (chamado novo e cliente respondeu) e é o Reply-To dos e-mails ao cliente. Aceita mais de um, separados por vírgula.</small>
      </div>

      {/* ===== CB Points e liberação de saldo ===== */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 22 }}>
        <label style={lbl}>CB Points</label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, cursor: 'pointer', background: cbAtivo ? '#E3F6EE' : '#FFF8F3' }}>
          <input type="checkbox" checked={cbAtivo} onChange={(e) => setCbAtivo(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
          <span>
            <strong style={{ display: 'block' }}>{cbAtivo ? 'Programa CB Points ATIVO' : 'Programa CB Points DESATIVADO'}</strong>
            <small style={hint}>Desativado: some do menu, da página inicial e do checkout, e a página /cb-points mostra &quot;em breve&quot;. Ative só depois que a estrutura de pontos estiver pronta e segura no banco.</small>
          </span>
        </label>
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
        <label style={lbl}>Janela de reclamação e avaliação</label>
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
        <small style={hint}>O cliente tem {janela} dias para reclamar. Com avaliação positiva (4-5 estrelas), o saldo libera em {rapido} dia(s). Reclamação aberta segura o saldo até ser resolvida.</small>
        {Number(janela) < 7 && <small style={{ ...hint, color: '#E23B3B', display: 'block', marginTop: 6 }}>Atenção: a garantia mínima para o comprador é de 7 dias (CDC). Com {janela} dias, o vendedor pode sacar antes de o cliente pedir o reembolso. Recomendado: 7 ou mais.</small>}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={exigeVerif} onChange={(e) => setExigeVerif(e.target.checked)} style={{ marginTop: 3 }} />
          <span><strong>Exigir verificação de identidade para sacar</strong><br /><small style={hint}>O produtor vende normalmente, mas só saca depois que você aprovar o documento dele em Verificações. Recomendado: ligado.</small></span>
        </label>
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
              style={inp} autoComplete="new-password" />
            <small style={hint}>
              {csSet
                ? 'Secret já cadastrado. Só preencha se quiser substituí-lo.'
                : 'Cole o Client Secret gerado no painel da MisticPay. Fica guardado de forma segura no servidor.'}
            </small>
          </div>
          <small style={{ ...hint, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Icon name="settings" size={14} /> Configure o webhook na MisticPay para: <code>{(typeof window !== 'undefined' ? window.location.origin : '')}/api/webhooks/payment</code>
          </small>
        </div>
      )}

      {/* ===== Cartão de crédito (Stripe) ===== */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 22 }}>
        <label style={lbl}>Cartão de crédito (Stripe)</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={stripeOn} onChange={(e) => setStripeOn(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--orange, #FF6B00)' }} />
          <span style={{ fontWeight: 700 }}>Aceitar cartão (Stripe)</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: stripeInfo.secret_set ? 'var(--green)' : 'var(--red)' }}>
            <Icon name={stripeInfo.secret_set ? 'checkCircle' : 'alert'} size={14} /> STRIPE_SECRET_KEY {stripeInfo.secret_set ? `configurada${stripeInfo.test_mode ? ' (modo de teste)' : ''}` : 'não configurada'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: stripeInfo.webhook_set ? 'var(--green)' : 'var(--red)' }}>
            <Icon name={stripeInfo.webhook_set ? 'checkCircle' : 'alert'} size={14} /> STRIPE_WEBHOOK_SECRET {stripeInfo.webhook_set ? 'configurada' : 'não configurada'}
          </span>
        </div>
        <small style={{ ...hint, display: 'block', marginTop: 8 }}>
          {stripeOn && !stripeEnvOk
            ? 'Ligado, mas o botão de cartão só aparece quando as duas variáveis estiverem configuradas na Vercel (e após o Redeploy).'
            : stripeOn
              ? 'O botão “Pagar com cartão de crédito” aparece nos pedidos pendentes, ao lado do Pix.'
              : 'Desligado: os pedidos mostram só o Pix.'}
          {' '}Webhook da Stripe: <code>{(typeof window !== 'undefined' ? window.location.origin : '')}/api/webhooks/stripe</code>
        </small>
      </div>

      {/* ===== Importação por IA (DeepSeek) ===== */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 22 }}>
        <label style={lbl}>Importação por IA — chave da DeepSeek</label>
        <input type="password" value={deepseek} onChange={(e) => setDeepseek(e.target.value)}
          placeholder={dsSet ? '•••••••••• (já configurada — deixe em branco para manter)' : 'sk-... (cole a chave da DeepSeek)'}
          style={inp} autoComplete="new-password" />
        <small style={hint}>
          {dsSet
            ? 'Chave já configurada. Só preencha se quiser substituí-la.'
            : 'Cole a chave gerada em platform.deepseek.com. Fica guardada de forma segura no servidor.'}
          {' '}Usada na ferramenta “Trazer anúncio de outro site” do painel do vendedor.
        </small>
      </div>

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
