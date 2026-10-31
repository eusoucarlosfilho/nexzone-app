import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import Contagem from '@/components/Contagem';
import ListaEspera from './ListaEspera';
import PixelInstitucional from '@/components/PixelInstitucional';
import { painelBF, ofertasAntecipadas, listarJogos } from '@/lib/crescimento-servidor';
import { textoCompartilharBF } from '@/lib/crescimento';
import { SITE } from '@/lib/seoSite';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'Black Friday Gamer 2026 · contas, skins, moedas e gift cards | Comprei Barato' },
  description: 'A Black Friday Gamer do Comprei Barato: descontos de verdade em contas, itens, moedas e gift cards, com dinheiro protegido até a entrega. Entre na lista e seja avisado.',
  alternates: { canonical: `${SITE}/black-friday` },
  // imagem de compartilhamento: ./opengraph-image.tsx (gerada com as datas da campanha)
  openGraph: { title: 'Black Friday Gamer · Comprei Barato', description: 'Descontos de verdade em contas, itens, moedas e gift cards.', url: `${SITE}/black-friday`, siteName: 'Comprei Barato', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Black Friday Gamer · Comprei Barato', description: 'Descontos de verdade em contas, itens, moedas e gift cards.' },
};
const dataBR = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

export default async function BlackFridayPage() {
  const { cfg, fase, inscritos, produtos } = await painelBF();
  const [antecipadas, jogos] = await Promise.all([
    fase === 'antes' ? ofertasAntecipadas(12) : Promise.resolve([]),
    listarJogos().then((l) => l.slice(0, 16)).catch(() => []),
  ]);
  const compartilhar = `https://wa.me/?text=${encodeURIComponent(textoCompartilharBF(cfg, SITE))}`;
  const faq: { p: string; r: string }[] = [
    { p: 'O desconto é de verdade?', r: `Sim. Só entra na Black Friday Gamer produto com pelo menos ${cfg.descontoMin}% de desconto em cima do preço que ele tinha quando o vendedor se inscreveu. O preço de referência fica travado: ninguém consegue subir antes para fingir promoção.` },
    { p: 'Quando as ofertas entram no ar?', r: `No dia ${dataBR(cfg.inicio)} à meia-noite (horário de Brasília). O site coloca o preço da campanha sozinho e tira no fim, em ${dataBR(cfg.fim)} às 23h59.` },
    { p: 'Como funciona a lista de espera?', r: 'Você deixa o e-mail (e o WhatsApp, se quiser) e recebe um aviso assim que a Black Friday começar. Só avisos da campanha, sem spam.' },
    { p: 'Meu dinheiro fica seguro?', r: 'Fica. O pagamento fica retido pela plataforma e só é liberado ao vendedor depois da entrega e do prazo de garantia. Se não for entregue, você pede o reembolso pelo pedido.' },
    { p: 'Sou vendedor. Como participo?', r: 'Entre em Minha loja › Black Friday, escolha os produtos e o preço da campanha. Sem custo extra para participar.' },
  ];
  return (
    <>
      <PixelInstitucional />
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
          .bf-acoes{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
          .bf-zap{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;border:1.5px solid #3A3A3A;border-radius:14px;padding:10px 16px;font-family:Outfit;font-weight:800;font-size:14.5px}
          .bf-zap:hover{border-color:#25D366;color:#7CF0A8}
          .bf-sec{padding:30px 0 0}
          .bf-sec h2{font-family:Outfit;font-weight:900;font-size:clamp(22px,2.6vw,30px);letter-spacing:-.8px;margin-bottom:6px}
          .bf-linha{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}
          .bf-linha>div{border:1px solid var(--border);border-radius:18px;padding:16px;background:#fff}
          .bf-linha b{font-family:Outfit;font-size:13px;letter-spacing:1px;color:var(--orange-ink);text-transform:uppercase}
          .bf-linha h3{font-family:Outfit;font-size:18px;font-weight:900;margin:4px 0}
          .bf-linha p{font-size:14px;color:var(--sub)}
          .bf-faq details{border:1px solid var(--border);border-radius:14px;padding:12px 16px;background:#fff;margin-top:8px}
          .bf-faq summary{font-family:Outfit;font-weight:800;cursor:pointer;font-size:15.5px}
          .bf-faq p{color:var(--sub);font-size:14.5px;margin-top:6px}
          @media(max-width:760px){.bf-form{grid-template-columns:1fr}.bf-linha{grid-template-columns:1fr}}
        ` }} />
        <section className="bf-hero"><div className="c">
          <span className="bf-tag">BLACK FRIDAY GAMER · {dataBR(cfg.inicio)} A {dataBR(cfg.fim)}</span>
          {fase === 'antes' && <>
            <h1>Os menores preços do ano em contas, skins, moedas e gift cards.</h1>
            <p>Só entra oferta com pelo menos {cfg.descontoMin}% de desconto em cima do preço de hoje. Nada de aumentar antes para fingir promoção. Entre na lista e seja avisado no minuto em que abrir.</p>
            <div className="bf-cont"><small>Começa em</small><Contagem alvo={Date.parse(cfg.inicio)} rotuloFim="Começou!" className="t" /></div>
            <ListaEspera />
            {inscritos >= 5 && <div className="bf-num"><span><b>{inscritos}</b>ofertas já confirmadas pelos vendedores</span></div>}
            <div className="bf-acoes"><a className="bf-zap" href={compartilhar} target="_blank" rel="noopener noreferrer">Chamar o squad no WhatsApp</a></div>
          </>}
          {fase === 'durante' && <>
            <h1>A Black Friday Gamer começou.</h1>
            <p>Descontos de pelo menos {cfg.descontoMin}% em cima do preço de antes. Pague com Pix e tenha o dinheiro protegido até a entrega.</p>
            <div className="bf-cont"><small>Termina em</small><Contagem alvo={Date.parse(cfg.fim)} rotuloFim="Encerrada" className="t" /></div>
            <div className="bf-acoes"><a className="bf-zap" href={compartilhar} target="_blank" rel="noopener noreferrer">Chamar o squad no WhatsApp</a></div>
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

          {fase === 'antes' && antecipadas.length > 0 && (
            <section className="bf-sec" aria-labelledby="bf-ant">
              <div className="slabel">Esquenta Black</div>
              <h2 id="bf-ant">Não quer esperar? Estes já estão com desconto</h2>
              <p className="muted" style={{ marginBottom: 16 }}>Anúncios com preço promocional hoje, do maior desconto para o menor.</p>
              <div className="pg">{antecipadas.map((p) => <ProductCard key={p.id} p={p} origem="outro" />)}</div>
            </section>
          )}

          {fase !== 'depois' && (
            <section className="bf-sec" aria-labelledby="bf-como">
              <div className="slabel">Como vai ser</div>
              <h2 id="bf-como">Black November no Comprei Barato</h2>
              <div className="bf-linha">
                <div><b>Agora</b><h3>Esquenta</h3><p>Entre na lista de espera e aproveite os anúncios que já estão com desconto.</p></div>
                <div><b>{dataBR(cfg.inicio)} · 00h</b><h3>Black Friday Gamer</h3><p>Os preços da campanha entram no ar sozinhos, com no mínimo {cfg.descontoMin}% de desconto real.</p></div>
                <div><b>{dataBR(cfg.fim)} · 23h59</b><h3>Última chamada</h3><p>Fim da campanha. Os preços voltam ao normal automaticamente.</p></div>
              </div>
            </section>
          )}

          {jogos.length > 0 && (
            <section className="bf-sec" aria-labelledby="bf-jg">
              <div className="slabel">Por jogo</div>
              <h2 id="bf-jg">Ache o seu jogo</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {jogos.map((j) => <Link key={j.slug} href={`/jogo/${j.slug}`} className="chip">{j.nome} <small className="muted">· {j.qtd}</small></Link>)}
              </div>
            </section>
          )}

          <section className="bf-sec bf-faq" aria-labelledby="bf-faq">
            <h2 id="bf-faq">Perguntas frequentes</h2>
            {faq.map((f) => <details key={f.p}><summary>{f.p}</summary><p>{f.r}</p></details>)}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })) }).replace(/</g, '\\u003c') }} />
          </section>

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
