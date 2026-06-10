'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [nome, setNome] = useState('');
  const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true); setMsg('');
    const supabase = createClient();
    if (mode === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
      if (error) setMsg(error.message);
      else if (data.session) router.push('/vender');
      else { setMsg('Conta criada! Confirme seu e-mail e depois faça login.'); setMode('login'); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg(error.message); else router.push('/vender');
    }
    setLoading(false);
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link href="/" className="logo">Nex<span className="g">Zone</span></Link>

      {mode === 'login' && (
        <div style={{ marginTop: 20, background: 'var(--grad)', borderRadius: 16, padding: '18px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontFamily: 'Outfit', fontSize: 16 }}>🚀 Venda seus produtos digitais</strong>
            <div style={{ fontSize: 13, opacity: .92 }}>Crie sua loja grátis. Só 3% por venda.</div>
          </div>
          <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--orange)', fontWeight: 800, whiteSpace: 'nowrap' }} onClick={() => { setMode('register'); setMsg(''); }}>Começar a vender agora</button>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex" style={{ marginBottom: 18 }}>
          <button className={`btn btn-sm ${mode === 'login' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => { setMode('login'); setMsg(''); }}>Entrar</button>
          <button className={`btn btn-sm ${mode === 'register' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => { setMode('register'); setMsg(''); }}>Cadastrar</button>
        </div>
        {mode === 'register' && <div className="fg"><label>NOME</label><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" /></div>}
        <div className="fg"><label>E-MAIL</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
        <div className="fg"><label>SENHA</label><input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" /></div>
        <button className="btn btn-pri" style={{ width: '100%' }} onClick={submit} disabled={loading}>
          {loading ? '…' : mode === 'login' ? 'Entrar' : 'Criar conta grátis'}
        </button>
        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <Link href="/esqueci-senha" className="muted" style={{ fontSize: 13, textDecoration: 'underline' }}>Esqueci minha senha</Link>
          </div>
        )}
        {msg && <p className="muted" style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </div>
  );
}
