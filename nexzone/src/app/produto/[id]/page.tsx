import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import Link from 'next/link';
import BuyButton from './BuyButton';
import ProductCard from '@/components/ProductCard';
import PartnerOfferCard from '@/components/PartnerOfferCard';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import ShareButton from '@/components/ShareButton';
import FavButton from '@/components/FavButton';
import Questions from './Questions';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';
import type { Metadata } from 'next';
import Icon from '@/components/Icon';
import { CategoryCover } from '@/components/CategoryIcon';
import { metaDescription, SITE_URL_FALLBACK } from '@/lib/seo';
import { vendedorPublico, produtoPublico, produtosPublicos } from '@/lib/vendedorPublico';
import { galeriaDe } from '@/lib/galeria';
import ProductGallery from './ProductGallery';
import { PRODUTO_CARD, PRODUTO_PAGINA } from '@/lib/consultas';
import { acharCategoria } from '@/lib/categorias';
import { stripeAvailable } from '@/lib/payments/stripe';

const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');
// Forma de entrega: só o TIPO (products.tipo_entrega). O conteúdo pago nunca é lido nesta página.
const ENTREGA: Record<string, { titulo: string; texto: string }> = {
  arquivo: { titulo: 'Arquivo para download', texto: 'Você baixa o arquivo na página do pedido, em Minhas compras.' },
  chave: { titulo: 'Chave ou código de acesso', texto: 'O código aparece na página do pedido, em Minhas compras.' },
  link: { titulo: 'Link de acesso', texto: 'O link fica disponível na página do pedido, em Minhas compras.' },
  acesso: { titulo: 'Acesso liberado', texto: 'As instruções de acesso ficam na página do pedido, em Minhas compras.' },
};
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '');

