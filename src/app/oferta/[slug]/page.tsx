import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import Icon from '@/components/Icon';
import ShareButton from '@/components/ShareButton';
import ProductCard from '@/components/ProductCard';
import PartnerOfferCard from '@/components/PartnerOfferCard';
import { CategoryCover } from '@/components/CategoryIcon';
import { createClient } from '@/lib/supabase/server';
import { acharCategoria } from '@/lib/categorias';
import { produtosPublicos } from '@/lib/vendedorPublico';
import { PRODUTO_CARD } from '@/lib/consultas';
import type { Product } from '@/lib/types';
import { SITE_URL_FALLBACK } from '@/lib/seo';
import { ROTULO_PLATAFORMA, descontoPct, formatarPreco } from '@/lib/ofertas/tipos';
import { configMix, ofertaPorSlug, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import { plataformaVisivel } from '@/lib/ofertas/mix';

export const dynamic = 'force-dynamic';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '');

// Página de PRODUTO EXTERNO no layout da página de produto da loja.
// O botão "Comprar" leva ao site de origem (rota de saída controlada). Não há checkout, pedido, saldo nem CB Points.
// Com "mostrar origem" desligado (padrão), não aparece plataforma, produtor nem selo; fica só o aviso neutro
// de que a compra é finalizada no site do vendedor.

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const [o, cfg] = await Promise.all([ofertaPorSlug(params.slug), configMix()]);
  if (!o || !plataformaVisivel(o.external_platform, cfg)) return { title: 'Produto indisponível · Comprei Barato', robots: { index: false } };
  const desc = (o.short_description || o.description || '').slice(0, 160);
  return {
    title: `${o.title} · Comprei Barato`,
    description: desc || o.title,
    alternates: { canonical: `${SITE}/oferta/${o.slug}` },
    openGraph: { title: o.title, description: desc, url: `${SITE}/oferta/${o.slug}`, images: o.image_url ? [{ url: o.image_url }] : undefined },
  };
}

