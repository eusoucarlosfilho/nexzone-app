import Nav from '@/components/Nav';
import Filters from './Filters';
import Toolbar from './Toolbar';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import { CATEGORIAS, acharCategoria, contarPorCategoria } from '@/lib/categorias';
import { produtosPublicos } from '@/lib/vendedorPublico';
import { PRODUTO_CARD, termoBusca } from '@/lib/consultas';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import GradeMista from '@/components/GradeMista';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import { intercalar, type ItemMix } from '@/lib/ofertas/mix';
import type { OfertaVitrine } from '@/lib/ofertas/tipos';

const POR_PAGINA = 24;

export const dynamic = 'force-dynamic';

const SORTS: Record<string, { col: string; asc: boolean }> = {
  vendas: { col: 'vendas', asc: false },
  novos: { col: 'created_at', asc: false },
  menor: { col: 'preco', asc: true },
  maior: { col: 'preco', asc: false },
};

export default async function ProdutosPage({ searchParams }: { searchParams: { q?: string; cat?: string; min?: string; max?: string; sort?: string; page?: string; aviso?: string } }) {
  const supabase = createClient();
  // Filtro lateral: todas as categorias da fonte única, com a contagem de produtos ativos
  const { data: catRows } = await supabase.from('products').select('categoria').eq('status', 'ativo');
  const porCategoria = contarPorCategoria(catRows as { categoria: string }[] | null);
  const categorias = CATEGORIAS.map((c) => ({ nome: c.nome, slug: c.slug, qtd: porCategoria[c.nome] || 0 }));

  const sortKey = searchParams.sort && SORTS[searchParams.sort] ? searchParams.sort : 'vendas';
  const sort = SORTS[sortKey];

  let q = supabase.from('products').select(PRODUTO_CARD, { count: 'exact' }).eq('status', 'ativo');
  const termo = termoBusca(searchParams.q);
  if (termo) q = q.ilike('titulo', `%${termo}%`);
  if (searchParams.cat) {
    const cat = acharCategoria(searchParams.cat);
    if (cat) q = q.eq('categoria', cat.nome);
  }
  const min = Number(searchParams.min); const max = Number(searchParams.max);
  if (min > 0) q = q.gte('preco', min);
  if (max > 0) q = q.lte('preco', max);
  q = q.order(sort.col, { ascending: sort.asc }).order('id', { ascending: true }); // desempate estável para a paginação

  const page = Math.max(1, Math.floor(Number(searchParams.page) || 1));
  const de = (page - 1) * POR_PAGINA;
  const { data, count } = await q.range(de, de + POR_PAGINA - 1);
  const produtos = produtosPublicos(data as Product[] | null);
  const total = count ?? produtos.length;
  const totalPages = Math.max(1, Math.ceil(total / POR_PAGINA));
  const temFiltro = !!(searchParams.q || searchParams.cat || searchParams.min || searchParams.max);

  // Ofertas de parceiros: só completam a ÚLTIMA página (os nativos vêm sempre antes),
  // com o teto de participação definido no admin. Sem a tabela, a lista vem vazia.
  const ultimaPagina = page >= totalPages;
  let mostrarOrigem = false;
  let grade: ItemMix<Product, OfertaVitrine>[] = produtos.map((item) => ({ tipo: 'nativo' as const, item }));
  if (ultimaPagina) {
    const catSel = searchParams.cat ? acharCategoria(searchParams.cat) : null;
    const [mix, parceiros] = await Promise.all([configMix(), ofertasAtivas({ categoria: catSel?.nome ?? null, termo: termo || null, min, max, limite: 24 })]);
    if (mix.ativo) {
      grade = intercalar(produtos, visiveis(parceiros, mix), mix, POR_PAGINA - produtos.length);
      mostrarOrigem = mix.mostrarOrigem;
    }
  }
  const temParceiros = grade.some((g) => g.tipo === 'parceiro');

  return (
    <>
      <Nav />
      <style>{`
        .cat-shell{display:flex;gap:28px;max-width:1200px;margin:0 auto;padding:28px 20px 60px}
        .cat-side{width:230px;flex-shrink:0}
        .cat-main{flex:1;min-width:0}
        @media(max-width:820px){.cat-shell{flex-direction:column;gap:14px;padding-top:18px}.cat-side{width:100%}
          .flt-cats{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
          .flt-cats button{white-space:nowrap;width:auto!important;flex:none;border:1px solid var(--border)!important;margin:0!important}}
      `}</style>
      <div className="cat-shell">
        <aside className="cat-side">
          <Suspense fallback={null}><Filters categorias={categorias} /></Suspense>
        </aside>
        <div className="cat-main">
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, marginBottom: 16 }}>Explorar produtos</h1>
          <Suspense fallback={null}><Toolbar total={total} sort={sortKey} /></Suspense>
          {searchParams.aviso === 'oferta_indisponivel' && (
            <div className="card" role="status" style={{ marginBottom: 14, fontSize: 14 }}>Essa oferta de parceiro não está mais disponível. Veja outras opções abaixo.</div>
          )}
          {grade.length
            ? <GradeMista itens={grade} mostrarOrigem={mostrarOrigem} />
            : <EmptyState icon="search" title="Nenhum produto encontrado"
                text={temFiltro ? 'Tente outra palavra, outra categoria ou uma faixa de preço maior.' : 'Ainda não há produtos publicados.'}
                action={temFiltro ? <Link href="/produtos" className="btn btn-ghost btn-sm">Limpar filtros</Link> : undefined} />}
          {temParceiros && mostrarOrigem && <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Itens com o selo &quot;Oferta de parceiro&quot; são vendidos em sites parceiros, fora do Comprei Barato.</p>}
          <Pagination basePath="/produtos" params={searchParams as Record<string, string | undefined>} page={Math.min(page, totalPages)} totalPages={totalPages} />
        </div>
      </div>
    </>
  );
}
