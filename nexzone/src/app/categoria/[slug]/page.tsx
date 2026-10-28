import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import type { Metadata } from 'next';
import { metaDaCategoria, textoDaCategoria, dadosTrilha, jsonLd, OG_PADRAO } from '@/lib/seoSite';
import { notFound } from 'next/navigation';
import { acharCategoria } from '@/lib/categorias';
import { SITE_URL_FALLBACK } from '@/lib/seo';
import Catalogo, { type ParamsCatalogo } from '@/app/produtos/Catalogo';

export const dynamic = 'force-dynamic';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '');

// Metadados para compartilhar a categoria (anúncios e redes sociais)
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = acharCategoria(params.slug);
  if (!cat) return { title: 'Categoria · Comprei Barato' };
  const m = metaDaCategoria(cat);
  const url = `${SITE}/categoria/${cat.slug}`;
  return { title: m.titulo, description: m.descricao, alternates: { canonical: url }, openGraph: { title: m.titulo, description: m.descricao, url, siteName: 'Comprei Barato', locale: 'pt_BR', type: 'website', images: [{ url: OG_PADRAO, width: 1200, height: 630 }] } };
}

// Categoria = o mesmo catálogo de /produtos, com a categoria fixa (busca, preço e ordenação continuam disponíveis).
// A lista de categorias vem da fonte única (src/lib/categorias.ts), a mesma usada nos produtos.
export default async function CategoriaPage({ params, searchParams }: { params: { slug: string }; searchParams: ParamsCatalogo }) {
  const cat = acharCategoria(params.slug);
  if (!cat || cat.slug !== params.slug) notFound();
  const texto = textoDaCategoria(cat);

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dadosTrilha([{ nome: 'Início', url: '/' }, { nome: cat.nome, url: `/categoria/${cat.slug}` }])) }} />
      <main>
        <Catalogo searchParams={searchParams} catFixa={cat} />
        <section className="cat-seo" aria-labelledby="cat-seo-t">
          <style dangerouslySetInnerHTML={{ __html: '.cat-seo{max-width:1240px;margin:8px auto 40px;padding:0 24px;color:var(--sub);font-size:14.5px;line-height:1.7}.cat-seo h2{font-family:Outfit;font-size:20px;font-weight:900;color:var(--text);margin:0 0 8px}.cat-seo p{margin:0 0 8px;max-width:860px}' }} />
          <h2 id="cat-seo-t">{texto.titulo}</h2>
          {texto.paragrafos.map((t, i) => <p key={i}>{t}</p>)}
        </section>
      </main>
      <Footer />
    </>
  );
}
