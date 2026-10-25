'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import PasswordInput, { PasswordHint } from '@/components/PasswordInput';

function traduzErro(m: string): string {
  const t = (m || '').toLowerCase();
  if (t.includes('session') && (t.includes('missing') || t.includes('not found'))) return 'SESSAO';
  if (t.includes('different from the old') || t.includes('same as')) return 'A nova senha precisa ser diferente da anterior.';
  if (t.includes('password should be') || t.includes('weak')) return 'Senha fraca: use ao menos 8 caracteres com letras e números.';
  if (t.includes('for security purposes') || t.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return m;
}

export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState(''); const [senha2, setSenha2] = useState('');
  const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); const [ok, setOk] = useState(false); const [checando, setChecando] = useState(true);
  const [expirado, setExpirado] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let vivo = true;

    async function init() {
      // 0) Erro vindo do Supabase no hash/query (ex.: #error=access_denied&error_code=otp_expired)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);
      if (hash.get('error') || hash.get('error_code') || query.get('error') || query.get('error_code')) {
        if (vivo) { setExpirado(true); setChecando(false); }
        return;
      }

      // 1) Já existe sessão? (caminho normal: /auth/callback já trocou o código no servidor e gravou o cookie)
      const { data: s0 } = await supabase.auth.getSession();
      if (s0.session) { if (vivo) { setReady(true); setChecando(false); } return; }

      // 2) Fluxo PKCE: ?code=... na URL (e-mails antigos) -> troca por sessão
      const code = query.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          if (vivo) { setReady(true); setChecando(false); }
          window.history.replaceState({}, '', '/redefinir-senha');
          return;
        }
      }

      // 3) Fluxo antigo (#access_token): o client detecta o hash e dispara PASSWORD_RECOVERY/SIGNED_IN abaixo.
      if (hash.get('access_token')) {
        // dá tempo ao client de processar o hash antes de concluir que o link é inválido
        await new Promise((r) => setTimeout(r, 1200));
        const { data: s1 } = await supabase.auth.getSession();
        if (s1.session && vivo) { setReady(true); window.history.replaceState({}, '', '/redefinir-senha'); }
      }
      if (vivo) setChecando(false);
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) { setReady(true); setChecando(false); }
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  async function salvar(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    if (senha.length < 6) { setMsg('A senha deve ter ao menos 6 caracteres.'); return; }
    if (senha !== senha2) { setMsg('As senhas não conferem.'); return; }
    setLoading(true); setMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      const t = traduzErro(error.message);
      if (t === 'SESSAO') { setReady(false); setExpirado(true); return; }
      setMsg(t);
    } else {
      setOk(true);
    }
  }

  const naoConfere = senha2.length > 0 && senha !== senha2;

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link href="/" className="logo">Comprei <span className="g">Barato</span></Link>
      <div className="card" style={{ marginTop: 24 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Criar nova senha</h1>
        {ok ? (
          <div className="auth-ok" role="status">
            <p><Icon name="checkCircle" size={20} />Senha alterada com sucesso!</p>
            <span className="muted">Use a nova senha nos próximos acessos.</span>
            <Link href="/login" className="btn btn-pri" style={{ width: '100%' }}>Ir para o login</Link>
          </div>
        ) : checando ? (
          <p className="muted" style={{ marginTop: 8 }}>Validando seu link…</p>
        ) : !ready || expirado ? (
          <div role="alert" style={{ marginTop: 8 }}>
            <p className="muted" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="alert" size={18} color="var(--yellow)" style={{ marginTop: 2 }} />
              <span>Link expirado ou inválido. Peça um novo para redefinir sua senha.</span>
            </p>
            <Link href="/esqueci-senha" className="btn btn-pri" style={{ width: '100%', marginTop: 16 }}>Pedir novo link</Link>
          </div>
        ) : (
          <form onSubmit={salvar} noValidate>
            <p className="muted" style={{ marginBottom: 16 }}>Digite sua nova senha.</p>
            <div className="fg">
              <label htmlFor="cb-nova">NOVA SENHA</label>
              <PasswordInput id="cb-nova" name="new-password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" required aria-describedby="cb-nova-hint" />
              <PasswordHint value={senha} id="cb-nova-hint" />
            </div>
            <div className="fg">
              <label htmlFor="cb-nova2">CONFIRME A NOVA SENHA</label>
              <PasswordInput id="cb-nova2" name="confirm-password" value={senha2} onChange={e => setSenha2(e.target.value)} autoComplete="new-password" required aria-invalid={naoConfere} aria-describedby="cb-nova2-msg" />
              <div id="cb-nova2-msg" className="pw-hint" aria-live="polite">
                {senha2.length > 0 && (naoConfere
                  ? <span style={{ color: 'var(--red)' }}><Icon name="x" size={14} />As senhas não conferem</span>
                  : <span className="ok"><Icon name="checkCircle" size={14} />As senhas conferem</span>)}
              </div>
            </div>
            <button type="submit" className="btn btn-pri" style={{ width: '100%' }} disabled={loading || naoConfere || !senha || !senha2}>
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            {msg && <p className="auth-err" role="alert">{msg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
