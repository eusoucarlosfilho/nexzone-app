import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import SearchBar from '@/components/SearchBar';
import Carousel from '@/components/Carousel';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createClient();
  const { support_email } = await getSettings();
  const nowIso = new Date().toISOString();
  const [destRes, ofertaRes, altaRes, novoRes, catsRes, prodCount, lojaCount] = await Promise.all([
    supabase.from('products').select('*, stores(nome, nivel)').eq('status', 'ativo').gt('destaque_ate', nowIso).order('destaque_ate', { ascending: false }).limit(6),
    supabase.from('products').select('*, stores(nome, nivel)').eq('status', 'ativo').not('preco_promo', 'is', null).order('vendas', { ascending: false }).limit(8),
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

  return (
    <>
      <Nav />
      <style>{`
        .home-stats{display:flex;gap:26px;margin-top:28px;flex-wrap:wrap}
        .home-stats div b{font-family:'Outfit';font-size:22px;font-weight:900;display:block;line-height:1}
        .home-stats div small{font-size:12px;color:var(--sub);font-weight:700}
        .home-badges{display:flex;gap:18px;margin-top:22px;flex-wrap:wrap;font-size:13px;color:var(--sub);font-weight:700}
        .catgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px}
        .cattile{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px;text-decoration:none;color:inherit;transition:.15s;font-family:'Outfit';font-weight:700}
        .cattile:hover{border-color:var(--orange);background:var(--soft)}
        .cattile .e{font-size:26px}
        .band{background:var(--grad);border-radius:22px;padding:38px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;color:#fff}
        .band h2{font-family:'Outfit';font-size:26px;font-weight:900;letter-spacing:-.6px;margin-bottom:6px}
        .ftr{border-top:1px solid var(--border);margin-top:60px;padding:34px 28px;max-width:1280px;margin-left:auto;margin-right:auto;display:flex;justify-content:space-between;flex-wrap:wrap;gap:20px;color:var(--muted);font-size:13px}
        .ftr a{color:var(--sub);text-decoration:none;margin-right:16px;font-weight:600}
      `}</style>

      <section className="hero">
        <div className="hero-in">
          <div className="htag">⚡ Entrega imediata e pagamento seguro via Pix</div>
          <h1 className="hero">O marketplace dos <span className="g">produtos digitais</span> do Brasil.</h1>
          <p className="hero-sub">Prompts, templates, planilhas, automações e muito mais — de criadores verificados, com entrega na hora e garantia.</p>
          <SearchBar />
          <div className="home-badges">
            <span>⚡ Entrega imediata</span><span>🔒 Pagamento seguro</span><span>🛡️ Garantia de 7 dias</span>
          </div>
          {(nProd > 0 || nLoja > 0) && (
            <div className="home-stats">
              <div><b>{nProd.toLocaleString('pt-BR')}</b><small>produtos</small></div>
              <div><b>{nLoja.toLocaleString('pt-BR')}</b><small>{nLoja === 1 ? 'loja' : 'lojas'}</small></div>
            </div>
          )}
        </div>
      </section>

      {destaques.length > 0 && (
        <section className="nz"><div className="c">
          <Carousel items={destaques} />
        </div></section>
      )}

      {ofertas.length > 0 && (
        <section className="nz"><div className="c">
          <div className="st"><div className="slabel">Promoções</div><h2>Em oferta</h2></div>
          <div className="pg">{ofertas.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </div></section>
      )}

      <section className="nz">
        <div className="c">
          <div className="st"><div className="slabel">Explore</div><h2>Categorias</h2></div>
          <div className="catgrid">
            {cats.map((c: any) => (
              <Link key={c.slug} href={`/produtos?cat=${c.slug}`} className="cattile">
                <span className="e">{c.emoji}</span> {c.nome}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {vazio ? (
        <section className="nz"><div className="c">
          <p className="muted">Ainda não há produtos publicados. Cadastre o primeiro no painel do vendedor — você é o vendedor âncora.</p>
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
        <div className="band">
          <div>
            <h2>Tem um produto digital?</h2>
            <p style={{ opacity: .92 }}>Crie sua loja grátis e venda pagando só 3% por venda. Sem mensalidade.</p>
          </div>
          <Link href="/seja-vendedor" className="btn btn-lg" style={{ background: '#fff', color: 'var(--orange)' }}>Anuncie no nosso site sem você pagar nada!</Link>
        </div>
      </div></section>

      <footer className="ftr">
        <div>
          <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Nex<span style={{ color: 'var(--orange)' }}>Zone</span></div>
          <p style={{ marginTop: 6 }}>O marketplace de produtos digitais do Brasil.</p>
        </div>
        <div>
          <div style={{ marginBottom: 10 }}><Link href="/">Início</Link><Link href="/seja-vendedor">Vender no Comprei Barato</Link><Link href="/minhas-compras">Minhas Compras</Link></div>
          <div><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link><a href={`mailto:${support_email || 'contato@seudominio.com.br'}`}>Suporte</a></div>
        </div>
      </footer>
    </>
  );
}
