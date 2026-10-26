import Nav from '@/components/Nav';
import BuyButton from './BuyButton';
import ProductCard from '@/components/ProductCard';
import PartnerOfferCard from '@/components/PartnerOfferCard';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import ShareButton from '@/components/ShareButton';
import FavButton from '@/components/FavButton';
import Questions from './Questions';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { avisoEstoque, extrasDe, EXTRAS_VAZIO } from '@/lib/estoque';
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

const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');
const ENTREGA: Record<string, string> = {
  arquivo: 'Arquivo para download', chave: 'Chave / código de acesso', link: 'Link de acesso', acesso: 'Acesso liberado',
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
  let { data } = await supabase.from('products')
    .select(PRODUTO_PAGINA).eq('id', params.id).eq('status', 'ativo').maybeSingle();
  // Esgotado: o produto foi pausado AUTOMATICAMENTE porque o estoque zerou (SQL 07).
  // A página continua no ar mostrando "Esgotado", sem botão de compra (o checkout só aceita produto ativo).
  let esgotadoPausado = false;
  if (!data && /^[0-9a-f-]{36}$/i.test(params.id)) {
    try {
      const adm = createAdminClient();
      const { data: pausado, error } = await adm.from('products')
        .select(PRODUTO_PAGINA).eq('id', params.id).eq('status', 'pausado').eq('pausado_sem_estoque', true).maybeSingle();
      if (!error && pausado) {
        const st: any = (pausado as any).stores;
        // loja não verificada: o público não veria os dados dela, então não expõe slug/nível
        if (st && st.status !== 'verificado' && st.ocultar_vendedor !== true) (pausado as any).stores = { nome: 'Loja parceira', slug: null, nivel: '', status: st.status, ocultar_vendedor: false };
        data = pausado;
        esgotadoPausado = true;
      }
    } catch { /* sem SQL 07 ou sem chave: segue como antes (404) */ }
  }
  if (!data) notFound();
  // Dados públicos do vendedor (Comprei Barato quando a loja está oculta). O nome real não sai do servidor.
  const p = produtoPublico(data as unknown as Product);
  const vend = vendedorPublico(p.stores);
  const fotos = galeriaDe(p as any); // galeria; produto antigo sem galeria = [capa_url]
  const preco = p.preco_promo ?? p.preco;
  const desconto = p.preco_promo ? Math.round((1 - p.preco_promo / p.preco) * 100) : 0;

  const { data: reviewsData } = await supabase.from('reviews')
    .select('nota, comentario, created_at').eq('product_id', p.id).order('created_at', { ascending: false }).limit(10);
  const reviews = reviewsData ?? [];

  // agregado real de avaliações (contagem, média e JSON-LD), sem o limite de 10 da lista exibida
  const { data: notasData } = await supabase.from('reviews').select('nota').eq('product_id', p.id).limit(5000);
  const notas = ((notasData ?? []) as { nota: number }[]).map((r) => Number(r.nota)).filter((v) => v >= 1 && v <= 5);
  const qtdAvaliacoes = notas.length;
  const media = qtdAvaliacoes ? notas.reduce((s, v) => s + v, 0) / qtdAvaliacoes : 0;
  const vendas = Number(p.vendas) || 0;

  // Estoque e exibição dos contadores (SQL 07). Sem o SQL 07: nada muda.
  const extras = (await extrasDe(supabase, [p.id]))[p.id] ?? EXTRAS_VAZIO;
  const aviso = esgotadoPausado ? avisoEstoque(0) : avisoEstoque(extras.estoque);
  const esgotado = aviso?.nivel === 'esgotado';
  const mostrarContadores = !extras.ocultar_contadores;

  // "Mais deste vendedor": não aparece quando a loja está oculta
  const relacionados: Product[] = vend.oficial ? [] : produtosPublicos((await supabase.from('products')
    .select(PRODUTO_CARD).eq('store_id', p.store_id).eq('status', 'ativo').neq('id', p.id).limit(4)).data as Product[] | null);

  const { data: catData } = await supabase.from('products')
    .select(PRODUTO_CARD).eq('categoria', p.categoria).eq('status', 'ativo').neq('id', p.id)
    .order('vendas', { ascending: false }).limit(8);
  const relIds = new Set(relacionados.map((r) => r.id));
  const daCategoria = produtosPublicos(catData as Product[] | null).filter((c) => !relIds.has(c.id)).slice(0, 4);
  // Recomendações: ofertas de parceiros só completam as vagas que os nativos não preencheram
  const mixRec = daCategoria.length < 4 ? await configMix() : null;
  const parceirasRec = mixRec?.ativo ? visiveis(await ofertasAtivas({ categoria: p.categoria, limite: 8 }), mixRec).slice(0, 4 - daCategoria.length) : [];

  const { data: { user } } = await supabase.auth.getUser();
  const { data: perguntasData } = await supabase.from('product_questions')
    .select('id, autor, autor_nome, pergunta, resposta, respondida_em, created_at')
    .eq('product_id', p.id).order('created_at', { ascending: false }).limit(50);
  const perguntas = (perguntasData ?? []) as any[];

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
      availability: esgotado ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: vend.nome },
    },
  };
  if (notas.length > 0 && mostrarContadores) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: (notas.reduce((s, v) => s + v, 0) / notas.length).toFixed(1),
      reviewCount: notas.length,
      bestRating: 5,
      worstRating: 1,
    };
  }
  const jsonLdHtml = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  const BuyBox = (
    <div className="pdp-box">
      <div className="pdp-price">
        {desconto > 0 && <span className="pdp-old">{money(p.preco)}</span>}
        <div className="pdp-now">{money(preco)}{desconto > 0 && <span className="pdp-off">-{desconto}%</span>}</div>
      </div>
      {aviso && <div className={`pdp-stock ${aviso.nivel}`} role="status">{aviso.texto}</div>}
      <BuyButton productId={p.id} esgotado={esgotado} />
      <div className="pdp-trust">
        <div className="flex"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B84A00" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>Liberado assim que o Pix for aprovado</div>
        <div className="flex"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B84A00" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>Pagamento seguro via Pix</div>
        <div className="flex"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B84A00" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>Garantia de {p.garantia_dias} dias</div>
      </div>
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
        .pdp{display:flex;gap:36px;max-width:1240px;margin:0 auto;padding:28px 24px 60px;animation:cb-up .5s var(--ease) both;}
        .pdp-main{flex:1;min-width:0;}
        .pdp-aside{width:380px;flex-shrink:0;}
        .pdp-box{position:sticky;top:150px;background:#fff;border:1px solid var(--border);border-radius:28px;padding:28px;box-shadow:0 20px 50px rgba(22,22,42,.08);animation:cb-up .6s var(--ease) .08s both;}
        .pdp-hero{position:relative;aspect-ratio:16/10;border-radius:28px;overflow:hidden;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:110px;margin-bottom:22px;}
        .pdp-hero img{width:100%;height:100%;object-fit:cover;transition:transform .6s var(--ease);}.pdp-hero:hover img{transform:scale(1.03);}
        .pdp-chip{display:inline-block;background:var(--soft);color:var(--orange-ink);font-weight:900;font-size:13px;padding:6px 13px;border-radius:50px;}
        .pdp-title{font-family:'Outfit';font-size:clamp(26px,3vw,36px);font-weight:900;letter-spacing:-1px;margin:12px 0 8px;line-height:1.12;}
        .pdp-meta{color:var(--sub);font-size:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
        .pdp-star{display:inline-flex;gap:2px;align-items:center;}
        .pdp-sec{margin-top:34px;}
        .pdp-sec h2{font-family:'Outfit';font-size:21px;font-weight:800;margin-bottom:14px;letter-spacing:-.4px;}
        .pdp-desc{color:var(--sub);font-size:15px;line-height:1.7;white-space:pre-wrap;}
        .pdp-recebe{display:grid;gap:10px;}
        .pdp-recebe div{display:flex;gap:10px;align-items:center;font-size:15px;font-weight:700;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px 16px;transition:transform .2s var(--ease);}.pdp-recebe div:hover{transform:translateX(4px);}
        .pdp-seller{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--border);border-radius:20px;padding:18px;transition:all .22s var(--ease);}.pdp-seller:hover{border-color:var(--orange);transform:translateY(-2px);}
        .pdp-seller .av{width:52px;height:52px;border-radius:16px;background:var(--text);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Outfit';font-weight:900;font-size:22px;}
        .pdp-seller-oficial:hover{border-color:var(--border);transform:none;}
        .pdp-seller .av-oficial{background:#fff url(/logo.png) center/contain no-repeat;border:1px solid var(--border);}
        .pdp-oficial{display:inline-block;font-family:'Outfit';font-weight:800;font-size:11px;color:#fff;background:#FF6B00;border-radius:50px;padding:2px 8px;vertical-align:1px;}
        .pdp-rev{border:1px solid var(--border);border-radius:18px;padding:18px;margin-bottom:10px;}
        .pdp-rev .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
        .pdp-price{margin-bottom:16px;}
        .pdp-old{color:var(--muted);text-decoration:line-through;font-size:16px;}
        .pdp-now{font-family:'Outfit';font-size:44px;font-weight:900;letter-spacing:-1.5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .pdp-off{background:var(--green-bg);color:var(--green);font-size:14px;font-weight:900;padding:4px 11px;border-radius:50px;letter-spacing:0;}
        .pdp-trust{margin-top:18px;display:grid;gap:10px;font-size:14px;font-weight:700;color:#3A3A52;border-top:1px solid var(--border);padding-top:18px;}
        .pdp-soldby{margin-top:14px;font-size:13px;color:var(--sub);text-align:center;}
        .pdp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;}
        .pdp-stock{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;padding:6px 12px;border-radius:50px;margin-bottom:12px;}
        .pdp-stock::before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor;}
        .pdp-stock.ok{background:var(--green-bg);color:var(--green);}
        .pdp-stock.pouco{background:#FFF1E6;color:#C2410C;}
        .pdp-stock.esgotado{background:var(--red-bg);color:var(--red);}
        .pdp-novo{display:inline-block;background:var(--green-bg);color:var(--green);font-weight:800;font-size:12.5px;padding:3px 10px;border-radius:50px;}
        .pdp-mbar{display:none;}
        .pdp-mact{display:none;}
        .pdp-mact-row{display:flex;align-items:center;gap:10px;}
        @media(max-width:860px){
          .pdp{flex-direction:column;gap:20px;padding-bottom:90px;}
          .pdp-aside{display:none;}
          .pdp-mact{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:14px 16px;border:1px solid var(--border);border-radius:18px;background:#fff;}
          .pdp-hero{font-size:72px;}
          .pdp-title{font-size:24px;}
          .pdp-mbar{display:flex;position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--border);box-shadow:0 -4px 20px rgba(0,0,0,.08);padding:12px 16px;z-index:50;align-items:center;gap:14px;animation:cb-up .4s var(--ease) both;}
          .pdp-mbar .pp{font-family:'Outfit';font-size:22px;font-weight:900;flex:1;}
        }
      `}</style>

      <div className="pdp">
        <div className="pdp-main">
          {fotos.length
            ? <ProductGallery fotos={fotos} titulo={p.titulo} />
            : <div className="pdp-hero"><CategoryCover cat={p.categoria} size={96} /></div>}
          <span className="pdp-chip">{p.categoria}</span>
          <h1 className="pdp-title">{p.titulo}</h1>
          {/* Números REAIS. O que for zero não aparece; o admin pode ocultar a linha inteira. */}
          {mostrarContadores && (qtdAvaliacoes > 0 || vendas > 0) ? (
            <div className="pdp-meta">
              {qtdAvaliacoes > 0 && <>
                <Stars n={media} />
                <span>{media.toFixed(1).replace('.', ',')}</span>
                <span>· {qtdAvaliacoes.toLocaleString('pt-BR')} {qtdAvaliacoes === 1 ? 'avaliação' : 'avaliações'}</span>
              </>}
              {vendas > 0 && <span>{qtdAvaliacoes > 0 ? '· ' : ''}{vendas.toLocaleString('pt-BR')} {vendas === 1 ? 'venda' : 'vendas'}</span>}
            </div>
          ) : mostrarContadores ? <div className="pdp-meta"><span className="pdp-novo">Novo</span></div> : null}

          {/* Celular: o bloco lateral fica oculto, então preço, compartilhar e favoritar aparecem aqui */}
          <div className="pdp-mact">
            <div className="pdp-price" style={{ marginBottom: 0 }}>
              {desconto > 0 && <span className="pdp-old">{money(p.preco)}</span>}
              <div className="pdp-now" style={{ fontSize: 32 }}>{money(preco)}{desconto > 0 && <span className="pdp-off">-{desconto}%</span>}</div>
              {aviso && <div className={`pdp-stock ${aviso.nivel}`} role="status" style={{ marginTop: 8 }}>{aviso.texto}</div>}
            </div>
            <div className="pdp-mact-row">
              <FavButton productId={p.id} />
              <ShareButton titulo={p.titulo} />
            </div>
          </div>

          <div className="pdp-sec">
            <h2>Sobre o produto</h2>
            <div className="pdp-desc">{p.descricao || 'Sem descrição.'}</div>
          </div>

          <div className="pdp-sec">
            <h2>O que você recebe</h2>
            <div className="pdp-recebe">
              <div><Icon name="bolt" color="var(--orange-ink)" /> Entrega imediata e automática após o pagamento</div>
              <div><Icon name="package" color="var(--orange-ink)" /> {ENTREGA[p.tipo_entrega] || 'Acesso ao produto'}</div>
              <div><Icon name="shield" color="var(--orange-ink)" /> Garantia de {p.garantia_dias} dias</div>
            </div>
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
              <a href={`/loja/${vend.slug}`} className="pdp-seller" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="av">{(vend.nome || 'L').charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontFamily: 'Outfit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{vend.nome} {vend.verificada && <span className="ui-badge ok" style={{ fontSize: 11, padding: '2px 8px' }}><Icon name="check" size={12} strokeWidth={2.6} /> Verificada</span>}</strong>
                  <div className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>Ver loja{vend.nivel ? ` · Nível ${vend.nivel}` : ''}</div>
                </div>
                <Icon name="chevronRight" size={20} color="var(--sub)" />
              </a>
            ) : (
              // Loja não verificada: a RLS não devolve os dados da loja ao público; sem link quebrado /loja/null
              <div className="pdp-seller pdp-seller-oficial">
                <div className="av">L</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontFamily: 'Outfit' }}>Loja parceira</strong>
                  <div className="muted" style={{ fontSize: 13 }}>Loja ainda não verificada</div>
                </div>
              </div>
            )}
          </div>

          <div className="pdp-sec">
            <h2>Avaliações</h2>
            {reviews.length ? reviews.map((r, i) => (
              <div className="pdp-rev" key={i}>
                <div className="h">
                  <Stars n={r.nota} size={14} />
                  <span className="muted" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--sub)' }}>{r.comentario || 'Sem comentário.'}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Comprador verificado</div>
              </div>
            )) : <p className="muted" style={{ fontSize: 14 }}>Ainda não há avaliações. Seja o primeiro a avaliar após a compra.</p>}
          </div>

          {relacionados.length > 0 && (
            <div className="pdp-sec">
              <h2>Mais deste vendedor</h2>
              <div className="pdp-grid">
                {relacionados.map((rp) => <ProductCard key={rp.id} p={rp} />)}
              </div>
            </div>
          )}

          {(daCategoria.length > 0 || parceirasRec.length > 0) && (
            <div className="pdp-sec">
              <h2>Você também pode gostar</h2>
              <div className="pdp-grid">
                {daCategoria.map((rp) => <ProductCard key={rp.id} p={rp} />)}
                {parceirasRec.map((o) => <PartnerOfferCard key={o.id} o={o} mostrarOrigem={mixRec?.mostrarOrigem} />)}
              </div>
            </div>
          )}
        </div>

        <aside className="pdp-aside">{BuyBox}</aside>
      </div>

      <div className="pdp-mbar">
        <div className="pp">{money(preco)}</div>
        <BuyButton productId={p.id} esgotado={esgotado} />
      </div>
    </>
  );
}
