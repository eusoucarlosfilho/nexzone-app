import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import { produtosPublicos } from '@/lib/vendedorPublico';
import { PRODUTO_CARD, termoBusca } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function BuscaPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || '').toString().trim();
  const supabase = createClient();
  let produtos: Product[] = [];
  if (q) {
    const { data } = await supabase.from('products')
      .select(PRODUTO_CARD).eq('status', 'ativo').ilike('titulo', `%${termoBusca(q)}%`)
      .order('vendas', { ascending: false }).limit(48);
    produtos = produtosPublicos(data as Product[] | null);
  }

  return (
    <>
      <Nav />
      <section className="nz"><div className="c">
        <div className="st">
          <div className="slabel">Busca</div>
          <h2>{q ? `Resultados para "${q}"` : 'Buscar produtos'}</h2>
        </div>
        {q
          ? (produtos.length
              ? <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              : <p className="muted">Nenhum produto encontrado para “{q}”. Tente outra palavra.</p>)
          : <p className="muted">Digite algo na busca da página inicial.</p>}
      </div></section>
    </>
  );
}
