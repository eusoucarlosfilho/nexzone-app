// Resolve o jogo da URL (com ou sem anúncio) e monta a metadata da página. Só servidor.
import type { Metadata } from 'next';
import { JOGOS } from './taxas';
import { slugJogo, seoDoJogo, tipoPorSlug, type JogoResumo } from './crescimento';
import { acharJogo } from './crescimento-servidor';
import { SITE, OG_PADRAO } from './seoSite';

export async function jogoDaRota(slug: string): Promise<JogoResumo | null> {
  const j = await acharJogo(slug);
  if (j) return j;
  // jogo da lista oficial ainda sem anúncio: a página existe (convite para vender), fora do Google
  const oficial = (JOGOS as readonly string[]).find((n) => slugJogo(n) === slugJogo(slug));
  return oficial ? { slug: slugJogo(oficial), nome: oficial, qtd: 0, variantes: [oficial], tipos: {}, menorPreco: null } : null;
}

export function metaDoJogo(j: JogoResumo | null, tipoSlug: string | null): Metadata {
  if (!j) return { title: 'Jogo · Comprei Barato', robots: { index: false } };
  const tipo = tipoSlug ? tipoPorSlug(tipoSlug) : null;
  const qtd = tipo ? j.tipos[tipo.tipo] || 0 : j.qtd;
  const s = seoDoJogo(j.nome, tipoSlug, { qtd, menorPreco: tipo ? null : j.menorPreco });
  const url = `${SITE}/jogo/${j.slug}${tipo ? `/${tipo.slug}` : ''}`;
  return {
    title: { absolute: s.titulo }, description: s.descricao, alternates: { canonical: url },
    robots: qtd > 0 ? undefined : { index: false, follow: true },
    openGraph: { title: s.titulo, description: s.descricao, url, siteName: 'Comprei Barato', locale: 'pt_BR', type: 'website', images: [{ url: OG_PADRAO, width: 1200, height: 630 }] },
  };
}
