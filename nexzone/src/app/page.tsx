import Nav from '@/components/Nav';
import { temaDe } from '@/lib/campanhasSite';
import { campanhaNoAr } from '@/lib/campanhasSite-servidor';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import PartnerOfferCard from '@/components/PartnerOfferCard';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import Carousel, { type ItemDestaque, type SlideCampanha } from '@/components/Carousel';
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
import type { Metadata } from 'next';
import { dadosWebSite, dadosOrganizacao, jsonLd } from '@/lib/seoSite';
import { lerSeoConfig } from '@/lib/seo-servidor';
import OfertaDoDiaCard from '@/components/OfertaDoDiaCard';
import PixelInstitucional from '@/components/PixelInstitucional';
import Contagem from '@/components/Contagem';
import OfertasDoDiaVitrine from '@/components/OfertasDoDiaVitrine';
import { vitrineOfertasDia } from '@/lib/ofertasDia-servidor';
import { ofertaDoDia, cfgCanais, cfgBF, listarJogos, lerTemaBlack, ofertasAntecipadas, painelBF } from '@/lib/crescimento-servidor';
import { faseBF } from '@/lib/crescimento';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export const dynamic = 'force-dynamic';

// Página inicial (V3 · comprador): diz em uma linha o que é o site, busca em destaque,
// atalhos de categoria e vitrines REAIS. Sem números, depoimentos, selos ou garantias inventados:
// contadores só com os números reais acima do mínimo do admin; selos só com o que o checkout faz de fato.
export default async function Home() {
  const supabase = createClient();
  const cfg = await getSettings();
  const { support_email } = cfg;
  const seo = await lerSeoConfig().catch(() => null);
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
  // Planos (SQL 21): Topo fixo na home + rodízio dos Destaques; os destaques pagos avulsos continuam valendo
  let doPlano: Product[] = [];
  if (cfg.taxas.planosPagosAtivos) {
    try {
      const { data: pl, error: plErr } = await supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').in('plano', ['topo', 'destaque']).limit(60);
      if (!plErr) {
        const lista = (pl ?? []) as unknown as Product[];
        const topo = lista.filter((x: any) => x.plano === 'topo');
        const rodizio = lista.filter((x: any) => x.plano === 'destaque').map((x) => ({ x, r: Math.random() })).sort((a, b) => a.r - b.r).map((o) => o.x).slice(0, 6);
        doPlano = [...topo, ...rodizio];
      }
    } catch { /* sem SQL 21 */ }
  }
  // Crescimento: oferta do dia, canais, Black Friday e jogos com anúncio (cada um falha sozinho, sem derrubar a home)
  const [oferta, canais, bf, jogosTop, vitrineDia] = await Promise.all([
    ofertaDoDia().catch(() => null), cfgCanais().catch(() => null), cfgBF().catch(() => null), listarJogos().then((l) => l.slice(0, 12)).catch(() => []),
    vitrineOfertasDia(), // Admin › Ofertas do dia (curadoria): quando no ar, substitui o card único da oferta do dia
  ]);
  const fase = bf ? faseBF(bf) : 'depois';
  // Tema Black (Black November): bloco da campanha no topo + vitrine de descontos reais
  const tema = await lerTemaBlack();
  const bannerCampanha = await campanhaNoAr('banner'); // Admin › Campanhas e ofertas (SQL 36)
  const vitrineBlack: Product[] = !tema.ativo ? []
    : tema.fase === 'black' ? await painelBF().then((r) => r.produtos.slice(0, 8)).catch(() => [])
    : await ofertasAntecipadas(8);
  const diaBR = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  const vistos = new Set<string>();
  const destaques = produtosPublicos([...doPlano, ...((destRes.data ?? []) as unknown as Product[])].filter((x) => (vistos.has(x.id) ? false : (vistos.add(x.id), true))).slice(0, 12));
  const maisVendidos = produtosPublicos(altaRes.data as Product[] | null);
  const novidades = produtosPublicos(novoRes.data as Product[] | null);
  const vazio = novidades.length === 0;

  // Atalhos: categorias com produto ativo, das mais cheias para as menos (até 8)
  const porCategoria = contarPorCategoria(catsRes.data as { categoria: string }[] | null);
  const cats = CATEGORIAS.filter((c) => (porCategoria[c.nome] || 0) > 0)
    .sort((a, b) => (porCategoria[b.nome] || 0) - (porCategoria[a.nome] || 0))
    .slice(0, 8);
  const taxa = cfg.taxas.planoBasico;

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

  // Carrossel do topo: a Black November e as campanhas do admin passam junto com os produtos em destaque
  const slidesTopo: SlideCampanha[] = [];
  if (tema.ativo && tema.fase) {
    const aoVivo = tema.fase === 'black';
    slidesTopo.push({
      key: 'black', segundos: 9, marcaDagua: 'BLACK',
      tag: aoVivo ? `● AO VIVO · BLACK NOVEMBER ATÉ ${diaBR(tema.cfg.fim)}` : `BLACK NOVEMBER · ${diaBR(tema.cfg.inicio)} A ${diaBR(tema.cfg.fim)}`,
      titulo: aoVivo ? 'O mês inteiro com' : 'O mês mais barato do ano', destaque: aoVivo ? 'desconto de verdade.' : 'é aqui.',
      texto: aoVivo
        ? `Contas, skins, moedas e gift cards com pelo menos ${tema.cfg.descontoMin}% de desconto em cima do preço de antes, todo o mês de novembro. Pix na hora e dinheiro protegido até a entrega.`
        : `Contas, skins, moedas e gift cards com pelo menos ${tema.cfg.descontoMin}% de desconto de verdade, o mês inteiro. Entre na lista e seja avisado no minuto em que abrir.`,
      alvo: Date.parse(aoVivo ? tema.cfg.fim : tema.cfg.inicio), rotuloAlvo: aoVivo ? 'Termina em' : 'Começa em',
      cta: aoVivo ? 'Ver as ofertas' : 'Quero ser avisado', href: '/black-friday?utm_source=site&utm_medium=home_carrossel',
      cta2: vitrineBlack.length > 0 ? (aoVivo ? 'Maiores descontos' : 'Já com desconto') : null, href2: vitrineBlack.length > 0 ? '#ofertas-black' : null,
      cards: [
        { n: '%', t: `Mínimo de ${tema.cfg.descontoMin}% OFF`, s: 'Calculado sobre o preço de antes. Ninguém sobe o preço para fingir promoção.', href: '/black-friday?utm_source=site&utm_medium=home_card' },
        { n: '$', t: 'Vende aqui? Entre na Black', s: 'Escolha o preço da campanha. O site coloca no ar e tira sozinho.', href: '/vender/black-friday' },
      ],
      fundo: '#000000', cor: '#FFFFFF', botao: '#FF6B00', botaoTexto: '#000000',
    });
  }
  if (bannerCampanha) {
    const t = temaDe(bannerCampanha.tema);
    const link = bannerCampanha.link ? bannerCampanha.link + (bannerCampanha.link.includes('?') ? '&' : '?') + 'utm_source=site&utm_medium=home_carrossel' : null;
    slidesTopo.push({
      key: `campanha-${bannerCampanha.id ?? 'x'}`, tag: 'OFERTA DO MOMENTO', titulo: bannerCampanha.titulo, texto: bannerCampanha.mensagem || null,
      cta: bannerCampanha.botao || (link ? 'Ver ofertas' : null), href: link,
      alvo: Date.parse(bannerCampanha.fim) - Date.now() < 7 * 86400000 ? Date.parse(bannerCampanha.fim) : null, rotuloAlvo: 'Termina em',
      img: bannerCampanha.imagem_url || bannerCampanha.imagem_mobile_url || null, imgMobile: bannerCampanha.imagem_mobile_url || null,
      fundo: t.fundo, cor: t.texto, botao: t.botao, botaoTexto: t.botaoTexto,
    });
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dadosWebSite()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dadosOrganizacao(seo?.perfis ?? [], support_email || null)) }} />
      <PixelInstitucional />
      <Nav />
      <main>
        {!tema.ativo && bf && fase !== 'depois' && (
          <Link href="/black-friday" className="bf-faixa" style={{ display: 'block', background: '#0E0E1A', color: '#fff', textDecoration: 'none' }}>
            <div className="c" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px var(--gut)', flexWrap: 'wrap', fontSize: 14 }}>
              <b style={{ fontFamily: 'Outfit', color: '#FF9A3C' }}>BLACK FRIDAY GAMER</b>
              <span>{fase === 'antes' ? 'começa em' : 'termina em'}</span>
              <Contagem alvo={Date.parse(fase === 'antes' ? bf.inicio : bf.fim)} style={{ fontFamily: 'Outfit', fontWeight: 900 }} />
              <span style={{ textDecoration: 'underline' }}>{fase === 'antes' ? 'Entrar na lista' : 'Ver ofertas'}</span>
            </div>
          </Link>
        )}
        {(itensDestaque.length > 0 || slidesTopo.length > 0) && (
          <section className="nz car-topo" aria-label="Destaques"><div className="c">
            <Carousel items={itensDestaque} slides={slidesTopo} />
          </div></section>
        )}

        <section className="v3-hero" aria-labelledby="v3-hero-t">
          <div className="v3-hero-in">
            <div className="v3-hero-tx">
              <p className="v3-eyebrow">Marketplace gamer e de produtos digitais</p>
              <h1 id="v3-hero-t" className="v3-h1">Contas, itens e gift cards <span className="g">com o seu dinheiro protegido</span>.</h1>
              <p className="v3-sub">Contas, skins, moedas, gift cards, keys e serviços dos seus jogos favoritos, além de produtos digitais de criadores independentes. Pague {cartao ? 'com Pix ou cartão' : 'com Pix'}: o vendedor só recebe depois do prazo de garantia.</p>
              <form action="/produtos" method="get" role="search" className="v3-busca" aria-label="Buscar produtos">
                <label htmlFor="h-q" className="sr-only">O que você procura?</label>
                <Icon name="search" size={20} color="#5A5A72" strokeWidth={2.2} />
                <input id="h-q" name="q" type="search" placeholder="O que você procura? Ex.: conta Free Fire, Robux, gift card" maxLength={100} autoComplete="off" enterKeyHint="search" />
                <button className="btn btn-pri" type="submit">Buscar</button>
              </form>
              {cfg.ps_selos && (
                <ul className="v3-selos" aria-label="Como funciona a compra">
                  <li><Icon name="lock" size={16} />{cartao ? 'Pix ou cartão' : 'Pagamento via Pix'}</li>
                  <li><Icon name="shield" size={16} />Dinheiro protegido até a entrega</li>
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

        {vitrineDia && (
          <section className="nz" aria-labelledby="h-odd"><div className="c">
            <div className="v3-st"><div><div className="slabel">Seleção de hoje</div><h2 id="h-odd" className="odd-t">{vitrineDia.titulo}</h2></div><Link href="/oferta-do-dia" className="v3-st-l">Oferta do dia<Icon name="chevronRight" size={16} /></Link></div>
            <p className="v3-st-sub">{vitrineDia.subtitulo}</p>
            <OfertasDoDiaVitrine itens={vitrineDia.itens.length}>
              <div className="pg odd-pg">
                {vitrineDia.itens.map((it, i) => (
                  <div key={it.produto.id} className="odd-item" data-oferta={it.produto.id} data-pos={i + 1}>
                    {it.fim && <div className="odd-tempo"><Icon name="clock" size={13} /> Termina em <Contagem alvo={it.fim} rotuloFim="Encerrada" /></div>}
                    <ProductCard p={it.produto} origem="home" />
                  </div>
                ))}
              </div>
            </OfertasDoDiaVitrine>
            <style dangerouslySetInnerHTML={{ __html: '.odd-t{letter-spacing:.5px}.odd-item{position:relative;display:flex;flex-direction:column}.odd-tempo{display:flex;align-items:center;gap:5px;align-self:flex-start;margin-bottom:6px;background:#111;color:#FFC83D;font-size:12px;font-weight:800;border-radius:999px;padding:4px 10px}' }} />
          </div></section>
        )}

        {oferta && !vitrineDia && (
          <section className="nz" aria-label="Oferta do dia"><div className="c">
            <OfertaDoDiaCard p={oferta.produto} fim={oferta.fim} canais={{ whatsapp: canais?.whatsapp || '', telegram: canais?.telegram || '' }} />
          </div></section>
        )}

        {tema.ativo && vitrineBlack.length > 0 && (
          <section className="nz" id="ofertas-black" aria-labelledby="h-bfv" style={{ scrollMarginTop: 120 }}><div className="c"><div className="bfv">
            <div className="v3-st"><div><div className="slabel">{tema.fase === 'black' ? 'Black November' : 'Esquenta Black'}</div><h2 id="h-bfv">{tema.fase === 'black' ? 'Os maiores descontos da Black' : 'Já com desconto hoje'}</h2></div><Link href="/black-friday" className="v3-st-l">Ver tudo<Icon name="chevronRight" size={16} /></Link></div>
            <p className="v3-st-sub">{tema.fase === 'black' ? 'Ordenados pelo maior desconto. Preço da campanha válido até o fim da Black.' : 'Não precisa esperar: estes anúncios já estão com preço promocional. Maior desconto primeiro.'}</p>
            <div className="pg">{vitrineBlack.map((p) => <ProductCard key={p.id} p={p} origem="home" />)}</div>
          </div></div></section>
        )}

        {jogosTop.length > 0 && (
          <section className="nz" aria-labelledby="h-jg"><div className="c">
            <div className="v3-st"><div><div className="slabel">Por jogo</div><h2 id="h-jg">Jogos populares</h2></div><Link href="/jogos" className="v3-st-l">Ver todos<Icon name="chevronRight" size={16} /></Link></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {jogosTop.map((j) => <Link key={j.slug} href={`/jogo/${j.slug}`} className="chip">{j.nome} <small className="muted">· {j.qtd}</small></Link>)}
            </div>
          </div></section>
        )}

        {vazio ? (
          <section className="nz"><div className="c">
            <div className="card" style={{ textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800 }}>Os primeiros anúncios estão chegando</h2>
              <p className="muted" style={{ margin: '6px 0 16px' }}>Vende contas, itens, gift cards ou produtos digitais? Seja um dos primeiros lojistas.</p>
              <LinkRastreado href="/vender" className="btn btn-dark" evento="vendedor_cta" dados={{ origem: 'home' }}>Anunciar grátis</LinkRastreado>
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
              <h2>{tema.ativo ? 'A Black November é o maior pico de vendas do ano. Esteja dentro.' : 'Tem produto digital ou serviço para vender? Venda aqui.'}</h2>
              <p>Anúncio grátis, sem mensalidade. Você paga a partir de {String(taxa).replace('.', ',')}% só quando vender e saca por Pix.{tema.ativo ? ' Inscreva seus produtos na Black November e apareça para quem está pronto para comprar.' : ''}</p>
            </div>
            <LinkRastreado href={tema.ativo ? '/vender/black-friday' : '/seja-vendedor'} className="btn btn-pri btn-lg" evento="vendedor_cta" dados={{ origem: 'home' }}>{tema.ativo ? 'Inscrever na Black November' : 'Criar minha loja grátis'}</LinkRastreado>
          </div>
        </div></section>
      </main>

      {cfg.ps_mostrar_ultimas_vendas && recentes.length > 0 && <UltimasVendas vendas={recentes} />}
      <Footer supportEmail={support_email} />
    </>
  );
}
