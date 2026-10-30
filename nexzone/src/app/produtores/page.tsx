import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { lerTaxas } from '@/lib/settings';
import { TAXAS_PADRAO, type ConfigTaxas } from '@/lib/taxas';
import { lerConfig } from '@/lib/recrutamento-servidor';
import { TAXA_BASE } from '@/lib/recrutamento';
import LandingProdutores from './LandingProdutores';
import { lerCfgCampanhas, vagasFundador } from '@/lib/campanhas-servidor';
import type { DadosFundador } from '@/components/FaixaFundador';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Venda contas, itens e gift cards de jogos com taxa a partir de ${TAXA_BASE}% | Comprei Barato`,
  description: `Anuncie grátis no Comprei Barato: contas, skins, moedas, gift cards, keys e serviços de jogos. Dinheiro do cliente protegido até a entrega, Pix e cartão, taxa a partir de ${TAXA_BASE}%.`,
  alternates: { canonical: 'https://www.compreibarato.com.br/produtores' },
  openGraph: {
    title: `Venda contas, itens e gift cards com taxa a partir de ${TAXA_BASE}%`,
    description: 'Cadastro de lojistas aberto no Comprei Barato, o novo marketplace gamer brasileiro. Anúncio grátis e dinheiro protegido até a entrega.',
    url: 'https://www.compreibarato.com.br/produtores',
    siteName: 'Comprei Barato',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/og-padrao.png', width: 1200, height: 630, alt: 'Comprei Barato' }],
  },
};


export default async function ProdutoresPage() {
  let pixel = '';
  let taxas: ConfigTaxas = TAXAS_PADRAO;
  try {
    const [cfg, t] = await Promise.all([lerConfig(createAdminClient()), lerTaxas()]);
    pixel = cfg.pixel;
    taxas = t;
  } catch { /* página abre mesmo sem configuração */ }
  // Lojista Fundador (SQL 28): vagas reais
  let fundador: DadosFundador | null = null;
  try {
    const camp = await lerCfgCampanhas();
    if (camp.fundadorAtivo) {
      const v = await vagasFundador(createAdminClient(), camp);
      if (v.sql28) fundador = { restantes: v.restantes, total: v.total, dias: camp.fundadorDias, teto: camp.fundadorTeto, destaqueDias: camp.fundadorDestaqueDias };
    }
  } catch { /* sem SQL 28 */ }
  return <LandingProdutores pixel={pixel} taxas={taxas} fundador={fundador} />;
}
