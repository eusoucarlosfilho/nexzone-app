import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import type { Metadata } from 'next';
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
  const titulo = `${cat.nome} · Produtos digitais · Comprei Barato`;
  const desc = `Produtos digitais de ${cat.nome}: compre com entrega digital e veja ofertas selecionadas.`;
  return { title: titulo, description: desc, alternates: { canonical: `${SITE}/categoria/${cat.slug}` }, openGraph: { title: titulo, description: desc, url: `${SITE}/categoria/${cat.slug}` } };
}

// Categoria = o mesmo catálogo de /produtos, com a categoria fixa (busca, preço e ordenação continuam disponíveis).
// A lista de categorias vem da fonte única (src/lib/categorias.ts), a mesma usada nos produtos.
export default async function CategoriaPage({ params, searchParams }: { params: { slug: string }; searchParams: ParamsCatalogo }) {
  const cat = acharCategoria(params.slug);
  if (!cat || cat.slug !== params.slug) notFound();

  return (
    <>
      <Nav />
      <main>
        <Catalogo searchParams={searchParams} catFixa={cat} />
      </main>
      <Footer />
    </>
  );
}