export default async function OfertaPage({ params }: { params: { slug: string } }) {
  const [o, cfg] = await Promise.all([ofertaPorSlug(params.slug), configMix()]);
  if (!o || !plataformaVisivel(o.external_platform, cfg)) notFound();

  const origem = cfg.mostrarOrigem;
  const plataforma = ROTULO_PLATAFORMA[o.external_platform] || 'site parceiro';
  const preco = formatarPreco(o.price_reference, o.currency);
  const de = formatarPreco(o.price_from, o.currency);
  const off = descontoPct(o.price_reference, o.price_from);
  const cat = acharCategoria(o.category);
  const saida = `/api/partner-offers/${o.id}/redirect?de=pagina`;

  // Recomendações: nativos da mesma categoria primeiro; outros externos só completam
  const supabase = createClient();
  const { data: natData } = await supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').eq('categoria', o.category).limit(4);
  const nativos = produtosPublicos(natData as Product[] | null).slice(0, 4);
  const outras = nativos.length < 4
    ? visiveis(await ofertasAtivas({ categoria: o.category, excluirSlug: o.slug, limite: 8 }), cfg).slice(0, 4 - nativos.length)
    : [];

  const Preco = ({ grande = true }: { grande?: boolean }) => (
    <div className="pdp-price" style={grande ? undefined : { marginBottom: 0 }}>
      {de && off > 0 && <span className="pdp-old">{de}</span>}
      <div className="pdp-now" style={grande ? undefined : { fontSize: 32 }}>
        {preco || 'Ver preço'}{off > 0 && <span className="pdp-off">-{off}%</span>}
      </div>
    </div>
  );

  const Botao = (
    <a className="btn btn-pri pdp-comprar" href={saida} target="_blank" rel="nofollow sponsored noopener noreferrer">Comprar</a>
  );

  const Aviso = (
    <p className="pdp-externo">
      Você será direcionado ao site do vendedor para finalizar a compra.
      <br />Preço e disponibilidade podem mudar no site do vendedor.
    </p>
  );

  return (
    <>
      <Nav />
      <style>{`
        .pdp{display:flex;gap:36px;max-width:1240px;margin:0 auto;padding:28px 24px 60px;animation:cb-up .5s var(--ease) both;}
        .pdp-main{flex:1;min-width:0;}
        .pdp-aside{width:380px;flex-shrink:0;}
        .pdp-box{position:sticky;top:150px;background:#fff;border:1px solid var(--border);border-radius:28px;padding:28px;box-shadow:0 20px 50px rgba(22,22,42,.08);animation:cb-up .6s var(--ease) .08s both;}
        .pdp-hero{position:relative;aspect-ratio:16/10;border-radius:28px;overflow:hidden;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:110px;margin-bottom:22px;}
        .pdp-hero img{width:100%;height:100%;object-fit:cover;}
        .pdp-chip{display:inline-block;background:var(--soft);color:var(--orange-ink);font-weight:900;font-size:13px;padding:6px 13px;border-radius:50px;}
        .pdp-title{font-family:'Outfit';font-size:clamp(26px,3vw,36px);font-weight:900;letter-spacing:-1px;margin:12px 0 8px;line-height:1.12;}
        .pdp-meta{color:var(--sub);font-size:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
        .pdp-sec{margin-top:34px;}
        .pdp-sec h2{font-family:'Outfit';font-size:21px;font-weight:800;margin-bottom:14px;letter-spacing:-.4px;}
        .pdp-desc{color:var(--sub);font-size:15px;line-height:1.7;white-space:pre-wrap;}
        .pdp-price{margin-bottom:16px;}
        .pdp-old{color:var(--muted);text-decoration:line-through;font-size:16px;}
        .pdp-now{font-family:'Outfit';font-size:44px;font-weight:900;letter-spacing:-1.5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .pdp-off{background:var(--green-bg);color:var(--green);font-size:14px;font-weight:900;padding:4px 11px;border-radius:50px;letter-spacing:0;}
        .pdp-comprar{display:flex;justify-content:center;align-items:center;width:100%;min-height:54px;font-size:17px;}
        .pdp-externo{margin-top:10px;font-size:12px;color:var(--muted);text-align:center;line-height:1.5;}
        .pdp-share{margin-top:16px;border-top:1px solid var(--border);padding-top:16px;}
        .pdp-soldby{margin-top:14px;font-size:13px;color:var(--sub);text-align:center;}
        .pdp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;}
        .pdp-mbar{display:none;}
        .pdp-mact{display:none;}
        @media(max-width:860px){
          .pdp{flex-direction:column;gap:20px;padding-bottom:110px;}
          .pdp-aside{display:none;}
          .pdp-mact{display:block;margin-top:14px;padding:14px 16px;border:1px solid var(--border);border-radius:18px;background:#fff;}
          .pdp-hero{font-size:72px;}
          .pdp-title{font-size:24px;}
          .pdp-mbar{display:flex;flex-direction:column;position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--border);box-shadow:0 -4px 20px rgba(0,0,0,.08);padding:10px 16px 8px;z-index:50;}
          .pdp-mbar-row{display:flex;align-items:center;gap:14px;}
          .pdp-mbar .pp{font-family:'Outfit';font-size:22px;font-weight:900;flex:1;}
          .pdp-mbar .pdp-comprar{width:auto;min-height:48px;padding:0 26px;}
          .pdp-mbar .pdp-externo{margin-top:4px;font-size:11px;}
        }
      `}</style>

      <div className="pdp">
        <div className="pdp-main">
          <div className="pdp-hero">
            {o.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={o.image_url} alt={o.title} referrerPolicy="no-referrer" />
              : <CategoryCover cat={cat?.slug || o.category} size={96} />}
          </div>
          {cat ? <Link href={`/categoria/${cat.slug}`} className="pdp-chip">{cat.nome}</Link> : <span className="pdp-chip">{o.category}</span>}
          <h1 className="pdp-title">{o.title}</h1>
          {origem && (
            <div className="pdp-meta">
              <span className="of-selo"><Icon name="link" size={14} /> Oferta de parceiro</span>
              <span>Vendido em <strong>{plataforma}</strong>{o.producer_name ? ` · ${o.producer_name}` : ''}</span>
            </div>
          )}

          {/* Celular: o bloco lateral fica oculto */}
          <div className="pdp-mact">
            <Preco grande={false} />
          </div>

          {(o.description || o.short_description) && (
            <div className="pdp-sec">
              <h2>Sobre o produto</h2>
              <div className="pdp-desc">{o.description || o.short_description}</div>
            </div>
          )}

          {(nativos.length > 0 || outras.length > 0) && (
            <div className="pdp-sec">
              <h2>Você também pode gostar</h2>
              <div className="pdp-grid">
                {nativos.map((p) => <ProductCard key={p.id} p={p} />)}
                {outras.map((x) => <PartnerOfferCard key={x.id} o={x} mostrarOrigem={origem} />)}
              </div>
            </div>
          )}
        </div>

        <aside className="pdp-aside">
          <div className="pdp-box">
            <Preco />
            {Botao}
            {Aviso}
            <div className="pdp-share"><ShareButton titulo={o.title} full /></div>
            {origem && <div className="pdp-soldby">Vendido e entregue por <strong>{plataforma}</strong></div>}
          </div>
        </aside>
      </div>

      <div className="pdp-mbar">
        <div className="pdp-mbar-row">
          <div className="pp">{preco || 'Ver preço'}</div>
          {Botao}
        </div>
        {Aviso}
      </div>
    </>
  );
}
