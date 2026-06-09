import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import Filters from './Filters';
import Toolbar from './Toolbar';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SORTS: Record<string, { col: string; asc: boolean }> = {
  vendas: { col: 'vendas', asc: false },
  novos: { col: 'created_at', asc: false },
  menor: { col: 'preco', asc: true },
  maior: { col: 'preco', asc: false },
};

export default async function ProdutosPage({ searchParams }: { searchParams: { q?: string; cat?: string; min?: string; max?: string; sort?: string } }) {
  const supabase = createClient();
  const { data: cats } = await supabase.from('categories').select('nome, slug, emoji');
  const categorias = cats ?? [];

  const sortKey = searchParams.sort && SORTS[searchParams.sort] ? searchParams.sort : 'vendas';
  const sort = SORTS[sortKey];

  let q = supabase.from('products').select('*, stores(nome, nivel)').eq('status', 'ativo');
  if (searchParams.q) q = q.ilike('titulo', `%${searchParams.q}%`);
  if (searchParams.cat) {
    const cat = categorias.find((c: any) => c.slug === searchParams.cat);
    if (cat) q = q.eq('categoria', cat.nome);
  }
  const min = Number(searchParams.min); const max = Number(searchParams.max);
  if (min > 0) q = q.gte('preco', min);
  if (max > 0) q = q.lte('preco', max);
  q = q.order(sort.col, { ascending: sort.asc });

  const { data } = await q.limit(60);
  const produtos = (data ?? []) as Product[];

  return (
    <>
      <Nav />
      <style>{`
        .cat-shell{display:flex;gap:28px;max-width:1200px;margin:0 auto;padding:28px 20px 60px}
        .cat-side{width:230px;flex-shrink:0}
        .cat-main{flex:1;min-width:0}
        @media(max-width:820px){.cat-shell{flex-direction:column}.cat-side{width:100%}}
      `}</style>
      <div className="cat-shell">
        <aside className="cat-side">
          <Suspense fallback={null}><Filters categorias={categorias} /></Suspense>
        </aside>
        <div className="cat-main">
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, marginBottom: 16 }}>Explorar produtos</h1>
          <Suspense fallback={null}><Toolbar total={produtos.length} sort={sortKey} /></Suspense>
          {produtos.length
            ? <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            : <p className="muted" style={{ marginTop: 20 }}>Nenhum produto encontrado com esses filtros.</p>}
        </div>
      </div>
    </>
  );
}