function Stars({ n, size = 15 }: { n: number; size?: number }) {
  const cheias = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span className="pdp-star" role="img" aria-label={`Nota ${n ? n.toFixed(1) : '0'} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name="star" size={size} strokeWidth={1.6}
          color={i < cheias ? '#FF9A3C' : 'var(--border2)'} style={{ fill: i < cheias ? '#FF9A3C' : 'transparent' }} />
      ))}
    </span>
  );
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data: p } = await supabase.from('products')
    .select('titulo, descricao, capa_url, preco, preco_promo, categoria').eq('id', params.id).eq('status', 'ativo').maybeSingle();
  if (!p) return { title: 'Produto | Comprei Barato' };
  const titulo = String(p.titulo);
  const desc = metaDescription(p.descricao as string | null, titulo);
  const url = `${SITE}/produto/${params.id}`;
  const capa = (p.capa_url as string | null) || null;
  const images = capa ? [{ url: capa, alt: titulo }] : [];
  return {
    title: `${titulo} | Comprei Barato`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: titulo, description: desc, url, siteName: 'Comprei Barato', locale: 'pt_BR', images, type: 'website' },
    twitter: { card: capa ? 'summary_large_image' : 'summary', title: titulo, description: desc, images: capa ? [capa] : [] },
  };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('products')
    .select(PRODUTO_PAGINA).eq('id', params.id).eq('status', 'ativo').single();
  if (!data) notFound();
  // Dados públicos do vendedor (Comprei Barato quando a loja está oculta). O nome real não sai do servidor.
  const p = produtoPublico(data as unknown as Product);
  const vend = vendedorPublico(p.stores);
  const fotos = galeriaDe(p as any); // galeria; produto antigo sem galeria = [capa_url]
  const preco = p.preco_promo ?? p.preco;
  const desconto = p.preco_promo ? Math.round((1 - p.preco_promo / p.preco) * 100) : 0;

  const cat = acharCategoria(p.categoria);
  const garantia = Math.max(0, Math.floor(Number(p.garantia_dias) || 0));
  const entrega = ENTREGA[p.tipo_entrega] || { titulo: 'Acesso ao produto', texto: 'O acesso fica na página do pedido, em Minhas compras.' };

  // Tudo em paralelo. Relacionados: só ativos, sem o próprio produto, poucos itens.
  const [reviewsRes, notasRes, lojaRes, catRes, userRes, perguntasRes, cartao] = await Promise.all([
    supabase.from('reviews').select('nota, comentario, created_at').eq('product_id', p.id).order('created_at', { ascending: false }).limit(10),
    // agregado real de avaliações, sem o limite da lista exibida
    supabase.from('reviews').select('nota').eq('product_id', p.id).limit(5000),
    // "Mais deste vendedor": não aparece quando a loja está oculta
    vend.oficial ? Promise.resolve({ data: [] as Product[] }) : supabase.from('products')
      .select(PRODUTO_CARD).eq('store_id', p.store_id).eq('status', 'ativo').neq('id', p.id).limit(4),
    p.categoria ? supabase.from('products')
      .select(PRODUTO_CARD).eq('categoria', p.categoria).eq('status', 'ativo').neq('id', p.id)
      .order('vendas', { ascending: false }).limit(8) : Promise.resolve({ data: [] as Product[] }),
    supabase.auth.getUser(),
    supabase.from('product_questions')
      .select('id, autor, autor_nome, pergunta, resposta, respondida_em, created_at')
      .eq('product_id', p.id).order('created_at', { ascending: false }).limit(50),
    stripeAvailable().catch(() => false),
  ]);
  const reviews = (reviewsRes.data ?? []) as { nota: number; comentario: string | null; created_at: string }[];
  const notas = ((notasRes.data ?? []) as { nota: number }[]).map((r) => Number(r.nota)).filter((v) => v >= 1 && v <= 5);
  const media = notas.length ? notas.reduce((s, v) => s + v, 0) / notas.length : 0;
  const relacionados = produtosPublicos(lojaRes.data as Product[] | null);
  const relIds = new Set(relacionados.map((r) => r.id));
  const daCategoria = produtosPublicos(catRes.data as Product[] | null).filter((c) => !relIds.has(c.id)).slice(0, 4);
  // Recomendações: ofertas de parceiros só completam as vagas que os nativos não preencheram
  const mixRec = daCategoria.length < 4 ? await configMix() : null;
  const parceirasRec = mixRec?.ativo && p.categoria ? visiveis(await ofertasAtivas({ categoria: p.categoria, limite: 8 }), mixRec).slice(0, 4 - daCategoria.length) : [];
  const user = userRes.data.user;
  const perguntas = (perguntasRes.data ?? []) as any[];
  const vendas = Number(p.vendas) || 0;

  const pageUrl = `${SITE}/produto/${p.id}`;
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.titulo,
    description: metaDescription(p.descricao, p.titulo),
    sku: p.id,
    url: pageUrl,
    ...(fotos.length ? { image: fotos } : {}),
    ...(p.categoria ? { category: p.categoria } : {}),
    brand: { '@type': 'Brand', name: vend.nome },
    offers: {
      '@type': 'Offer',
      url: pageUrl,
      priceCurrency: 'BRL',
      price: Number(preco).toFixed(2),
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: vend.nome },
    },
  };
  if (notas.length > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: (notas.reduce((s, v) => s + v, 0) / notas.length).toFixed(1),
      reviewCount: notas.length,
      bestRating: 5,
      worstRating: 1,
    };
  }
  const jsonLdHtml = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  const Confianca = (
    <ul className="pdp-trust">
      <li><Icon name="bolt" size={16} color="var(--orange-ink)" />Liberado após a confirmação do pagamento</li>
      <li><Icon name="lock" size={16} color="var(--orange-ink)" />{cartao ? 'Pagamento via Pix ou cartão' : 'Pagamento via Pix'}</li>
      {garantia > 0 && <li><Icon name="shield" size={16} color="var(--orange-ink)" />Garantia de {garantia} {garantia === 1 ? 'dia' : 'dias'}</li>}
    </ul>
  );

  const BuyBox = (
    <div className="pdp-box">
      <div className="pdp-price">
        {desconto > 0 && <span className="pdp-old"><span className="sr-only">De </span>{money(p.preco)}</span>}
        <div className="pdp-now">{money(preco)}{desconto > 0 && <span className="pdp-off">-{desconto}%</span>}</div>
      </div>
      <BuyButton productId={p.id} categoria={cat?.slug ?? null} />
      {Confianca}
      <Link href="/como-funciona" className="pdp-como">Como funciona a compra<Icon name="chevronRight" size={14} /></Link>
      <ShareButton titulo={p.titulo} full />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--sub)', fontSize: 13 }}><FavButton productId={p.id} /> Salvar nos favoritos</div>
      <div className="pdp-soldby">Vendido por <strong>{vend.nome}</strong> {vend.oficial
        ? <span className="pdp-oficial">Oficial</span>
        : vend.verificada && <Icon name="check" size={14} color="var(--green)" strokeWidth={2.6} style={{ verticalAlign: '-2px' }} title="Loja verificada" />}</div>
    </div>
  );

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml }} />
      <style>{`
        .pdp{display:flex;gap:36px;max-width:1240px;margin:0 auto;padding:20px 24px 60px;animation:cb-up .5s var(--ease) both;}
        .pdp-main{flex:1;min-width:0;}
        .pdp-aside{width:380px;flex-shrink:0;}
        .pdp-box{position:sticky;top:150px;background:#fff;border:1px solid var(--border);border-radius:28px;padding:28px;box-shadow:0 20px 50px rgba(22,22,42,.08);animation:cb-up .6s var(--ease) .08s both;}
        .pdp-hero{position:relative;aspect-ratio:16/10;border-radius:28px;overflow:hidden;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:110px;margin-bottom:22px;}
        .pdp-hero img{width:100%;height:100%;object-fit:cover;transition:transform .6s var(--ease);}.pdp-hero:hover img{transform:scale(1.03);}
        .pdp-chip{display:inline-flex;align-items:center;min-height:32px;background:var(--soft);color:var(--orange-ink);font-weight:900;font-size:13px;padding:6px 13px;border-radius:50px;}
        a.pdp-chip:hover{background:#FFE3CC}
        .pdp-title{font-family:Outfit;font-size:clamp(26px,3vw,36px);font-weight:900;letter-spacing:-1px;margin:12px 0 8px;line-height:1.12;overflow-wrap:anywhere;}
        .pdp-meta{color:var(--sub);font-size:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
        .pdp-meta a{color:var(--orange-ink);font-weight:800}
        .pdp-star{display:inline-flex;gap:2px;align-items:center;}
        .pdp-sec{margin-top:34px;}
        .pdp-sec h2{font-family:Outfit;font-size:21px;font-weight:800;margin-bottom:14px;letter-spacing:-.4px;}
        .pdp-desc{color:var(--sub);font-size:15px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;}
        .pdp-seller{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--border);border-radius:20px;padding:18px;transition:all .22s var(--ease);}.pdp-seller:hover{border-color:var(--orange);transform:translateY(-2px);}
        .pdp-seller .av{width:52px;height:52px;border-radius:16px;background:var(--text);display:flex;align-items:center;justify-content:center;color:#fff;font-family:Outfit;font-weight:900;font-size:22px;flex:none}
        .pdp-seller-oficial:hover{border-color:var(--border);transform:none;}
        .pdp-seller .av-oficial{background:#fff url(/logo.png) center/contain no-repeat;border:1px solid var(--border);}
        .pdp-oficial{display:inline-block;font-family:Outfit;font-weight:800;font-size:11px;color:#fff;background:#FF6B00;border-radius:50px;padding:2px 8px;vertical-align:1px;}
        .pdp-rev-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:-4px 0 14px;color:var(--sub);font-size:14px}
        .pdp-rev-hd b{font-family:Outfit;font-size:26px;color:var(--text)}
        .pdp-rev{border:1px solid var(--border);border-radius:18px;padding:18px;margin-bottom:10px;}
        .pdp-rev .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
        .pdp-price{margin-bottom:16px;}
        .pdp-old{color:var(--muted);text-decoration:line-through;font-size:16px;}
        .pdp-now{font-family:Outfit;font-size:44px;font-weight:900;letter-spacing:-1.5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .pdp-off{background:var(--green-bg);color:var(--green);font-size:14px;font-weight:900;padding:4px 11px;border-radius:50px;letter-spacing:0;}
        .pdp-trust{margin-top:18px;display:grid;gap:10px;font-size:14px;font-weight:700;color:#3A3A52;border-top:1px solid var(--border);padding-top:18px;list-style:none;}
        .pdp-trust li{display:flex;align-items:center;gap:10px}
        .pdp-como{display:inline-flex;align-items:center;gap:4px;margin-top:12px;font-size:13px;font-weight:800;color:var(--orange-ink);min-height:32px}
        .pdp-soldby{margin-top:14px;font-size:13px;color:var(--sub);text-align:center;}
        .pdp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;}
        .pdp-mbar{display:none;}
        .pdp-mact{display:none;}
        .pdp-mact-row{display:flex;align-items:center;gap:10px;}
        @media(max-width:860px){
          .pdp{flex-direction:column;gap:20px;padding:14px var(--gut) 24px;}
          .pdp-aside{display:none;}
          .pdp-mact{display:block;margin-top:14px;padding:14px 16px;border:1px solid var(--border);border-radius:18px;background:#fff;}
          .pdp-mact-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
          .pdp-mact .pdp-trust{margin-top:12px;padding-top:12px;font-size:13px;gap:8px}
          .pdp-hero{font-size:72px;border-radius:20px;}
          .pdp-title{font-size:24px;letter-spacing:-.6px}
          .pdp-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
          .pdp-mbar{display:flex;position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.97);backdrop-filter:blur(10px);border-top:1px solid var(--border);box-shadow:0 -4px 20px rgba(0,0,0,.08);padding:10px var(--gut) calc(10px + env(safe-area-inset-bottom));z-index:50;align-items:center;gap:14px;animation:cb-up .4s var(--ease) both;}
          .pdp-mbar .pp{font-family:Outfit;font-size:22px;font-weight:900;flex:1;min-width:0;line-height:1.1}
          .pdp-mbar .pp small{display:block;font-family:Nunito;font-size:12px;font-weight:700;color:var(--muted);text-decoration:line-through}
          .pdp-mbar .btn{min-width:150px}
        }
      `}</style>

      <div className="pdp">
        <div className="pdp-main">
          <nav className="v3-trilha" aria-label="Você está em">
            <Link href="/">Início</Link><span aria-hidden="true">›</span>
            {cat ? <Link href={`/categoria/${cat.slug}`}>{cat.nome}</Link> : <Link href="/produtos">Produtos</Link>}
          </nav>
          {fotos.length
            ? <ProductGallery fotos={fotos} titulo={p.titulo} />
            : <div className="pdp-hero"><CategoryCover cat={p.categoria} size={96} /></div>}
          {cat ? <Link href={`/categoria/${cat.slug}`} className="pdp-chip">{cat.nome}</Link> : p.categoria && <span className="pdp-chip">{p.categoria}</span>}
          <h1 className="pdp-title">{p.titulo}</h1>
          <div className="pdp-meta">
            {notas.length > 0 ? (
              <a href="#avaliacoes" className="pdp-mi" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Stars n={media} />
                <span>{media.toFixed(1).replace('.', ',')}</span>
                <span>({notas.length} {notas.length === 1 ? 'avaliação' : 'avaliações'})</span>
              </a>
            ) : <span className="pdp-mi">Ainda sem avaliações</span>}
            {vendas > 0 && <span className="pdp-mi">{vendas.toLocaleString('pt-BR')} {vendas === 1 ? 'venda' : 'vendas'}</span>}
            <span className="pdp-mi">por {vend.slug && !vend.oficial ? <Link href={`/loja/${vend.slug}`}>{vend.nome}</Link> : <strong>{vend.nome}</strong>}</span>
          </div>

          {/* Celular: o bloco lateral fica oculto; preço, confiança, compartilhar e favoritar aparecem aqui e o botão fica na barra fixa */}
          <div className="pdp-mact">
            <div className="pdp-mact-top">
              <div className="pdp-price" style={{ marginBottom: 0 }}>
                {desconto > 0 && <span className="pdp-old"><span className="sr-only">De </span>{money(p.preco)}</span>}
                <div className="pdp-now" style={{ fontSize: 32 }}>{money(preco)}{desconto > 0 && <span className="pdp-off">-{desconto}%</span>}</div>
              </div>
              <div className="pdp-mact-row">
                <FavButton productId={p.id} />
                <ShareButton titulo={p.titulo} />
              </div>
            </div>
            {Confianca}
          </div>

          <div className="pdp-sec">
            <h2>Sobre o produto</h2>
            <div className="pdp-desc">{p.descricao || 'O vendedor ainda não escreveu uma descrição. Use as perguntas abaixo para tirar dúvidas antes de comprar.'}</div>
          </div>

          <div className="pdp-sec">
            <h2>Como você recebe</h2>
            <ul className="pdp-recebe">
              <li><Icon name="package" color="var(--orange-ink)" /><div><b>{entrega.titulo}</b><span>{entrega.texto}</span></div></li>
              <li><Icon name="bolt" color="var(--orange-ink)" /><div><b>Liberação automática</b><span>Assim que o pagamento é confirmado, o pedido é liberado. Na página do pedido você também conversa com o vendedor.</span></div></li>
              {garantia > 0 && (
                <li><Icon name="shield" color="var(--orange-ink)" /><div><b>Garantia de {garantia} {garantia === 1 ? 'dia' : 'dias'}</b><span>Dentro desse prazo você pode pedir reembolso, conforme os <Link href="/termos">Termos de uso</Link>.</span></div></li>
              )}
            </ul>
          </div>

          <Questions productId={p.id} initial={perguntas} userId={user?.id ?? null} loggedIn={!!user} />

          <div className="pdp-sec">
            <h2>Vendedor</h2>
            {vend.oficial ? (
              <div className="pdp-seller pdp-seller-oficial">
                <div className="av av-oficial" aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontFamily: 'Outfit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{vend.nome} <span className="pdp-oficial">Oficial</span></strong>
                  <div className="muted" style={{ fontSize: 13 }}>Vendido e garantido pelo Comprei Barato</div>
                </div>
              </div>
            ) : vend.slug ? (
              <Link href={`/loja/${vend.slug}`} className="pdp-seller" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="av" aria-hidden="true">{(vend.nome || 'L').charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontFamily: 'Outfit', display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>{vend.nome} {vend.verificada && <span className="ui-badge ok" style={{ fontSize: 11, padding: '2px 8px' }}><Icon name="check" size={12} strokeWidth={2.6} /> Verificada</span>}</strong>
                  <div className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>Ver loja{vend.nivel ? ` · Nível ${vend.nivel}` : ''}</div>
                </div>
                <Icon name="chevronRight" size={20} color="var(--sub)" />
              </Link>
            ) : (
              // Loja não verificada: a RLS não devolve os dados da loja ao público; sem link quebrado /loja/null
              <div className="pdp-seller pdp-seller-oficial">
                <div className="av" aria-hidden="true">L</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontFamily: 'Outfit' }}>Loja parceira</strong>
                  <div className="muted" style={{ fontSize: 13 }}>Loja ainda não verificada</div>
                </div>
              </div>
            )}
          </div>

          <div className="pdp-sec" id="avaliacoes">
            <h2>Avaliações</h2>
            {notas.length > 0 && (
              <div className="pdp-rev-hd"><b>{media.toFixed(1).replace('.', ',')}</b><Stars n={media} size={16} /><span>{notas.length} {notas.length === 1 ? 'avaliação' : 'avaliações'} de quem comprou</span></div>
            )}
            {reviews.length ? reviews.map((r, i) => (
              <div className="pdp-rev" key={i}>
                <div className="h">
                  <Stars n={r.nota} size={14} />
                  <span className="muted" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--sub)', overflowWrap: 'anywhere' }}>{r.comentario || 'Sem comentário.'}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Comprador verificado</div>
              </div>
            )) : <p className="muted" style={{ fontSize: 14 }}>Ainda não há avaliações. Quem compra pode avaliar pela página do pedido.</p>}
          </div>

          {relacionados.length > 0 && (
            <div className="pdp-sec">
              <h2>Mais deste vendedor</h2>
              <div className="pdp-grid">
                {relacionados.map((rp) => <ProductCard key={rp.id} p={rp} origem="relacionados" />)}
              </div>
            </div>
          )}

          {(daCategoria.length > 0 || parceirasRec.length > 0) && (
            <div className="pdp-sec">
              <h2>Você também pode gostar</h2>
              <div className="pdp-grid">
                {daCategoria.map((rp) => <ProductCard key={rp.id} p={rp} origem="relacionados" />)}
                {parceirasRec.map((o) => <PartnerOfferCard key={o.id} o={o} mostrarOrigem={mixRec?.mostrarOrigem} origem="relacionados" />)}
              </div>
            </div>
          )}
        </div>

        <aside className="pdp-aside" aria-label="Comprar">{BuyBox}</aside>
      </div>

      <div className="pdp-mbar">
        <div className="pp">{desconto > 0 && <small><span className="sr-only">De </span>{money(p.preco)}</small>}{money(preco)}</div>
        <BuyButton productId={p.id} categoria={cat?.slug ?? null} />
      </div>
      <Footer />
    </>
  );
}
