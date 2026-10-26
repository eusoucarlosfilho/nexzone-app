import Nav from '@/components/Nav';
import GradeMista from '@/components/GradeMista';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import { intercalar, type ItemMix } from '@/lib/ofertas/mix';
import type { OfertaVitrine } from '@/lib/ofertas/tipos';
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
  // Ofertas de parceiros completam os resultados (nativos primeiro, com teto de participação)
  let grade: ItemMix<Product, OfertaVitrine>[] = produtos.map((item) => ({ tipo: 'nativo' as const, item }));
  let mostrarOrigem = false;
  if (q) {
    const [mix, parceiros] = await Promise.all([configMix(), ofertasAtivas({ termo: termoBusca(q), limite: 24 })]);
    grade = intercalar(produtos, visiveis(parceiros, mix), mix);
    mostrarOrigem = mix.mostrarOrigem;
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
          ? (grade.length
              ? <GradeMista itens={grade} mostrarOrigem={mostrarOrigem} />
              : <p className="muted">Nenhum produto encontrado para “{q}”. Tente outra palavra.</p>)
          : <p className="muted">Digite algo na busca da página inicial.</p>}
      </div></section>
    </>
  );
}
