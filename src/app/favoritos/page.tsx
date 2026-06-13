import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function FavoritosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('favorites')
    .select('created_at, products(*, stores(nome, nivel))')
    .eq('user_id', user.id).order('created_at', { ascending: false });

  const produtos = (data ?? []).map((r: any) => r.products).filter((p: any) => p && p.status === 'ativo') as Product[];

  return (
    <>
      <Nav />
      <div className="page">
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, marginBottom: 6 }}>Meus favoritos</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Os produtos que você salvou para comprar depois.</p>
        {produtos.length
          ? <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          : <p className="muted">Você ainda não favoritou nenhum produto. Toque no 🤍 nos produtos para salvá-los aqui. <Link href="/produtos" style={{ color: 'var(--orange)', fontWeight: 700 }}>Explorar produtos ›</Link></p>}
      </div>
    </>
  );
}
