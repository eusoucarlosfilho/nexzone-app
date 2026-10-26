'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatarTelefone } from '@/lib/whatsapp/telefone';
import Icon from '@/components/Icon';

// Checkout sem login: dados do comprador na própria tela (padrão Kiwify/Hotmart).
export type DadosComprador = { nome: string; email: string; whatsapp: string; avisosWhatsapp: boolean; site: string };

export default function IdentificacaoComprador({ dados, onDados, modo, onLogado, onTrocarEmail, productId, erros, accent }: {
  dados: DadosComprador; onDados: (d: DadosComprador) => void; onTrocarEmail?: () => void;
  modo: 'form' | 'existe'; onLogado: () => void; productId: string;
  erros: Partial<Record<'nome' | 'email' | 'whatsapp', string>>; accent: string;
}) {
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [msg, setMsg] = useState('');
  const [linkEnviado, setLinkEnviado] = useState(false);
  const set = (p: Partial<DadosComprador>) => onDados({ ...dados, ...p });

  async function entrar() {
    setMsg(''); setEntrando(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: dados.email.trim().toLowerCase(), password: senha });
      if (error) { setMsg('Senha incorreta. Tente de novo ou receba um link de acesso por e-mail.'); return; }
      onLogado();
    } finally { setEntrando(false); }
  }
  async function enviarLink() {
    setMsg(''); setEntrando(true);
    try {
      await fetch('/api/checkout/link-acesso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: dados.email, productId }) });
      setLinkEnviado(true);
    } finally { setEntrando(false); }
  }

  const campo = (k: 'nome' | 'email' | 'whatsapp') => ({ 'aria-invalid': !!erros[k], style: { borderColor: erros[k] ? 'var(--red)' : undefined } as React.CSSProperties });

  return (
    <div className="idc">
      <style dangerouslySetInnerHTML={{ __html: `
        .idc{padding:16px 0;border-bottom:1px solid var(--border);}
        .idc h3{font-family:'Outfit';font-size:16px;font-weight:800;margin:0 0 2px;display:flex;align-items:center;gap:8px;}
        .idc .fg{margin:10px 0 0;}
        .idc label{font-size:13px;font-weight:700;display:block;margin-bottom:5px;}
        .idc input[type=text],.idc input[type=email],.idc input[type=tel],.idc input[type=password]{width:100%;height:46px;border-radius:12px;border:1.5px solid var(--border);padding:0 14px;font-size:15px;background:#fff;}
        .idc input:focus{outline:none;border-color:${accent};box-shadow:0 0 0 3px rgba(255,107,0,.12);}
        .idc .err{color:var(--red);font-size:12.5px;margin-top:4px;}
        .idc .chk{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--sub);margin-top:10px;cursor:pointer;}
        .idc .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}
        .idc .aviso{background:var(--soft);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13.5px;margin-top:10px;}
      ` }} />
      {modo === 'form' ? (
        <>
          <h3><Icon name="user" size={17} /> Seus dados</h3>
          <div className="muted" style={{ fontSize: 12.5 }}>Sem cadastro: o acesso ao produto vai para o seu e-mail.</div>
          <div className="fg"><label htmlFor="idc-nome">Nome completo</label>
            <input id="idc-nome" type="text" autoComplete="name" value={dados.nome} maxLength={80} onChange={(e) => set({ nome: e.target.value })} placeholder="Seu nome e sobrenome" {...campo('nome')} />
            {erros.nome && <div className="err">{erros.nome}</div>}</div>
          <div className="fg"><label htmlFor="idc-email">E-mail</label>
            <input id="idc-email" type="email" inputMode="email" autoComplete="email" value={dados.email} maxLength={160} onChange={(e) => set({ email: e.target.value.trim() })} placeholder="voce@email.com" {...campo('email')} />
            {erros.email && <div className="err">{erros.email}</div>}</div>
          <div className="fg"><label htmlFor="idc-whats">WhatsApp</label>
            <input id="idc-whats" type="tel" inputMode="tel" autoComplete="tel" value={dados.whatsapp} maxLength={20}
              onChange={(e) => set({ whatsapp: e.target.value })} onBlur={() => { const f = formatarTelefone(dados.whatsapp); if (f) set({ whatsapp: f }); }}
              placeholder="(11) 91234-5678" {...campo('whatsapp')} />
            {erros.whatsapp && <div className="err">{erros.whatsapp}</div>}</div>
          <label className="chk"><input type="checkbox" checked={dados.avisosWhatsapp} onChange={(e) => set({ avisosWhatsapp: e.target.checked })} style={{ marginTop: 2 }} />
            <span>Quero receber pelo WhatsApp os avisos deste pedido (pagamento e acesso).</span></label>
          <div className="hp" aria-hidden="true"><label htmlFor="idc-site">Site</label><input id="idc-site" type="text" tabIndex={-1} autoComplete="off" value={dados.site} onChange={(e) => set({ site: e.target.value })} /></div>
        </>
      ) : (
        <>
          <h3><Icon name="lock" size={17} /> Você já tem conta</h3>
          <div className="aviso">O e-mail <b>{dados.email}</b> já tem conta no Comprei Barato. Entre para continuar a compra (seus dados e compras ficam juntos).</div>
          {!linkEnviado ? (
            <>
              <div className="fg"><label htmlFor="idc-senha">Senha</label>
                <input id="idc-senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && senha) entrar(); }} /></div>
              {msg && <div className="err">{msg}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button type="button" className="btn btn-dark btn-sm" disabled={!senha || entrando} onClick={entrar}>{entrando ? 'Entrando…' : 'Entrar e continuar'}</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={entrando} onClick={enviarLink}>Receber link de acesso por e-mail</button>
              </div>
              {onTrocarEmail && <button type="button" className="muted" style={{ background: 'none', border: 'none', padding: 0, marginTop: 10, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }} onClick={onTrocarEmail}>Usar outro e-mail</button>}
            </>
          ) : (
            <div className="aviso" style={{ background: 'var(--green-bg)' }}>
              <b>Link enviado!</b> Abra o e-mail <b>{dados.email}</b> e clique em &quot;Continuar a compra&quot;. Você volta para esta página já conectado.
            </div>
          )}
        </>
      )}
    </div>
  );
}
