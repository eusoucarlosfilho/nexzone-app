import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { listarJogos } from '@/lib/crescimento-servidor';
import { dadosTrilha, jsonLd, SITE } from '@/lib/seoSite';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'Jogos: contas, itens, moedas e gift cards baratos | Comprei Barato' },
  description: 'Escolha o jogo e veja contas, skins, moedas, gift cards e serviços à venda, com dinheiro protegido até a entrega.',
  alternates: { canonical: `${SITE}/jogos` },
};
const brl = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

// Índice de todos os jogos com anúncio ativo (do mais anunciado ao menos)
export default async function JogosPage() {
  const jogos = await listarJogos();
  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dadosTrilha([{ nome: 'Início', url: '/' }, { nome: 'Jogos', url: '/jogos' }])) }} />
      <main className="c" style={{ padding: '28px var(--gut) 50px' }}>
        <h1 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(26px,3.2vw,38px)', letterSpacing: '-1px', margin: '0 0 6px' }}>Jogos</h1>
        <p className="muted" style={{ margin: '0 0 20px' }}>Escolha o jogo para ver contas, itens, moedas e gift cards à venda.</p>
        {jogos.length === 0 ? <p className="muted">Os primeiros anúncios estão chegando.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
            {jogos.map((j) => (
              <Link key={j.slug} href={`/jogo/${j.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '16px 18px' }}>
                <b style={{ fontFamily: 'Outfit', fontSize: 17, display: 'block' }}>{j.nome}</b>
                <small className="muted">{j.qtd} {j.qtd === 1 ? 'anúncio' : 'anúncios'}{j.menorPreco ? ` · a partir de ${brl(j.menorPreco)}` : ''}</small>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
