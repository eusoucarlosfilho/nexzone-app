import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import Icon from '@/components/Icon';
import { dadosTrilha, jsonLd, SITE } from '@/lib/seoSite';
import { seoDoJogo, TIPOS_SEO, tipoPorSlug, type JogoResumo } from '@/lib/crescimento';
import { produtosDoJogo } from '@/lib/crescimento-servidor';

// Página de um jogo (e opcionalmente de um tipo: contas, moedas…) feita para o Google.
// Mostra só anúncios reais e ativos; sem anúncio a página existe, mas fica fora do Google (noindex na metadata).
const brl = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default async function PaginaJogo({ jogo, tipoSlug, ordem }: { jogo: JogoResumo; tipoSlug: string | null; ordem: 'vendas' | 'preco' }) {
  const tipo = tipoSlug ? tipoPorSlug(tipoSlug) : null;
  const produtos = await produtosDoJogo(jogo, tipoSlug, ordem, 48);
  const qtd = tipo ? jogo.tipos[tipo.tipo] || 0 : jogo.qtd;
  const menor = produtos.length ? Math.min(...produtos.map((p) => Number(p.preco_promo ?? p.preco))) : null;
  const seo = seoDoJogo(jogo.nome, tipoSlug, { qtd, menorPreco: menor });
  const base = `/jogo/${jogo.slug}${tipo ? `/${tipo.slug}` : ''}`;
  const trilha = [{ nome: 'Início', url: '/' }, { nome: 'Jogos', url: '/jogos' }, { nome: jogo.nome, url: `/jogo/${jogo.slug}` }, ...(tipo ? [{ nome: tipo.plural, url: base }] : [])];
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: seo.h1,
    itemListElement: produtos.slice(0, 20).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/produto/${p.id}`, name: p.titulo })),
  };
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: seo.faq.map((f) => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })) };
  const tiposComAnuncio = TIPOS_SEO.filter((t) => (jogo.tipos[t.tipo] || 0) > 0);

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dadosTrilha(trilha)) }} />
      {produtos.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(itemList) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd) }} />
      <main className="pj">
        <style dangerouslySetInnerHTML={{ __html: `
          .pj-top{background:linear-gradient(135deg,#16162A,#2A1A3A);color:#fff;padding:28px 0 26px}
          .pj-trilha{display:flex;gap:6px;flex-wrap:wrap;font-size:13px;opacity:.8;margin-bottom:10px}
          .pj-trilha a{color:#fff;text-decoration:none}
          .pj-top h1{font-family:Outfit;font-weight:900;font-size:clamp(26px,3.4vw,40px);letter-spacing:-1px;line-height:1.1;margin:0 0 8px;color:#fff}
          .pj-top p{margin:0;opacity:.88;font-size:15px;max-width:760px;line-height:1.5}
          .pj-num{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;font-size:14px}
          .pj-num b{font-family:Outfit;font-size:20px;color:#FF9A3C;margin-right:4px}
          .pj-chips{display:flex;gap:8px;overflow-x:auto;padding:16px 0 4px}
          .pj-chips a{white-space:nowrap}
          .pj-ord{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:6px 0 16px}
          .pj-seo{max-width:900px;color:var(--sub);font-size:14.5px;line-height:1.7;margin:36px 0 50px}
          .pj-seo h2{font-family:Outfit;font-size:20px;font-weight:900;color:var(--text);margin:22px 0 8px}
          .pj-seo details{border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;background:#fff}
          .pj-seo summary{cursor:pointer;font-weight:800;color:var(--text)}
        ` }} />
        <section className="pj-top"><div className="c">
          <nav className="pj-trilha" aria-label="Você está em">
            {trilha.map((t, i) => <span key={t.url}>{i > 0 && <span aria-hidden="true">› </span>}{i < trilha.length - 1 ? <Link href={t.url}>{t.nome}</Link> : <span aria-current="page">{t.nome}</span>}</span>)}
          </nav>
          <h1>{seo.h1}</h1>
          <p>{seo.descricao}</p>
          {qtd > 0 && (
            <div className="pj-num">
              <span><b>{qtd.toLocaleString('pt-BR')}</b>{qtd === 1 ? 'anúncio' : 'anúncios'}</span>
              {menor !== null && <span>a partir de <b>{brl(menor)}</b></span>}
            </div>
          )}
        </div></section>

        <div className="c">
          {tiposComAnuncio.length > 1 && (
            <nav className="pj-chips" aria-label={`Tipos de anúncio de ${jogo.nome}`}>
              <Link href={`/jogo/${jogo.slug}`} className={`btn btn-sm ${!tipo ? 'btn-pri' : 'btn-ghost'}`}>Tudo · {jogo.qtd}</Link>
              {tiposComAnuncio.map((t) => (
                <Link key={t.slug} href={`/jogo/${jogo.slug}/${t.slug}`} className={`btn btn-sm ${tipo?.slug === t.slug ? 'btn-pri' : 'btn-ghost'}`}>{t.plural} · {jogo.tipos[t.tipo]}</Link>
              ))}
            </nav>
          )}

          {produtos.length ? (
            <>
              <div className="pj-ord">
                <span className="muted" style={{ fontSize: 13 }}>{ordem === 'preco' ? 'Do menor preço ao maior' : 'Mais vendidos primeiro'}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <Link href={base} className={`btn btn-sm ${ordem === 'vendas' ? 'btn-dark' : 'btn-ghost'}`}>Mais vendidos</Link>
                  <Link href={`${base}?ordem=preco`} className={`btn btn-sm ${ordem === 'preco' ? 'btn-dark' : 'btn-ghost'}`} rel="nofollow">Menor preço</Link>
                </span>
              </div>
              <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} origem="categoria" />)}</div>
              {qtd > produtos.length && (
                <p style={{ textAlign: 'center', marginTop: 18 }}>
                  <Link href={`/produtos?q=${encodeURIComponent(jogo.nome)}`} className="btn btn-ghost">Ver todos os {qtd} anúncios de {jogo.nome} <Icon name="chevronRight" size={16} /></Link>
                </p>
              )}
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', margin: '24px 0', borderStyle: 'dashed', boxShadow: 'none' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Ainda não há anúncios aqui</h2>
              <p className="muted" style={{ margin: '0 0 14px' }}>Tem {tipo ? tipo.plural.toLowerCase() : 'algo'} de {jogo.nome} para vender? Anuncie grátis e seja o primeiro.</p>
              <Link href="/seja-vendedor" className="btn btn-pri btn-sm">Anunciar grátis</Link>
            </div>
          )}

          <section className="pj-seo" aria-labelledby="pj-faq">
            <h2>Comprar {tipo ? tipo.plural.toLowerCase() + ' de ' : ''}{jogo.nome} com segurança</h2>
            <p>No Comprei Barato, cada anúncio de {jogo.nome} é de um vendedor com loja no site. O seu pagamento fica retido pela plataforma até a entrega e o fim da garantia: se algo der errado, o dinheiro volta para você. A conversa com o vendedor acontece no chat do pedido e fica registrada.</p>
            <h2 id="pj-faq">Perguntas frequentes</h2>
            {seo.faq.map((f) => <details key={f.p}><summary>{f.p}</summary><p style={{ margin: '8px 0 0' }}>{f.r}</p></details>)}
            <p style={{ marginTop: 18 }}><Link href="/jogos">Ver todos os jogos</Link> · <Link href="/seja-vendedor">Vender {jogo.nome} no Comprei Barato</Link></p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
