import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NavSearch from './NavSearch';

const I = {
  explore: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />,
  bag: <path d="M6 7h12l1 14H5zM9 7a3 3 0 0 1 6 0" />,
  star: <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  store: <><path d="M3 9 4 4h16l1 5" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};
const Ico = ({ d }: { d: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export default async function Nav() {
  const supabase = createClient();
  const [{ data: { user } }, catsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('categories').select('nome, slug, emoji'),
  ]);
  const cats = (catsRes.data ?? []) as { nome: string; slug: string; emoji: string }[];

  return (
    <>
      <div className="topbar">
        <span>Crie sua loja grátis e pague só <span className="g">3% por venda</span>. Sem mensalidade.</span>
        <Link href="/seja-vendedor">Quero vender →</Link>
      </div>
      <nav className="nz" aria-label="Principal">
        <div className="nav-wrap">
          <Link href="/" className="logo" aria-label="Comprei Barato — início"><img src="/logo.png" alt="Comprei Barato" /></Link>
          <Suspense fallback={<div className="nav-search" />}><NavSearch /></Suspense>
          <div className="nav-end">
            <Link href="/produtos" className="nav-link"><Ico d={I.explore} />Explorar</Link>
            {user ? (
              <>
                <Link href="/favoritos" className="nav-link"><Ico d={I.heart} />Favoritos</Link>
                <Link href="/minhas-compras" className="nav-link"><Ico d={I.bag} />Minhas compras</Link>
                <Link href="/cb-points" className="nav-link"><Ico d={I.star} />CB Points</Link>
                <Link href="/vender" className="nav-link"><Ico d={I.store} />Minha loja</Link>
                <form action="/auth/signout" method="post"><button className="btn btn-dark btn-sm">Sair</button></form>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-link"><Ico d={I.user} />Entrar</Link>
                <Link href="/vender" className="btn btn-dark btn-sm">Vender</Link>
              </>
            )}
          </div>
        </div>
        {cats.length > 0 && (
          <div className="nav-cats" aria-label="Categorias">
            <Link href="/produtos" className="chip">Todos</Link>
            {cats.map((c) => (
              <Link key={c.slug} href={`/produtos?cat=${c.slug}`} className="chip"><span aria-hidden="true">{c.emoji}</span>{c.nome}</Link>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}
