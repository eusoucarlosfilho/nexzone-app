// Catálogo único (busca + filtros + ordenação + grade) usado por /produtos e /categoria/[slug].
// Regras de exibição:
// - Só produtos com status 'ativo' e só colunas públicas (PRODUTO_CARD; nunca conteúdo de entrega).
// - Vendedor oculto aplicado antes de chegar à página (produtosPublicos).
// - Ofertas externas: só ativas e visíveis pela configuração do admin (ofertasAtivas + visiveis),
//   completando a ÚLTIMA página, depois dos nativos e com o teto de participação do mix.
import { lerTaxas } from '@/lib/settings';
import { pesoDoPlano } from '@/lib/taxas';
import { Suspense } from 'react';
import Link from 'next/link';
import Filters from './Filters';
import Toolbar from './Toolbar';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import { CATEGORIAS, acharCategoria, contarPorCategoria, type Categoria } from '@/lib/categorias';
import { produtosPublicos } from '@/lib/vendedorPublico';
import { PRODUTO_CARD, termoBusca } from '@/lib/consultas';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import GradeMista from '@/components/GradeMista';
import CategoryIcon, { categoryColors } from '@/components/CategoryIcon';
import Icon from '@/components/Icon';
import RegistrarBusca from '@/components/v3/RegistrarBusca';
import type { OrigemCard } from '@/components/ProductCard';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import { intercalar, type ItemMix } from '@/lib/ofertas/mix';
import type { OfertaVitrine } from '@/lib/ofertas/tipos';
import {
  categoriasDoTermo, faixaPreco, noBusca, noPreco, ordemValida, ordenarEmMemoria, palavrasDoTermo, type Leve, type Ordem,
} from './busca';

const POR_PAGINA = 24;
// Ordenações calculadas no servidor da aplicação (relevância e preço efetivo) usam até este número de candidatos.
const LIMITE_MEMORIA = 240;
const COLUNAS_LEVES = 'id, titulo, categoria, preco, preco_promo, vendas, nota, created_at, plano, jogo';

export type ParamsCatalogo = { q?: string; cat?: string; min?: string; max?: string; sort?: string; page?: string; aviso?: string };

const money = (v: number) => 'R$ ' + (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));

