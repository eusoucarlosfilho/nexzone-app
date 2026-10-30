import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import PaginaJogo from '@/components/PaginaJogo';
import { jogoDaRota, metaDoJogo } from '@/lib/jogo-rota';
import { tipoPorSlug } from '@/lib/crescimento';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string; tipo: string } }): Promise<Metadata> {
  return metaDoJogo(await jogoDaRota(params.slug), tipoPorSlug(params.tipo) ? params.tipo : null);
}

// /jogo/free-fire/contas — um tipo de anúncio do jogo
export default async function JogoTipoPage({ params, searchParams }: { params: { slug: string; tipo: string }; searchParams: { ordem?: string } }) {
  const jogo = await jogoDaRota(params.slug);
  if (!jogo || !tipoPorSlug(params.tipo)) notFound();
  if (jogo.slug !== params.slug) redirect(`/jogo/${jogo.slug}/${params.tipo}`);
  return <PaginaJogo jogo={jogo} tipoSlug={params.tipo} ordem={searchParams.ordem === 'preco' ? 'preco' : 'vendas'} />;
}
