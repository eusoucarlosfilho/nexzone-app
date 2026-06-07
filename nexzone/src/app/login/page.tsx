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
      const { error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
      setMsg(error ? error.message : 'Conta criada! Verifique seu e-mail se a confirmação estiver ativa.');
      if (!error) router.push('/vender');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg(error.message); else router.push('/vender');
    }
    setLoading(false);
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link href="/" className="logo">Nex<span className="g">Zone</span></Link>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="flex" style={{ marginBottom: 18 }}>
          <button className={`btn btn-sm ${mode === 'login' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => setMode('login')}>Entrar</button>
          <button className={`btn btn-sm ${mode === 'register' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => setMode('register')}>Cadastrar</button>
        </div>
        {mode === 'register' && <div className="fg"><label>NOME</label><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" /></div>}
        <div className="fg"><label>E-MAIL</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
        <div className="fg"><label>SENHA</label><input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" /></div>
        <button className="btn btn-pri" style={{ width: '100%' }} onClick={submit} disabled={loading}>
          {loading ? '…' : mode === 'login' ? 'Entrar' : 'Criar conta grátis'}
        </button>
        {msg && <p className="muted" style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </div>
  );
}
