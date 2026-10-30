import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import PaginaJogo from '@/components/PaginaJogo';
import { jogoDaRota, metaDoJogo } from '@/lib/jogo-rota';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return metaDoJogo(await jogoDaRota(params.slug), null);
}

// /jogo/free-fire — tudo do jogo (contas, itens, moedas, gift cards…)
export default async function JogoPage({ params, searchParams }: { params: { slug: string }; searchParams: { ordem?: string } }) {
  const jogo = await jogoDaRota(params.slug);
  if (!jogo) notFound();
  if (jogo.slug !== params.slug) redirect(`/jogo/${jogo.slug}`);
  return <PaginaJogo jogo={jogo} tipoSlug={null} ordem={searchParams.ordem === 'preco' ? 'preco' : 'vendas'} />;
}
