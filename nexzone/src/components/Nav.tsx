import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <>
      <div className="topbar">🚀 Crie sua loja grátis e pague só <span className="g">3% por venda</span>. Sem mensalidade.</div>
      <nav className="nz">
        <div className="nav-wrap">
          <Link href="/" className="logo">Nex<span className="g">Zone</span></Link>
          <div className="nav-end">
            <Link href="/" className="btn btn-ghost btn-sm">Início</Link>
            <Link href="/produtos" className="btn btn-ghost btn-sm">Explorar</Link>
            {user ? (
              <>
                <Link href="/favoritos" className="btn btn-ghost btn-sm">♥ Favoritos</Link>
                <Link href="/minhas-compras" className="btn btn-ghost btn-sm">Minhas Compras</Link>
                <Link href="/vender" className="btn btn-ghost btn-sm">Painel</Link>
                <form action="/auth/signout" method="post"><button className="btn btn-dark btn-sm">Sair</button></form>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Entrar</Link>
                <Link href="/vender" className="btn btn-dark btn-sm">Vender</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
