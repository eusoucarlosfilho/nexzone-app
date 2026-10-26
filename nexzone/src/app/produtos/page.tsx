import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import Catalogo, { type ParamsCatalogo } from './Catalogo';
import { acharCategoria } from '@/lib/categorias';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: ParamsCatalogo }): Promise<Metadata> {
  const q = String(searchParams.q ?? '').trim().slice(0, 60);
  const cat = searchParams.cat ? acharCategoria(searchParams.cat) : null;
  if (q) return { title: `${q} · Busca · Comprei Barato`, robots: { index: false, follow: true } };
  if (cat) return { title: `${cat.nome} · Produtos digitais · Comprei Barato` };
  return { title: 'Explorar produtos digitais · Comprei Barato', description: 'Prompts, planilhas, templates, cursos, e-books, design, automações e mais produtos digitais.' };
}

export default async function ProdutosPage({ searchParams }: { searchParams: ParamsCatalogo }) {
  return (
    <>
      <Nav />
      <main>
        <Catalogo searchParams={searchParams} />
      </main>
      <Footer />
    </>
  );
}
