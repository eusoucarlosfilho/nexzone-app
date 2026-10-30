import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import Contagem from '@/components/Contagem';
import ListaEspera from './ListaEspera';
import { painelBF } from '@/lib/crescimento-servidor';
import { SITE, OG_PADRAO } from '@/lib/seoSite';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'Black Friday Gamer 2026 · contas, skins, moedas e gift cards | Comprei Barato' },
  description: 'A Black Friday Gamer do Comprei Barato: descontos de verdade em contas, itens, moedas e gift cards, com dinheiro protegido até a entrega. Entre na lista e seja avisado.',
  alternates: { canonical: `${SITE}/black-friday` },
  openGraph: { title: 'Black Friday Gamer · Comprei Barato', description: 'Descontos de verdade em contas, itens, moedas e gift cards.', url: `${SITE}/black-friday`, siteName: 'Comprei Barato', locale: 'pt_BR', type: 'website', images: [{ url: OG_PADRAO, width: 1200, height: 630 }] },
};
const dataBR = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

export default async function BlackFridayPage() {
  const { cfg, fase, inscritos, produtos } = await painelBF();
  return (
    <>
      <Nav />
      <main className="bf">
        <style dangerouslySetInnerHTML={{ __html: `
          .bf-hero{background:#0E0E1A radial-gradient(70% 60% at 80% 0%,rgba(255,107,0,.45),transparent);color:#fff;padding:44px 0 40px}
          .bf-tag{display:inline-block;background:#FF6B00;color:#0E0E1A;font-family:Outfit;font-weight:900;font-size:12.5px;letter-spacing:1px;border-radius:50px;padding:5px 12px;margin-bottom:12px}
          .bf-hero h1{font-family:Outfit;font-weight:900;font-size:clamp(32px,5vw,58px);letter-spacing:-1.5px;line-height:1.02;margin:0 0 10px;color:#fff}
          .bf-hero p{opacity:.9;font-size:16px;max-width:620px;line-height:1.5;margin:0}
          .bf-cont{display:flex;align-items:baseline;gap:10px;margin:22px 0 18px;flex-wrap:wrap}
          .bf-cont small{opacity:.75;font-size:14px}
          .bf-cont .t{font-family:Outfit;font-weight:900;font-size:clamp(30px,4vw,44px);color:#FF9A3C}
          .bf-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:10px;max-width:880px;position:relative}
          .bf-form input:not([type=checkbox]){height:50px;border-radius:14px;border:0;padding:0 14px;font-size:16px;min-width:0}
          .bf-form .btn{height:50px;white-space:nowrap}
          .bf-chk{grid-column:1/-1;display:flex;gap:8px;align-items:center;font-size:13.5px;opacity:.9}
          .bf-mini{grid-column:1/-1;opacity:.6;font-size:12px}
          .bf-ok{display:flex;flex-direction:column;gap:4px;background:rgba(61,220,151,.14);border:1px solid rgba(61,220,151,.5);border-radius:14px;padding:14px 16px;max-width:620px}
          .bf-num{display:flex;gap:22px;margin-top:22px;flex-wrap:wrap;font-size:14px;opacity:.9}
          .bf-num b{font-family:Outfit;font-size:22px;color:#FF9A3C;margin-right:4px}
          .bf-band{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;border:1px solid var(--border);border-radius:18px;padding:18px 20px;margin:26px 0;background:#fff}
          @media(max-width:760px){.bf-form{grid-template-columns:1fr}}
        ` }} />
        <section className="bf-hero"><div className="c">
          <span className="bf-tag">BLACK FRIDAY GAMER · {dataBR(cfg.inicio)} A {dataBR(cfg.fim)}</span>
          {fase === 'antes' && <>
            <h1>Os menores preços do ano em contas, skins, moedas e gift cards.</h1>
            <p>Só entra oferta com pelo menos {cfg.descontoMin}% de desconto em cima do preço de hoje. Nada de aumentar antes para fingir promoção. Entre na lista e seja avisado no minuto em que abrir.</p>
            <div className="bf-cont"><small>Começa em</small><Contagem alvo={Date.parse(cfg.inicio)} rotuloFim="Começou!" className="t" /></div>
            <ListaEspera />
            {inscritos >= 5 && <div className="bf-num"><span><b>{inscritos}</b>ofertas já confirmadas pelos vendedores</span></div>}
          </>}
          {fase === 'durante' && <>
            <h1>A Black Friday Gamer começou.</h1>
            <p>Descontos de pelo menos {cfg.descontoMin}% em cima do preço de antes. Pague com Pix e tenha o dinheiro protegido até a entrega.</p>
            <div className="bf-cont"><small>Termina em</small><Contagem alvo={Date.parse(cfg.fim)} rotuloFim="Encerrada" className="t" /></div>
          </>}
          {fase === 'depois' && <>
            <h1>A Black Friday Gamer acabou.</h1>
            <p>Obrigado a todo mundo que comprou e vendeu. Ainda tem oferta boa todo dia no site.</p>
            <p style={{ marginTop: 14 }}><Link href="/oferta-do-dia" className="btn btn-pri">Ver a oferta do dia</Link></p>
          </>}
        </div></section>

        <div className="c">
          {fase === 'durante' && (produtos.length ? (
            <section style={{ padding: '26px 0 10px' }} aria-label="Ofertas da Black Friday">
              <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} origem="outro" />)}</div>
            </section>
          ) : <p className="muted" style={{ padding: '26px 0' }}>As ofertas estão entrando no ar. Atualize a página em alguns minutos.</p>)}

          <div className="bf-band">
            <div style={{ maxWidth: 640 }}>
              <b style={{ fontFamily: 'Outfit', fontSize: 18 }}>Vende no Comprei Barato?</b>
              <p className="muted" style={{ margin: '4px 0 0' }}>Inscreva seus produtos com o preço da Black Friday. O site coloca o desconto no ar sozinho quando começar e volta o preço normal quando terminar.</p>
            </div>
            <Link href="/vender/black-friday" className="btn btn-dark">Inscrever meus produtos</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
