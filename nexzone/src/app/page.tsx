import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import Carousel from '@/components/Carousel';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const Check = ({ c = '#B84A00' }: { c?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

export default async function Home() {
  const supabase = createClient();
  const { support_email, commission_percent } = await getSettings();
  const nowIso = new Date().toISOString();
  const [destRes, ofertaRes, altaRes, novoRes, catsRes, prodCount, lojaCount] = await Promise.all([
    supabase.from('products').select('*, stores(nome, nivel)').eq('status', 'ativo').gt('destaque_ate', nowIso).order('destaque_ate', { ascending: false }).limit(6),
    supabase.from('products').select('*, stores(nome, nivel)').eq('status', 'ativo').order('vendas', { ascending: false }).order('nota', { ascending: false }).limit(8),
    supabase.from('products').select('*, stores(nome, nivel)').eq('status', 'ativo').order('vendas', { ascending: false }).limit(8),
    supabase.from('products').select('*, stores(nome, nivel)').eq('status', 'ativo').order('created_at', { ascending: false }).limit(8),
    supabase.from('categories').select('nome, slug, emoji'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('stores').select('id', { count: 'exact', head: true }),
  ]);
  const destaques = (destRes.data ?? []) as Product[];
  const ofertas = (ofertaRes.data ?? []) as Product[];
  const emAlta = (altaRes.data ?? []) as Product[];
  const novidades = (novoRes.data ?? []) as Product[];
  const cats = catsRes.data ?? [];
  const nProd = prodCount.count ?? 0;
  const nLoja = lojaCount.count ?? 0;
  const vazio = emAlta.length === 0;
  const vitrine = (destaques.length ? destaques : ofertas).slice(0, 2);
  const taxa = commission_percent ?? 3;

  return (
    <>
      <Nav />
      <style>{`
        .h-grid{display:flex;flex-wrap:wrap;gap:40px;align-items:center}
        .h-text{flex:1 1 520px;min-width:0}
        .h-art{flex:1 1 400px;min-width:0;height:420px;position:relative}
        .h-card{position:absolute;width:240px;background:#fff;border-radius:22px;box-shadow:0 24px 50px rgba(22,22,42,.12);overflow:hidden;color:var(--text)}
        .h-card .im{height:150px;background:var(--soft) center/cover;display:flex;align-items:center;justify-content:center;font-size:56px}
        .h-card .tx{padding:14px 16px}
        .h-card .tx b{display:block;font-size:14px;font-weight:800;line-height:1.3;max-height:36px;overflow:hidden}
        .h-card .tx span{font-family:'Outfit';font-weight:900;font-size:20px}
        .h-pix{position:absolute;left:20%;bottom:10px;background:var(--text);color:#fff;border-radius:18px;padding:14px 18px;display:flex;gap:12px;align-items:center;box-shadow:0 20px 40px rgba(22,22,42,.3)}
        .h-pix .ok{width:38px;height:38px;border-radius:50%;background:#00A36C;display:flex;align-items:center;justify-content:center}
        .h-badges{display:flex;gap:22px;margin-top:28px;flex-wrap:wrap;font-size:14px;font-weight:800;color:#3A3A52}
        .h-badges span{display:flex;gap:8px;align-items:center}
        .home-stats{display:flex;gap:30px;margin-top:26px;flex-wrap:wrap}
        .home-stats b{font-family:'Outfit';font-size:26px;font-weight:900;display:block;line-height:1}
        .home-stats small{font-size:13px;color:var(--sub);font-weight:800}
        .catgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
        .steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:26px}
        @media(max-width:720px){.h-art{display:none}}
      `}</style>

      <main>
        <section className="hero">
          <div className="hero-in h-grid">
            <div className="h-text">
              <div className="htag anim"><span className="live-dot" />Entrega imediata e pagamento seguro via Pix</div>
              <h1 className="hero anim d1">O lugar mais <span className="g">barato</span> de comprar produtos digitais.</h1>
              <p className="hero-sub anim d2">Prompts, planilhas, templates e automações de criadores verificados. Pague com Pix e receba na hora, com garantia.</p>
              <div className="hero-ctas anim d3">
                <Link href="/produtos" className="btn btn-pri btn-lg">Explorar produtos →</Link>
                <Link href="/seja-vendedor" className="btn btn-ghost btn-lg">Começar a vender</Link>
              </div>
              <div className="h-badges anim d4">
                <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B84A00" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>Entrega na hora</span>
                <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B84A00" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>Pix protegido</span>
                <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B84A00" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>Garantia em todas as compras</span>
              </div>
              {(nProd > 0 || nLoja > 0) && (
                <div className="home-stats anim d4">
                  <div><b>{nProd.toLocaleString('pt-BR')}</b><small>produtos</small></div>
                  <div><b>{nLoja.toLocaleString('pt-BR')}</b><small>{nLoja === 1 ? 'loja' : 'lojas'}</small></div>
                </div>
              )}
            </div>
            <div className="h-art" aria-hidden="true">
              {vitrine[0] && (
                <div className="h-card float1" style={{ ['--r' as any]: '-4deg', left: '4%', top: 30 }}>
                  <div className="im" style={vitrine[0].capa_url ? { backgroundImage: `url(${vitrine[0].capa_url})` } : undefined}>{!vitrine[0].capa_url && vitrine[0].emoji}</div>
                  <div className="tx"><b>{vitrine[0].titulo}</b><span>{money(vitrine[0].preco_promo ?? vitrine[0].preco)}</span></div>
                </div>
              )}
              {vitrine[1] && (
                <div className="h-card float2" style={{ ['--r' as any]: '5deg', right: '2%', top: 110, width: 220 }}>
                  <div className="im" style={vitrine[1].capa_url ? { backgroundImage: `url(${vitrine[1].capa_url})`, height: 130 } : { height: 130 }}>{!vitrine[1].capa_url && vitrine[1].emoji}</div>
                  <div className="tx"><b>{vitrine[1].titulo}</b><span>{money(vitrine[1].preco_promo ?? vitrine[1].preco)}</span></div>
                </div>
              )}
              <div className="h-pix float3">
                <span className="ok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                <span><b style={{ display: 'block', fontSize: 14 }}>Pix aprovado</b><span style={{ display: 'block', fontSize: 12, color: '#C9C9DA' }}>Produto liberado para download</span></span>
              </div>
            </div>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((k) => (
              <span key={k} style={{ display: 'flex', gap: 48 }}>
                <span>Entrega imediata</span><i>●</i><span>Pagamento via Pix</span><i>●</i><span>Criadores verificados</span><i>●</i><span>Garantia em todas as compras</span><i>●</i><span>Ganhe CB Points a cada compra</span><i>●</i>
              </span>
            ))}
          </div>
        </div>

        {destaques.length > 0 && (
          <section className="nz"><div className="c">
            <Carousel items={destaques} />
          </div></section>
        )}

        {ofertas.length > 0 && (
          <section className="nz"><div className="c">
            <div className="st"><div className="slabel">Os melhores</div><h2>Destaques do site</h2></div>
            <div className="pg">{ofertas.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </div></section>
        )}

        {cats.length > 0 && (
          <section className="nz">
            <div className="c">
              <div className="st"><div className="slabel">Explore</div><h2>Categorias</h2></div>
              <div className="catgrid">
                {cats.map((c: any) => (
                  <Link key={c.slug} href={`/produtos?cat=${c.slug}`} className="cattile">
                    <span className="e" aria-hidden="true">{c.emoji}</span> {c.nome}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {vazio ? (
          <section className="nz"><div className="c">
            <div className="card" style={{ textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800 }}>A vitrine está esperando o primeiro produto</h2>
              <p className="muted" style={{ margin: '6px 0 16px' }}>Cadastre o primeiro no painel do vendedor — você é o vendedor âncora.</p>
              <Link href="/vender" className="btn btn-dark">Ir para o painel</Link>
            </div>
          </div></section>
        ) : (
          <>
            <section className="nz"><div className="c">
              <div className="st"><div className="slabel">Em alta</div><h2>Mais vendidos</h2></div>
              <div className="pg">{emAlta.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            </div></section>

            <section className="nz"><div className="c">
              <div className="st"><div className="slabel">Novidades</div><h2>Recém-chegados</h2></div>
              <div className="pg">{novidades.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            </div></section>
          </>
        )}

        <section className="nz"><div className="c">
          <div className="st" style={{ textAlign: 'center' }}><div className="slabel">Como funciona</div><h2>Comprar é simples assim</h2></div>
          <div className="steps">
            <div className="step"><b>1</b><h3>Escolha o produto</h3><p>Compare avaliações, veja o que vem incluso e tire dúvidas com o vendedor.</p></div>
            <div className="step"><b>2</b><h3>Pague com Pix</h3><p>Escaneie o QR Code ou copie o código. A aprovação leva segundos.</p></div>
            <div className="step"><b>3</b><h3>Receba na hora</h3><p>O download aparece em Minhas compras, com garantia.</p></div>
          </div>
        </div></section>

        <section className="nz"><div className="c">
          <div className="band">
            <div style={{ maxWidth: 620 }}>
              <h2>Tem um produto digital? Venda aqui.</h2>
              <p>Loja grátis, sem mensalidade. Você só paga {taxa}% quando vender e acompanha tudo pelo painel.</p>
            </div>
            <Link href="/seja-vendedor" className="btn btn-pri btn-lg">Criar minha loja grátis</Link>
          </div>
        </div></section>
      </main>

      <Footer supportEmail={support_email} />
    </>
  );
}
