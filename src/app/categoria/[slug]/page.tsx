import Nav from '@/components/Nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import GradeMista from '@/components/GradeMista';
import { configMix, ofertasAtivas, visiveis } from '@/lib/ofertas/servidor';
import { intercalar, type ItemMix } from '@/lib/ofertas/mix';
import type { OfertaVitrine } from '@/lib/ofertas/tipos';
import { acharCategoria } from '@/lib/categorias';
import { SITE_URL_FALLBACK } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';
import { produtosPublicos } from '@/lib/vendedorPublico';
import { PRODUTO_CARD } from '@/lib/consultas';
import CategoryIcon from '@/components/CategoryIcon';

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

export default async function CategoriaPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: cat } = await supabase.from('categories').select('nome, emoji').eq('slug', params.slug).maybeSingle();
  if (!cat) notFound();

  const { data } = await supabase.from('products')
    .select(PRODUTO_CARD).eq('status', 'ativo').eq('categoria', cat.nome)
    .order('vendas', { ascending: false });
  const produtos = produtosPublicos(data as Product[] | null);

  // Ofertas de parceiros completam a categoria (nativos primeiro, com teto de participação)
  const [mix, parceiros] = await Promise.all([configMix(), ofertasAtivas({ categoria: cat.nome, limite: 24 })]);
  const grade: ItemMix<Product, OfertaVitrine>[] = mix.ativo
    ? intercalar(produtos, visiveis(parceiros, mix), mix)
    : produtos.map((item) => ({ tipo: 'nativo' as const, item }));
  const temParceiros = grade.some((g) => g.tipo === 'parceiro');

  return (
    <>
      <Nav />
      <section className="nz"><div className="c">
        <div className="st">
          <div className="slabel">Categoria</div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><CategoryIcon cat={params.slug} size={28} /> {cat.nome}</h2>
        </div>
        {grade.length
          ? <GradeMista itens={grade} mostrarOrigem={mix.mostrarOrigem} />
          : <p className="muted">Ainda não há produtos nesta categoria. <Link href="/produtos" style={{ color: 'var(--orange-ink)', fontWeight: 800 }}>Ver todos os produtos</Link></p>}
        {temParceiros && mix.mostrarOrigem && <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Itens com o selo &quot;Oferta de parceiro&quot; são vendidos em sites parceiros, fora do Comprei Barato.</p>}
      </div></section>
    </>
  );
}
