'use client';
import { useState, useEffect } from 'react';
import { formatarTelefone, normalizarTelefone } from '@/lib/whatsapp/telefone';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import PasswordInput, { PasswordHint } from '@/components/PasswordInput';

function traduzErro(m: string) {
  const t = m.toLowerCase();
  if (t.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (t.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).';
  if (t.includes('user already registered')) return 'Este e-mail já tem conta. Entre ou recupere a senha.';
  if (t.includes('for security purposes') || t.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (t.includes('password should be') || t.includes('weak password')) return 'Senha fraca: use ao menos 8 caracteres com letras e números.';
  if (t.includes('invalid') && t.includes('email')) return 'E-mail inválido.';
  return m;
}

// Destino depois do login: só caminhos internos ("/algo"), padrão '/vender'.
function calcNext(): string {
  const raw = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('next')) || '';
  return raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/vender';
}

// Logo oficial "G" do Google (cores da marca), 18px.
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [nome, setNome] = useState('');
  const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  // WhatsApp (opcional no cadastro). Aceite vem marcado e pode ser desmarcado aqui ou depois em Minha conta.
  const [whats, setWhats] = useState(''); const [whatsAceite, setWhatsAceite] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  // Lembrar login: pré-preenche o e-mail salvo neste dispositivo (nunca guarda a senha).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cb_remember_email');
      if (saved) { setEmail(saved); setLembrar(true); }
    } catch {}
    try {
      if (new URLSearchParams(window.location.search).get('erro') === 'link') setMsg('Não conseguimos concluir o login. Tente de novo.');
    } catch {}
  }, []);

  function salvarLembrar() {
    try {
      if (lembrar && email) localStorage.setItem('cb_remember_email', email);
      else localStorage.removeItem('cb_remember_email');
    } catch {}
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true); setMsg('');
    const next = calcNext();
    const supabase = createClient();
    if (mode === 'register') {
      const tel = whats.trim() ? normalizarTelefone(whats) : null;
      if (whats.trim() && !tel) { setMsg('WhatsApp inválido. Use DDD + número, por exemplo (63) 99999-9999. Ou deixe em branco.'); setLoading(false); return; }
      const extra = tel ? { whatsapp: tel, whatsapp_avisos: whatsAceite, whatsapp_promocoes: whatsAceite } : {};
      const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome, ...extra } } });
      if (error) setMsg(traduzErro(error.message));
      else if (data.session) router.push(next);
      else { setMsg('Conta criada! Confirme seu e-mail e depois faça login.'); setMode('login'); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg(traduzErro(error.message)); else { salvarLembrar(); router.push(next); }
    }
    setLoading(false);
  }

  // Login/cadastro com Google: o Supabase devolve para /auth/callback, que troca o code pela sessão.
  async function entrarComGoogle() {
    if (googleLoading || loading) return;
    setGoogleLoading(true); setMsg('');
    try {
      const next = calcNext();
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // sucesso: o navegador sai para o Google; mantém "Abrindo o Google…"
    } catch {
      setMsg('Não foi possível abrir o login do Google. Tente de novo ou use e-mail e senha.');
      setGoogleLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link href="/" className="logo">Comprei <span className="g">Barato</span></Link>

      {mode === 'login' && (
        <div style={{ marginTop: 20, background: 'var(--text)', borderRadius: 16, padding: '18px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontFamily: 'Outfit', fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="rocket" size={18} color="#FFB273" />Venda seus produtos digitais</strong>
            <div style={{ fontSize: 13, opacity: .92 }}>Crie sua loja grátis. Só 3% por venda.</div>
          </div>
          <button type="button" className="btn btn-sm" style={{ background: '#fff', color: 'var(--orange-ink)', fontWeight: 800, whiteSpace: 'nowrap' }} onClick={() => { setMode('register'); setMsg(''); }}>Começar a vender agora</button>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex" style={{ marginBottom: 18 }}>
          <button type="button" className={`btn btn-sm ${mode === 'login' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => { setMode('login'); setMsg(''); }}>Entrar</button>
          <button type="button" className={`btn btn-sm ${mode === 'register' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => { setMode('register'); setMsg(''); }}>Cadastrar</button>
        </div>
        <button type="button" className="btn" onClick={entrarComGoogle} disabled={googleLoading || loading}
          style={{ width: '100%', background: '#fff', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'Outfit', fontWeight: 700 }}>
          <GoogleG />
          {googleLoading ? 'Abrindo o Google…' : 'Continuar com Google'}
        </button>
        <div role="separator" aria-label="ou" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', color: 'var(--muted)', fontSize: 13 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          ou
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <form onSubmit={submit} noValidate>
        {mode === 'register' && <div className="fg"><label htmlFor="cb-nome">NOME</label><input id="cb-nome" name="name" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" /></div>}
        <div className="fg"><label htmlFor="cb-email">E-MAIL</label><input id="cb-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required /></div>
        <div className="fg">
          <label htmlFor="cb-senha">SENHA</label>
          <PasswordInput id="cb-senha" name="password" value={senha} onChange={e => setSenha(e.target.value)} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-describedby={mode === 'register' ? 'cb-senha-hint' : undefined} />
          {mode === 'register' && <PasswordHint value={senha} id="cb-senha-hint" />}
        </div>
        {mode === 'register' && (
          <>
            <div className="fg">
              <label htmlFor="cb-whats">WHATSAPP <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
              <input id="cb-whats" name="tel" type="tel" inputMode="tel" autoComplete="tel-national" value={whats}
                onChange={e => setWhats(formatarTelefone(e.target.value))} placeholder="(63) 99999-9999" maxLength={16} />
            </div>
            {whats.trim() && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, margin: '-4px 0 14px', cursor: 'pointer', color: 'var(--muted)' }}>
                <input type="checkbox" checked={whatsAceite} onChange={e => setWhatsAceite(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--orange, #FF6B00)', cursor: 'pointer' }} />
                Quero receber pelo WhatsApp avisos das minhas compras e vendas, novidades e promoções do Comprei Barato. Posso desativar quando quiser em Minha conta.
              </label>
            )}
          </>
        )}
        {mode === 'login' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '2px 0 14px', cursor: 'pointer', color: 'var(--muted)' }}>
            <input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--orange, #FF6B00)', cursor: 'pointer' }} />
            Lembrar meu login neste dispositivo
          </label>
        )}
        <button type="submit" className="btn btn-pri" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta grátis'}
        </button>
        </form>
        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <Link href="/esqueci-senha" className="muted" style={{ fontSize: 13, textDecoration: 'underline' }}>Esqueci minha senha</Link>
          </div>
        )}
        {msg && <p className="muted" role="status" style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </div>
  );
}
