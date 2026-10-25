import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';
import { produtosPublicos } from '@/lib/vendedorPublico';
import CategoryIcon from '@/components/CategoryIcon';

export const dynamic = 'force-dynamic';

export default async function CategoriaPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: cat } = await supabase.from('categories').select('nome, emoji').eq('slug', params.slug).maybeSingle();
  if (!cat) notFound();

  const { data } = await supabase.from('products')
    .select('*, stores(nome, nivel, ocultar_vendedor)').eq('status', 'ativo').eq('categoria', cat.nome)
    .order('vendas', { ascending: false });
  const produtos = produtosPublicos(data as Product[] | null);

  return (
    <>
      <Nav />
      <section className="nz"><div className="c">
        <div className="st">
          <div className="slabel">Categoria</div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><CategoryIcon cat={params.slug} size={28} /> {cat.nome}</h2>
        </div>
        {produtos.length
          ? <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          : <p className="muted">Ainda não há produtos nesta categoria.</p>}
      </div></section>
    </>
  );
}
