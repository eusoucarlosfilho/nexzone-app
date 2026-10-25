import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import Icon from '@/components/Icon';
import ProductCard from '@/components/ProductCard';
import PartnerOfferCard, { cssUrl } from '@/components/PartnerOfferCard';
import { CategoryCover } from '@/components/CategoryIcon';
import { createClient } from '@/lib/supabase/server';
import { acharCategoria } from '@/lib/categorias';
import { produtosPublicos } from '@/lib/vendedorPublico';
import { PRODUTO_CARD } from '@/lib/consultas';
import type { Product } from '@/lib/types';
import { SITE_URL_FALLBACK } from '@/lib/seo';
import { ROTULO_PLATAFORMA, formatarPreco } from '@/lib/ofertas/tipos';
import { configMix, ofertaPorSlug, ofertasAtivas } from '@/lib/ofertas/servidor';

export const dynamic = 'force-dynamic';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '');

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const o = await ofertaPorSlug(params.slug);
  if (!o) return { title: 'Oferta indisponível · Comprei Barato', robots: { index: false } };
  const desc = (o.short_description || o.description || '').slice(0, 160);
  return {
    title: `${o.title} · Oferta de parceiro · Comprei Barato`,
    description: desc || `Oferta de parceiro vendida em ${ROTULO_PLATAFORMA[o.external_platform]}.`,
    alternates: { canonical: `${SITE}/oferta/${o.slug}` },
    openGraph: { title: o.title, description: desc, url: `${SITE}/oferta/${o.slug}`, images: o.image_url ? [{ url: o.image_url }] : undefined },
  };
}

export default async function OfertaPage({ params }: { params: { slug: string } }) {
  const o = await ofertaPorSlug(params.slug);
  if (!o) notFound();
  const mix = await configMix();
  if (!mix.ativo) notFound();

  const plataforma = ROTULO_PLATAFORMA[o.external_platform] || 'site parceiro';
  const preco = formatarPreco(o.price_reference, o.currency);
  const cat = acharCategoria(o.category);
  const verificada = o.last_verified_at ? new Date(o.last_verified_at).toLocaleDateString('pt-BR') : null;

  // Recomendações: nativos da mesma categoria primeiro; outras ofertas só completam
  const supabase = createClient();
  const { data: natData } = await supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').eq('categoria', o.category).limit(4);
  const nativos = produtosPublicos(natData as Product[] | null).slice(0, 4);
  const outras = nativos.length < 4 ? await ofertasAtivas({ categoria: o.category, excluirSlug: o.slug, limite: 4 - nativos.length }) : [];

  return (
    <>
      <Nav />
      <div className="page of-page">
        <nav className="of-trilha" aria-label="Você está em">
          <Link href="/produtos">Produtos</Link> ›{' '}
          {cat ? <Link href={`/categoria/${cat.slug}`}>{cat.nome}</Link> : <span>{o.category}</span>}
        </nav>

        <div className="of-grid">
          <div className="of-midia">
            {o.image_url
              ? <span className="of-img" style={{ backgroundImage: cssUrl(o.image_url) }} role="img" aria-label={o.title} />
              : <span className="of-img"><CategoryCover cat={cat?.slug || o.category} size={72} /></span>}
          </div>

          <div className="of-info">
            <span className="of-selo"><Icon name="link" size={14} /> Oferta de parceiro</span>
            <h1>{o.title}</h1>
            <p className="of-meta">
              {o.producer_name ? <>Produtor: <strong>{o.producer_name}</strong> · </> : null}
              Vendido e entregue por <strong>{plataforma}</strong>
            </p>

            <div className="of-box">
              {preco
                ? <div className="of-preco">{preco}<small>preço de referência</small></div>
                : <div className="of-preco of-preco-sem">Preço no site parceiro</div>}
              <a className="btn btn-pri of-btn" href={`/api/partner-offers/${o.id}/redirect?de=pagina`} target="_blank" rel="nofollow sponsored noopener noreferrer">
                Comprar no site parceiro <Icon name="share" size={16} />
              </a>
              <div className="of-aviso" role="note">
                <Icon name="info" size={16} />
                <p>A compra acontece em <strong>{plataforma}</strong>, fora do Comprei Barato. O pagamento, a entrega, o suporte e a garantia são de responsabilidade do parceiro. Preço e condições podem mudar no checkout dele.</p>
              </div>
              {verificada && <small className="of-verif">Oferta conferida pela nossa equipe em {verificada}.</small>}
            </div>
          </div>
        </div>

        {o.description && (
          <section className="of-sec">
            <h2>Sobre o produto</h2>
            <p className="of-desc">{o.description}</p>
          </section>
        )}

        {(nativos.length > 0 || outras.length > 0) && (
          <section className="of-sec">
            <h2>Você também pode gostar</h2>
            <div className="pg">
              {nativos.map((p) => <ProductCard key={p.id} p={p} />)}
              {outras.map((x) => <PartnerOfferCard key={x.id} o={x} />)}
            </div>
          </section>
        )}

        <p className="of-remocao">
          É o titular deste produto e quer a oferta fora do ar? <Link href="/suporte">Fale com o suporte</Link> e removemos rapidamente.
        </p>
      </div>
    </>
  );
}