export default async function Catalogo({ searchParams, catFixa = null }: { searchParams: ParamsCatalogo; catFixa?: Categoria | null }) {
  const supabase = createClient();
  const cfgTaxas = await lerTaxas();
  const basePath = catFixa ? `/categoria/${catFixa.slug}` : '/produtos';

  const termo = String(searchParams.q ?? '').trim().slice(0, 100);
  const palavras = palavrasDoTermo(termo);
  const temTermo = palavras.length > 0;
  const catSel = catFixa ?? (searchParams.cat ? acharCategoria(searchParams.cat) : null);
  const catsTermo = catSel ? [] : categoriasDoTermo(termo);
  const { min, max } = faixaPreco(searchParams.min, searchParams.max);
  const ordem: Ordem = ordemValida(searchParams.sort);
  const page = Math.max(1, Math.min(500, Math.floor(Number(searchParams.page) || 1)));
  const de = (page - 1) * POR_PAGINA;

  const filtros = [noBusca(palavras, catsTermo), noPreco(min, max)].filter(Boolean) as string[];
  const consulta = (cols: string) => {
    let q = supabase.from('products').select(cols, { count: 'exact' }).eq('status', 'ativo');
    if (catSel) q = q.eq('categoria', catSel.nome);
    if (filtros.length) q = q.or(filtros.length === 1 ? filtros[0] : `and(${filtros.join(',')})`);
    return q;
  };

  // Contagem por categoria (filtro lateral e sugestões do estado vazio) em paralelo com a busca.
  const contagemP = supabase.from('products').select('categoria').eq('status', 'ativo');

  let produtos: Product[] = [];
  let total = 0;
  let ordenadoNoBanco = true;
  const emMemoria = (ordem === 'relevancia' && temTermo) || ordem === 'menor' || ordem === 'maior';
  if (emMemoria) {
    const { data: leves, count } = await consulta(COLUNAS_LEVES)
      .order('vendas', { ascending: false }).order('id', { ascending: true }).limit(LIMITE_MEMORIA);
    const lista = ((leves ?? []) as unknown as Leve[]);
    total = count ?? lista.length;
    if (total <= LIMITE_MEMORIA) {
      ordenadoNoBanco = false;
      // Planos pagos ligados: na relevância, Topo e Destaque vêm primeiro (a ordem por preço continua pura)
      let ordenados = ordenarEmMemoria(lista, ordem, termo, palavras, catsTermo);
      if (cfgTaxas.planosPagosAtivos && ordem === 'relevancia') {
        const peso = new Map(ordenados.map((x, i) => [x.id, i]));
        ordenados = [...ordenados].sort((a: any, b: any) => pesoDoPlano(b.plano, cfgTaxas) - pesoDoPlano(a.plano, cfgTaxas) || peso.get(a.id)! - peso.get(b.id)!);
      }
      const ids = ordenados.slice(de, de + POR_PAGINA).map((x) => x.id);
      if (ids.length) {
        const { data } = await supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').in('id', ids);
        const porId = new Map(((data ?? []) as unknown as Product[]).map((p) => [p.id, p]));
        produtos = produtosPublicos(ids.map((id) => porId.get(id)).filter(Boolean) as Product[]);
      }
    }
  }
  if (ordenadoNoBanco) {
    // Muitos resultados (ou ordenação simples): o banco ordena e pagina.
    const col = ordem === 'novos' ? 'created_at' : ordem === 'menor' || ordem === 'maior' ? 'preco' : 'vendas';
    let q = consulta(PRODUTO_CARD);
    // Planos pagos ligados: Topo > Destaque > Básico (ordem alfabética invertida do plano), depois reputação e vendas
    if (cfgTaxas.planosPagosAtivos && col === 'vendas') q = q.order('plano', { ascending: false });
    q = q.order(col, { ascending: ordem === 'menor' });
    if (col === 'vendas') q = q.order('nota', { ascending: false });
    const { data, count } = await q.order('id', { ascending: true }).range(de, de + POR_PAGINA - 1);
    produtos = produtosPublicos(data as unknown as Product[] | null);
    total = count ?? produtos.length;
  }

  const { data: catRows } = await contagemP;
  const porCategoria = contarPorCategoria(catRows as { categoria: string }[] | null);
  const categorias = CATEGORIAS.map((c) => ({ nome: c.nome, slug: c.slug, qtd: porCategoria[c.nome] || 0 }));

  const totalNavegavel = ordenadoNoBanco ? total : Math.min(total, LIMITE_MEMORIA);
  const totalPages = Math.max(1, Math.ceil(totalNavegavel / POR_PAGINA));

  // Ofertas externas só completam a última página.
  let mostrarOrigem = false;
  let grade: ItemMix<Product, OfertaVitrine>[] = produtos.map((item) => ({ tipo: 'nativo' as const, item }));
  if (page === totalPages) {
    const [mix, parceiros] = await Promise.all([
      configMix(),
      ofertasAtivas({ categoria: catSel?.nome ?? null, termo: termo ? termoBusca(termo) : null, min, max, limite: 24 }),
    ]);
    if (mix.ativo) {
      grade = intercalar(produtos, visiveis(parceiros, mix), mix, POR_PAGINA - produtos.length);
      mostrarOrigem = mix.mostrarOrigem;
    }
  }
  const qtdParceiros = grade.filter((g) => g.tipo === 'parceiro').length;
  const resultados = total + qtdParceiros;

  // Links para tirar um filtro (funcionam sem JavaScript)
  const urlSem = (...chaves: (keyof ParamsCatalogo)[]) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (!v || k === 'page' || k === 'aviso' || (chaves as string[]).includes(k)) continue;
      if (catFixa && k === 'cat') continue;
      sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const chips: { rotulo: string; href: string }[] = [];
  if (temTermo) chips.push({ rotulo: `“${termo}”`, href: urlSem('q', 'sort') });
  if (catSel && !catFixa) chips.push({ rotulo: catSel.nome, href: urlSem('cat') });
  if (min || max) chips.push({ rotulo: min && max ? `${money(min)} a ${money(max)}` : min ? `A partir de ${money(min)}` : `Até ${money(max)}`, href: urlSem('min', 'max') });
  const temFiltro = chips.length > 0;

  const origem: OrigemCard = temTermo ? 'busca' : catSel ? 'categoria' : 'catalogo';
  const titulo = temTermo ? `Resultados para “${termo}”` : catSel ? catSel.nome : 'Explorar produtos';
  const sugestoes = categorias.filter((c) => c.qtd > 0 && c.slug !== catSel?.slug).sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  const paramsPaginacao = Object.fromEntries(Object.entries(searchParams).filter(([k]) => k !== 'aviso' && !(catFixa && k === 'cat'))) as Record<string, string | undefined>;

  return (
    <div className="cat-page">
      {temTermo && page === 1 && <RegistrarBusca termo={termo} resultados={resultados} categoria={catSel?.slug ?? null} />}
      <header className="cat-hd">
        {catFixa && (
          <nav className="v3-trilha" aria-label="Você está em">
            <Link href="/">Início</Link><span aria-hidden="true">›</span><Link href="/produtos">Produtos</Link><span aria-hidden="true">›</span><span aria-current="page">{catFixa.nome}</span>
          </nav>
        )}
        <h1 className="cat-h1">
          {catSel && !temTermo && <span className="cat-h1-ic" aria-hidden="true" style={{ background: categoryColors(catSel.slug).bg }}><CategoryIcon cat={catSel.slug} size={22} /></span>}
          <span>{titulo}</span>
        </h1>
      </header>

      <div className="cat-shell">
        <aside className="cat-side" aria-label="Filtros">
          <Suspense fallback={null}>
            <Filters categorias={categorias} modo={catFixa ? 'categoria' : 'produtos'} catAtiva={catSel?.slug ?? ''} />
          </Suspense>
        </aside>
        <div className="cat-main">
          <Suspense fallback={null}><Toolbar total={resultados} ordem={ordem} nFiltros={chips.length - (temTermo ? 1 : 0)} /></Suspense>

          {temFiltro && (
            <div className="v3-chips" aria-label="Filtros ativos">
              {chips.map((c) => (
                <Link key={c.rotulo} href={c.href} className="v3-chip-x" aria-label={`Remover filtro ${c.rotulo}`}>
                  {c.rotulo}<Icon name="x" size={14} strokeWidth={2.6} />
                </Link>
              ))}
              {chips.length > 1 && <Link href={catFixa ? basePath : '/produtos'} className="v3-chip-limpar">Limpar tudo</Link>}
            </div>
          )}

          {searchParams.aviso === 'oferta_indisponivel' && (
            <div className="card" role="status" style={{ marginBottom: 14, fontSize: 14 }}>Essa oferta não está mais disponível. Veja outras opções abaixo.</div>
          )}

          {grade.length ? (
            <GradeMista itens={grade} mostrarOrigem={mostrarOrigem} origem={origem} />
          ) : (
            <div className="v3-vazio">
              <EmptyState icon="search"
                title={page > totalPages ? 'Esta página não tem produtos' : temTermo ? `Nada encontrado para “${termo}”` : 'Nenhum produto encontrado'}
                text={page > totalPages
                  ? 'Volte para a primeira página dos resultados.'
                  : temFiltro
                    ? 'Confira a ortografia, use menos palavras ou tire algum filtro.'
                    : catSel ? 'Ainda não há produtos publicados nesta categoria.' : 'Ainda não há produtos publicados.'}
                action={
                  <div className="v3-vazio-acoes">
                    {page > totalPages && <Link href={urlSem('page')} className="btn btn-pri btn-sm">Ir para a primeira página</Link>}
                    {temTermo && (catSel || min || max) && <Link href={`/produtos?q=${encodeURIComponent(termo)}`} className="btn btn-pri btn-sm">Buscar “{termo}” em todo o site</Link>}
                    {temFiltro && <Link href={catFixa ? basePath : '/produtos'} className="btn btn-ghost btn-sm">Limpar filtros</Link>}
                    {!temFiltro && catSel && <Link href="/produtos" className="btn btn-ghost btn-sm">Ver todos os produtos</Link>}
                  </div>
                } />
              {sugestoes.length > 0 && (
                <div className="v3-sug">
                  <h2>Explore por categoria</h2>
                  <div className="v3-sug-l">
                    {sugestoes.map((c) => (
                      <Link key={c.slug} href={`/categoria/${c.slug}`} className="chip">
                        <CategoryIcon cat={c.slug} size={16} />{c.nome}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {qtdParceiros > 0 && (
            <p className="muted v3-nota-ext">
              {mostrarOrigem
                ? <>Itens com o selo &quot;Oferta de parceiro&quot; são vendidos em sites parceiros, fora do Comprei Barato.</>
                : <>Itens marcados com &quot;Compra no site do vendedor&quot; são finalizados no site do próprio vendedor, fora do Comprei Barato. <Link href="/como-funciona#outros-sites">Saiba mais</Link></>}
            </p>
          )}
          <Pagination basePath={basePath} params={paramsPaginacao} page={Math.min(page, totalPages)} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}
