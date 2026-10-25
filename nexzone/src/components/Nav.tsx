import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NavSearch, { NavCats, CatChips, type NavCat } from './NavSearch';
import MobileMenu from './MobileMenu';
import Icon from './Icon';

const NL = ({ href, icon, label }: { href: string; icon: string; label: string }) => (
  <Link href={href} className="nav-link" title={label}><Icon name={icon} size={18} strokeWidth={2.2} /><span className="nl-t">{label}</span></Link>
);

export default async function Nav() {
  const supabase = createClient();
  const [{ data: { user } }, catsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('categories').select('nome, slug'),
  ]);
  const cats = (catsRes.data ?? []) as NavCat[];

  return (
    <>
      <div className="topbar">
        <span className="tb-long">Crie sua loja grátis e pague só <span className="g">3% por venda</span>. Sem mensalidade.</span>
        <span className="tb-short">Loja grátis · só <span className="g">3% por venda</span></span>
        <Link href="/seja-vendedor">Quero vender →</Link>
      </div>
      <nav className="nz" aria-label="Principal">
        <div className="nav-wrap">
          <div className="nav-row">
            <Link href="/" className="logo" aria-label="Comprei Barato — início"><img src="/logo.png" alt="Comprei Barato" /></Link>
            <Suspense fallback={<div className="nav-search" />}><NavSearch /></Suspense>
            <div className="nav-end">
              <NL href="/produtos" icon="grid" label="Explorar" />
              {user ? (
                <>
                  <NL href="/favoritos" icon="heart" label="Favoritos" />
                  <NL href="/minhas-compras" icon="bag" label="Minhas compras" />
                  <NL href="/cb-points" icon="star" label="CB Points" />
                  <NL href="/vender" icon="store" label="Minha loja" />
                  <NL href="/conta" icon="user" label="Minha conta" />
                  <form action="/auth/signout" method="post"><button type="submit" className="btn btn-dark btn-sm">Sair</button></form>
                </>
              ) : (
                <>
                  <NL href="/login" icon="user" label="Entrar" />
                  <Link href="/vender" className="btn btn-dark btn-sm">Vender</Link>
                </>
              )}
            </div>
            <MobileMenu loggedIn={!!user} cats={cats} />
          </div>
          {cats.length > 0 && (
            <Suspense fallback={<CatChips cats={cats} />}><NavCats cats={cats} /></Suspense>
          )}
        </div>
      </nav>
    </>
  );
}
