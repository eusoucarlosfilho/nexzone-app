import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import PartnerOfferCard from '@/components/PartnerOfferCard';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import Carousel, { type ItemDestaque } from '@/components/Carousel';
import { descontoPct, formatarPreco } from '@/lib/ofertas/tipos';
import { vendedorPublico } from '@/lib/vendedorPublico';
import Link from 'next/link';
import CategoryIcon, { categoryColors } from '@/components/CategoryIcon';
import Icon from '@/components/Icon';
import UltimasVendas from '@/components/UltimasVendas';
import LinkRastreado from '@/components/v3/LinkRastreado';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { numerosReais, vendasRecentes, type ProvaSocialNumeros, type VendaRecente } from '@/lib/provaSocial';
import { stripeAvailable } from '@/lib/payments/stripe';
import type { Product } from '@/lib/types';
import { produtosPublicos } from '@/lib/vendedorPublico';
import { PRODUTO_CARD } from '@/lib/consultas';
import { CATEGORIAS, contarPorCategoria, acharCategoria } from '@/lib/categorias';

export const dynamic = 'force-dynamic';

// Página inicial (V3 · comprador): diz em uma linha o que é o site, busca em destaque,
// atalhos de categoria e vitrines REAIS. Sem números, depoimentos, selos ou garantias inventados:
// contadores só com os números reais acima do mínimo do admin; selos só com o que o checkout faz de fato.
export default async function Home() {
  const supabase = createClient();
  const cfg = await getSettings();
  const { support_email, commission_percent } = cfg;
  const nowIso = new Date().toISOString();

  let reais: ProvaSocialNumeros = { lojas: 0, produtos: 0, vendas: 0 };
  let recentes: VendaRecente[] = [];
  let cartao = false;
  try {
    const admin = createAdminClient();
    [reais, recentes, cartao] = await Promise.all([
      numerosReais(admin),
      cfg.ps_mostrar_ultimas_vendas ? vendasRecentes(admin, 8) : Promise.resolve([] as VendaRecente[]),
      stripeAvailable().catch(() => false), // "Pix ou cartão" só se o cartão estiver de fato disponível no checkout
    ]);
  } catch { /* sem números: os contadores ficam escondidos */ }
  const mostra = {
    produtos: cfg.ps_mostrar_contadores && reais.produtos > 0 && reais.produtos >= cfg.ps_min_produtos,
    lojas: cfg.ps_mostrar_contadores && reais.lojas > 0 && reais.lojas >= cfg.ps_min_lojas,
    vendas: cfg.ps_mostrar_contadores && cfg.ps_mostrar_vendas && reais.vendas > 0 && reais.vendas >= cfg.ps_min_vendas,
  };
  const algumContador = mostra.produtos || mostra.lojas || mostra.vendas;

  const [destRes, altaRes, novoRes, catsRes, mix, todasParceiras] = await Promise.all([
    supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').gt('destaque_ate', nowIso).order('destaque_ate', { ascending: false }).limit(6),
    supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').gt('vendas', 0).order('vendas', { ascending: false }).order('nota', { ascending: false }).limit(8),
    supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').order('created_at', { ascending: false }).limit(8),
    supabase.from('products').select('categoria').eq('status', 'ativo'),
    configMix(),
    ofertasAtivas({ limite: 36 }),
  ]);
  const destaques = produtosPublicos(destRes.data as Product[] | null);
  const maisVendidos = produtosPublicos(altaRes.data as Product[] | null);
  const novidades = produtosPublicos(novoRes.data as Product[] | null);
  const vazio = novidades.length === 0;

  // Atalhos: categorias com produto ativo, das mais cheias para as menos (até 8)
  const porCategoria = contarPorCategoria(catsRes.data as { categoria: string }[] | null);
  const cats = CATEGORIAS.filter((c) => (porCategoria[c.nome] || 0) > 0)
    .sort((a, b) => (porCategoria[b.nome] || 0) - (porCategoria[a.nome] || 0))
    .slice(0, 8);
  const taxa = commission_percent ?? 3;

  // Produtos externos: seção própria depois das vitrines nativas (respeita as chaves do admin)
  const parceirasVisiveis = visiveis(todasParceiras, mix);
  const parceiras = parceirasVisiveis.slice(0, mix.homeQtd);

  // Faixa de destaque do topo: nativos em destaque (destaque_ate) primeiro, depois as ofertas
  // externas marcadas como destaque no Admin › Ofertas parceiras. Até 10 itens.
  const real = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  const itensDestaque: ItemDestaque[] = [
    ...destaques.map((p): ItemDestaque => {
      const cat = acharCategoria(p.categoria);
      const preco = p.preco_promo ?? p.preco;
      return {
        key: 'p-' + p.id, href: `/produto/${p.id}`, titulo: p.titulo,
        // loja não verificada chega sem dados (RLS) e vira "Loja": nesse caso mostra só a categoria
        meta: [p.stores ? vendedorPublico(p.stores).nome : null, cat?.nome || p.categoria].filter((x) => x && x !== 'Loja').join(' · '),
        preco: real(preco), precoDe: p.preco_promo ? real(p.preco) : null,
        desconto: p.preco_promo && p.preco > 0 ? Math.round((1 - p.preco_promo / p.preco) * 100) : 0,
        img: p.capa_url || null, categoria: cat?.slug || p.categoria || null, externo: false,
      };
    }),
    ...(mix.ativo ? parceirasVisiveis.filter((o) => o.featured) : []).map((o): ItemDestaque => {
      const cat = acharCategoria(o.category);
      return {
        key: 'o-' + o.id, href: `/oferta/${o.slug}`, titulo: o.title,
        meta: cat?.nome || o.category || 'Oferta',
        preco: formatarPreco(o.price_reference, o.currency), precoDe: formatarPreco(o.price_from, o.currency),
        desconto: descontoPct(o.price_reference, o.price_from),
        img: o.image_url || null, categoria: cat?.slug || o.category || null, externo: true,
      };
    }),
  ].slice(0, 10);

  return (
    <>
      <Nav />
      <main>
        {itensDestaque.length > 0 && (
          <section className="nz car-topo" aria-label="Produtos em destaque"><div className="c">
            <Carousel items={itensDestaque} />
          </div></section>
        )}

        <section className="v3-hero" aria-labelledby="v3-hero-t">
          <div className="v3-hero-in">
            <div className="v3-hero-tx">
              <p className="v3-eyebrow">Marketplace de produtos digitais</p>
              <h1 id="v3-hero-t" className="v3-h1">Produtos digitais para <span className="g">criar, aprender e vender mais</span>.</h1>
              <p className="v3-sub">Prompts de IA, planilhas e templates, cursos e e-books, design, automações e muito mais, de criadores independentes. Pague {cartao ? 'com Pix ou cartão' : 'com Pix'} e acesse em Minhas compras.</p>
              <form action="/produtos" method="get" role="search" className="v3-busca" aria-label="Buscar produtos">
                <label htmlFor="h-q" className="sr-only">O que você procura?</label>
                <Icon name="search" size={20} color="#5A5A72" strokeWidth={2.2} />
                <input id="h-q" name="q" type="search" placeholder="O que você procura? Ex.: planilha financeira" maxLength={100} autoComplete="off" enterKeyHint="search" />
                <button className="btn btn-pri" type="submit">Buscar</button>
              </form>
              {cfg.ps_selos && (
                <ul className="v3-selos" aria-label="Como funciona a compra">
                  <li><Icon name="lock" size={16} />{cartao ? 'Pix ou cartão' : 'Pagamento via Pix'}</li>
                  <li><Icon name="bag" size={16} />Acesso em Minhas compras</li>
                  <li><Icon name="chat" size={16} />Suporte pelo site</li>
                </ul>
              )}
              {algumContador && (
                <div className="v3-nums">
                  {mostra.produtos && <div><b>{reais.produtos.toLocaleString('pt-BR')}</b><small>{reais.produtos === 1 ? 'produto' : 'produtos'}</small></div>}
                  {mostra.lojas && <div><b>{reais.lojas.toLocaleString('pt-BR')}</b><small>{reais.lojas === 1 ? 'loja' : 'lojas'}</small></div>}
                  {mostra.vendas && <div><b>{reais.vendas.toLocaleString('pt-BR')}</b><small>{reais.vendas === 1 ? 'venda realizada' : 'vendas realizadas'}</small></div>}
                </div>
              )}
            </div>

            {cats.length > 0 && (
              <nav className="v3-cats" aria-label="Categorias em destaque">
                <div className="v3-cats-hd"><h2>Categorias</h2><Link href="/produtos">Ver todas<Icon name="chevronRight" size={16} /></Link></div>
                <div className="v3-cats-l">
                  {cats.map((c) => (
                    <Link key={c.slug} href={`/categoria/${c.slug}`} className="v3-cat">
                      <span className="v3-cat-ic" aria-hidden="true" style={{ background: categoryColors(c.slug).bg }}><CategoryIcon cat={c.slug} size={22} /></span>
                      <span className="v3-cat-n">{c.nome}</span>
                      <small>{(porCategoria[c.nome] || 0).toLocaleString('pt-BR')} {(porCategoria[c.nome] || 0) === 1 ? 'produto' : 'produtos'}</small>
                    </Link>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </section>

        {vazio ? (
          <section className="nz"><div className="c">
            <div className="card" style={{ textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800 }}>Os primeiros produtos estão chegando</h2>
              <p className="muted" style={{ margin: '6px 0 16px' }}>Tem um produto digital? Você pode ser um dos primeiros vendedores.</p>
              <LinkRastreado href="/vender" className="btn btn-dark" evento="vendedor_cta" dados={{ origem: 'home' }}>Cadastrar meu produto</LinkRastreado>
            </div>
          </div></section>
        ) : (
          <>
            {maisVendidos.length > 0 && (
              <section className="nz" aria-labelledby="h-mv"><div className="c">
                <div className="v3-st"><div><div className="slabel">Em alta</div><h2 id="h-mv">Mais vendidos</h2></div><Link href="/produtos?sort=vendas" className="v3-st-l">Ver mais<Icon name="chevronRight" size={16} /></Link></div>
                <div className="pg">{maisVendidos.map((p) => <ProductCard key={p.id} p={p} origem="home" />)}</div>
              </div></section>
            )}

            <section className="nz" aria-labelledby="h-rc"><div className="c">
              <div className="v3-st"><div><div className="slabel">Novidades</div><h2 id="h-rc">Recém-chegados</h2></div><Link href="/produtos?sort=novos" className="v3-st-l">Ver mais<Icon name="chevronRight" size={16} /></Link></div>
              <div className="pg">{novidades.map((p) => <ProductCard key={p.id} p={p} origem="home" />)}</div>
            </div></section>
          </>
        )}

        {parceiras.length > 0 && (
          <section className="nz" aria-labelledby="h-of"><div className="c">
            <div className="v3-st"><div><div className="slabel">Selecionados</div><h2 id="h-of">{mix.mostrarOrigem ? 'Ofertas de parceiros' : 'Mais ofertas para você'}</h2></div></div>
            <p className="muted v3-st-sub">
              {mix.mostrarOrigem ? 'Produtos de plataformas parceiras. A compra é feita no site do parceiro.' : 'A compra destes itens é finalizada no site do vendedor.'}
            </p>
            <div className="pg">{parceiras.map((o) => <PartnerOfferCard key={o.id} o={o} mostrarOrigem={mix.mostrarOrigem} origem="home" />)}</div>
          </div></section>
        )}

        <section className="nz" aria-labelledby="h-cf"><div className="c">
          <div className="v3-passos">
            <h2 id="h-cf">Como funciona a compra</h2>
            <ol>
              <li><b>1</b><div><h3>Escolha</h3><p>Veja a descrição, a forma de entrega, as avaliações e tire dúvidas com o vendedor.</p></div></li>
              <li><b>2</b><div><h3>Pague {cartao ? 'com Pix ou cartão' : 'com Pix'}</h3><p>Entre na sua conta e finalize o pagamento no checkout.</p></div></li>
              <li><b>3</b><div><h3>Acesse</h3><p>Com o pagamento confirmado, o produto é liberado em Minhas compras.</p></div></li>
            </ol>
            <Link href="/como-funciona" className="btn btn-ghost btn-sm">Saiba mais sobre a compra</Link>
          </div>
        </div></section>

        <section className="nz"><div className="c">
          <div className="band">
            <div style={{ maxWidth: 620 }}>
              <h2>Tem um produto digital? Venda aqui.</h2>
              <p>Loja grátis, sem mensalidade. Você só paga {String(taxa).replace('.', ',')}% quando vender e acompanha tudo pelo painel.</p>
            </div>
            <LinkRastreado href="/seja-vendedor" className="btn btn-pri btn-lg" evento="vendedor_cta" dados={{ origem: 'home' }}>Criar minha loja grátis</LinkRastreado>
          </div>
        </div></section>
      </main>

      {cfg.ps_mostrar_ultimas_vendas && recentes.length > 0 && <UltimasVendas vendas={recentes} />}
      <Footer supportEmail={support_email} />
    </>
  );
}
