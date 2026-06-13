'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false); const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (!email) { setMsg('Informe seu e-mail.'); return; }
    setLoading(true); setMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (error) setMsg(error.message);
    else setEnviado(true);
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link href="/" className="logo">Nex<span className="g">Zone</span></Link>
      <div className="card" style={{ marginTop: 24 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Recuperar senha</h1>
        {enviado ? (
          <p className="muted" style={{ marginTop: 8 }}>
            Se este e-mail tiver uma conta, enviamos um link para redefinir a senha. Confira sua caixa de entrada (e o spam).
          </p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 16 }}>Enviaremos um link para você criar uma nova senha.</p>
            <div className="fg"><label>E-MAIL</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
            <button className="btn btn-pri" style={{ width: '100%' }} onClick={enviar} disabled={loading}>{loading ? '…' : 'Enviar link de recuperação'}</button>
            {msg && <p className="muted" style={{ marginTop: 12, color: 'var(--red)' }}>{msg}</p>}
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/login" className="muted" style={{ fontSize: 13, textDecoration: 'underline' }}>Voltar para o login</Link>
        </div>
      </div>
    </div>
  );
}
