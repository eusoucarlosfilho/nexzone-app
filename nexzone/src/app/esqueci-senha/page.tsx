'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const COOLDOWN = 60;

function traduzErro(m: string): string {
  const t = (m || '').toLowerCase();
  if (t.includes('for security purposes') || t.includes('rate limit') || t.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if ((t.includes('invalid') && t.includes('email')) || t.includes('unable to validate email')) return 'E-mail inválido. Confira e tente de novo.';
  if (t.includes('redirect') || t.includes('not allowed')) return 'Não foi possível enviar agora (configuração de redirecionamento). Fale com o suporte.';
  return 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.';
}

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [aviso, setAviso] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('erro') === 'link') setAviso('Link expirado ou inválido. Peça um novo.');
      const saved = localStorage.getItem('cb_remember_email');
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading || espera > 0) return;
    const addr = email.trim();
    if (!addr) { setMsg('Informe seu e-mail.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setMsg('E-mail inválido. Confira e tente de novo.'); return; }
    setLoading(true); setMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      // O código é trocado por sessão no servidor (cookie) e o usuário cai direto em /redefinir-senha.
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    setLoading(false);
    if (error) {
      const t = traduzErro(error.message);
      // "usuário não encontrado" e afins não devem revelar se a conta existe: mostra o mesmo sucesso neutro
      if (/user not found|no user/i.test(error.message)) { setEnviado(true); setAviso(''); setEspera(COOLDOWN); return; }
      setMsg(t);
      if (t.startsWith('Muitas tentativas')) setEspera(COOLDOWN);
      return;
    }
    setEnviado(true); setAviso(''); setEspera(COOLDOWN);
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link href="/" className="logo">Comprei <span className="g">Barato</span></Link>
      <div className="card" style={{ marginTop: 24 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Recuperar senha</h1>
        {aviso && !enviado && (
          <p role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--yellow-bg)', color: 'var(--yellow)', borderRadius: 12, padding: '10px 12px', fontSize: 14, fontWeight: 700, margin: '8px 0 14px' }}>
            <Icon name="alert" size={18} style={{ marginTop: 2 }} />{aviso}
          </p>
        )}
        {enviado ? (
          <div role="status">
            <p className="muted" style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="mail" size={20} color="var(--orange-ink)" style={{ marginTop: 2 }} />
              <span>Se este e-mail tiver uma conta, enviamos um link para redefinir a senha. Confira sua caixa de entrada (e o spam). O link vale por tempo limitado.</span>
            </p>
            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => enviar()} disabled={loading || espera > 0}>
              <Icon name="send" size={16} />{loading ? 'Enviando…' : espera > 0 ? `Reenviar e-mail em ${espera}s` : 'Reenviar e-mail'}
            </button>
            <button type="button" className="muted" style={{ background: 'none', width: '100%', marginTop: 10, fontSize: 13, textDecoration: 'underline', minHeight: 44 }}
              onClick={() => { setEnviado(false); setMsg(''); }}>Usar outro e-mail</button>
            {msg && <p className="auth-err" role="alert">{msg}</p>}
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            <p className="muted" style={{ marginBottom: 16 }}>Enviaremos um link para você criar uma nova senha.</p>
            <div className="fg"><label htmlFor="cb-email">E-MAIL</label><input id="cb-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required /></div>
            <button type="submit" className="btn btn-pri" style={{ width: '100%' }} disabled={loading || espera > 0}>
              {loading ? 'Enviando…' : espera > 0 ? `Aguarde ${espera}s` : 'Enviar link de recuperação'}
            </button>
            {msg && <p className="auth-err" role="alert">{msg}</p>}
          </form>
        )}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/login" className="muted" style={{ fontSize: 13, textDecoration: 'underline' }}>Voltar para o login</Link>
        </div>
      </div>
    </div>
  );
}
