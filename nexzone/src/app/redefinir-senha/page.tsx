'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState(''); const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); const [ok, setOk] = useState(false); const [checando, setChecando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      // 1) Já existe sessão?
      const { data: s0 } = await supabase.auth.getSession();
      if (s0.session) { setReady(true); setChecando(false); return; }

      // 2) Fluxo PKCE: ?code=... na URL -> troca por sessão
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setReady(true); setChecando(false);
          window.history.replaceState({}, '', '/redefinir-senha');
          return;
        }
      }
      // 3) Fluxo antigo (#access_token) é tratado automaticamente pelo onAuthStateChange abaixo
      setChecando(false);
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function salvar() {
    if (senha.length < 6) { setMsg('A senha deve ter ao menos 6 caracteres.'); return; }
    setLoading(true); setMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) setMsg(error.message);
    else { setOk(true); setTimeout(() => router.push('/vender'), 1600); }
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link href="/" className="logo">Nex<span className="g">Zone</span></Link>
      <div className="card" style={{ marginTop: 24 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Criar nova senha</h1>
        {ok ? (
          <p style={{ color: 'var(--green)', fontWeight: 700, marginTop: 8 }}>✓ Senha alterada! Redirecionando…</p>
        ) : checando ? (
          <p className="muted" style={{ marginTop: 8 }}>Validando seu link…</p>
        ) : !ready ? (
          <p className="muted" style={{ marginTop: 8 }}>
            Link inválido ou expirado. Volte e solicite um novo em <Link href="/esqueci-senha" style={{ color: 'var(--orange)' }}>Esqueci minha senha</Link>.
          </p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 16 }}>Digite sua nova senha.</p>
            <div className="fg"><label>NOVA SENHA</label><input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" /></div>
            <button className="btn btn-pri" style={{ width: '100%' }} onClick={salvar} disabled={loading}>{loading ? '…' : 'Salvar nova senha'}</button>
            {msg && <p className="muted" style={{ marginTop: 12, color: 'var(--red)' }}>{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
