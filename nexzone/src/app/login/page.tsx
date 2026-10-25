'use client';
import { useState, useEffect } from 'react';
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

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [nome, setNome] = useState('');
  const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const router = useRouter();

  // Lembrar login: pré-preenche o e-mail salvo neste dispositivo (nunca guarda a senha).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cb_remember_email');
      if (saved) { setEmail(saved); setLembrar(true); }
    } catch {}
    try {
      if (new URLSearchParams(window.location.search).get('erro') === 'link') setMsg('Link expirado ou inválido. Faça login ou peça um novo.');
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
    const raw = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('next')) || '';
    const next = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/vender';
    const supabase = createClient();
    if (mode === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
      if (error) setMsg(traduzErro(error.message));
      else if (data.session) router.push(next);
      else { setMsg('Conta criada! Confirme seu e-mail e depois faça login.'); setMode('login'); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg(traduzErro(error.message)); else { salvarLembrar(); router.push(next); }
    }
    setLoading(false);
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
        <form onSubmit={submit} noValidate>
        {mode === 'register' && <div className="fg"><label htmlFor="cb-nome">NOME</label><input id="cb-nome" name="name" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" /></div>}
        <div className="fg"><label htmlFor="cb-email">E-MAIL</label><input id="cb-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required /></div>
        <div className="fg">
          <label htmlFor="cb-senha">SENHA</label>
          <PasswordInput id="cb-senha" name="password" value={senha} onChange={e => setSenha(e.target.value)} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-describedby={mode === 'register' ? 'cb-senha-hint' : undefined} />
          {mode === 'register' && <PasswordHint value={senha} id="cb-senha-hint" />}
        </div>
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
