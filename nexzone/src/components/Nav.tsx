import { Suspense } from 'react';
import Link from 'next/link';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import NavSearch, { NavCats, CatChips, type NavCat } from './NavSearch';
import MobileMenu from './MobileMenu';
import Icon from './Icon';
import { CATEGORIAS } from '@/lib/categorias';
import LinkRastreado from './v3/LinkRastreado';
import NotificacoesSino from './NotificacoesSino';

// Leitura leve de duas chaves públicas da tabela settings (service_role, só no servidor):
// CB Points ligado? e a taxa do plano Básico (a faixa do topo não pode prometer um número diferente do cobrado).
async function configNav(): Promise<{ cbAtivo: boolean; comissao: number }> {
  try {
    const { data } = await createAdminClient().from('settings').select('key, value').in('key', ['cb_points_ativo', 'plano_basico_pct']);
    const m: Record<string, any> = Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, r.value]));
    const c = Number(m.plano_basico_pct);
    return { cbAtivo: m.cb_points_ativo === true || m.cb_points_ativo === 'true', comissao: Number.isFinite(c) && c >= 0 && m.plano_basico_pct != null ? c : 5 };
  } catch {
    return { cbAtivo: false, comissao: 5 };
  }
}

const NL = ({ href, icon, label }: { href: string; icon: string; label: string }) => (
  <Link href={href} className="nav-link" title={label}><Icon name={icon} size={18} strokeWidth={2.2} /><span className="nl-t">{label}</span></Link>
);

export default async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Faixa "Crie sua loja": só para quem ainda não tem loja. CB Points: só com o programa ativo.
  const [lojaRes, { cbAtivo, comissao }, perfilRes] = await Promise.all([
    user ? supabase.from('stores').select('id').eq('owner', user.id).maybeSingle() : Promise.resolve({ data: null }),
    configNav(),
    // botão "Sala de comando": só aparece para quem tem o perfil admin (a página /admin confere de novo no servidor)
    user ? supabase.from('profiles').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ehAdmin = (perfilRes as any)?.data?.role === 'admin';
  const taxa = `${String(comissao).replace('.', ',')}%`;
  const temLoja = !!(lojaRes as any)?.data;
  // Categorias da fonte única (src/lib/categorias.ts), na ordem definida
  const cats: NavCat[] = CATEGORIAS.map((c) => ({ nome: c.nome, slug: c.slug }));

  return (
    <>
      {!temLoja && (
        <div className="topbar">
          <span className="tb-long">Venda contas, itens, moedas e gift cards. Anuncie grátis e pague a partir de <span className="g">{taxa}</span> só quando vender.</span>
          <span className="tb-short">Anuncie grátis · a partir de <span className="g">{taxa}</span></span>
          <LinkRastreado href="/seja-vendedor" evento="vendedor_cta" dados={{ origem: 'nav' }}>Quero vender →</LinkRastreado>
        </div>
      )}
      <nav className="nz" aria-label="Principal">
        <div className="nav-wrap">
          <div className="nav-row">
            <Link href="/" className="logo" aria-label="Comprei Barato — início"><img src="/logo.png" alt="Comprei Barato" /></Link>
            <Suspense fallback={<div className="nav-search" />}><NavSearch /></Suspense>
            <div className="nav-end">
              <NL href="/produtos" icon="grid" label="Explorar" />
              {user ? (
                <>
                  {ehAdmin && <Link href="/admin" className="nav-link nav-admin" title="Sala de comando"><Icon name="cockpit" size={18} strokeWidth={2.2} /><span className="nl-t">Sala de comando</span></Link>}
                  <NL href="/favoritos" icon="heart" label="Favoritos" />
                  <NL href="/minhas-compras" icon="bag" label="Minhas compras" />
                  {cbAtivo && <NL href="/cb-points" icon="star" label="CB Points" />}
                  <NL href="/vender" icon="store" label="Minha loja" />
                  <NotificacoesSino className="nsino-d" />
                  <NL href="/conta" icon="user" label="Minha conta" />
                  <form action="/auth/signout" method="post"><button type="submit" className="btn btn-dark btn-sm">Sair</button></form>
                </>
              ) : (
                <>
                  <NL href="/login" icon="user" label="Entrar" />
                  <LinkRastreado href="/vender" className="btn btn-dark btn-sm" evento="vendedor_cta" dados={{ origem: 'nav' }}>Vender</LinkRastreado>
                </>
              )}
            </div>
            {user && <NotificacoesSino className="nsino-m" />}
            <MobileMenu loggedIn={!!user} cats={cats} cbPoints={cbAtivo} admin={ehAdmin} />
          </div>
          {cats.length > 0 && (
            <Suspense fallback={<CatChips cats={cats} />}><NavCats cats={cats} /></Suspense>
          )}
        </div>
      </nav>
    </>
  );
}
