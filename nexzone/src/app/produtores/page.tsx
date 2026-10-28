import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { lerConfig } from '@/lib/recrutamento-servidor';
import { TAXA_FUNDADOR, MESES_FUNDADOR } from '@/lib/recrutamento';
import LandingProdutores from './LandingProdutores';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Produtor fundador — venda seus produtos digitais com ${TAXA_FUNDADOR}% de taxa | Comprei Barato`,
  description: `Ebooks, cursos, planilhas, templates e ferramentas digitais. Os 100 primeiros produtores aprovados garantem ${TAXA_FUNDADOR}% por venda por ${MESES_FUNDADOR} meses. Sem mensalidade.`,
  openGraph: {
    title: `Venda seus produtos digitais pagando só ${TAXA_FUNDADOR}% por venda`,
    description: `Vagas de produtor fundador abertas no Comprei Barato: ${TAXA_FUNDADOR}% por ${MESES_FUNDADOR} meses para os 100 primeiros aprovados.`,
    url: 'https://compreibarato.com.br/produtores',
    siteName: 'Comprei Barato',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/logo.png', width: 1774, height: 887, alt: 'Comprei Barato' }],
  },
};

export default async function ProdutoresPage() {
  let pixel = '';
  let liberacao = 7;
  try {
    const [cfg, s] = await Promise.all([lerConfig(createAdminClient()), getSettings()]);
    pixel = cfg.pixel;
    liberacao = Number(s.review_window_days) || 7;
  } catch { /* página abre mesmo sem configuração */ }
  return <LandingProdutores pixel={pixel} liberacaoDias={liberacao} />;
}
