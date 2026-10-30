import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import OfertaDoDiaCard from '@/components/OfertaDoDiaCard';
import { ofertaDoDia, cfgCanais } from '@/lib/crescimento-servidor';
import { SITE } from '@/lib/seoSite';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'Oferta do dia · Comprei Barato' },
  description: 'Uma oferta nova todo dia em contas, itens, moedas e gift cards, só até meia-noite.',
  alternates: { canonical: `${SITE}/oferta-do-dia` },
};

// Link fixo para a bio e para os canais: sempre mostra a oferta de hoje
export default async function OfertaDoDiaPage() {
  const [o, c] = await Promise.all([ofertaDoDia().catch(() => null), cfgCanais().catch(() => null)]);
  return (
    <>
      <Nav />
      <main className="c" style={{ padding: '28px var(--gut) 50px' }}>
        {o ? <OfertaDoDiaCard p={o.produto} fim={o.fim} canais={{ whatsapp: c?.whatsapp || '', telegram: c?.telegram || '' }} h="h1" />
          : <div className="card" style={{ textAlign: 'center' }}><h1 style={{ fontFamily: 'Outfit', fontSize: 24, margin: '0 0 6px' }}>A oferta de hoje está chegando</h1><p className="muted">Enquanto isso, veja os <Link href="/produtos?sort=vendas">mais vendidos</Link>.</p></div>}
      </main>
      <Footer />
    </>
  );
}
