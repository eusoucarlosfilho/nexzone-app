import Nav from '@/components/Nav';
import BuyButton from './BuyButton';
import ProductCard from '@/components/ProductCard';
import ShareButton from '@/components/ShareButton';
import FavButton from '@/components/FavButton';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';

const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');
const ENTREGA: Record<string, string> = {
  arquivo: 'Arquivo para download', chave: 'Chave / código de acesso', link: 'Link de acesso', acesso: 'Acesso liberado',
};
const stars = (n: number) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase.from('products').select('titulo, descricao, capa_url, preco, preco_promo').eq('id', params.id).maybeSingle();
  if (!p) return { title: 'Produto — Comprei Barato' };
  const preco = (p.preco_promo ?? p.preco) as number;
  const desc = p.descricao ? String(p.descricao).slice(0, 150) : `Produto digital por R$ ${Number(preco).toFixed(2).replace('.', ',')} no Comprei Barato.`;
  const images = p.capa_url ? [{ url: p.capa_url as string }] : [];
  return {
    title: `${p.titulo} — Comprei Barato`,
    description: desc,
    openGraph: { title: String(p.titulo), description: desc, images, type: 'website' },
    twitter: { card: 'summary_large_image', title: String(p.titulo), description: desc, images: p.capa_url ? [p.capa_url as string] : [] },
  };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('products')
    .select('*, stores(nome, nivel, slug)').eq('id', params.id).eq('status', 'ativo').single();
  if (!data) notFound();
  const p = data as Product;
  const preco = p.preco_promo ?? p.preco;
  const desconto = p.preco_promo ? Math.round((1 - p.preco_promo / p.preco) * 100) : 0;

  const { data: reviewsData } = await supabase.from('reviews')
    .select('nota, comentario, created_at').eq('product_id', p.id).order('created_at', { ascending: false }).limit(10);
  const reviews = reviewsData ?? [];
  const media = reviews.length ? reviews.reduce((s, r) => s + r.nota, 0) / reviews.length : (p.nota || 0);

  const { data: relData } = await supabase.from('products')
    .select('*, stores(nome, nivel)').eq('store_id', p.store_id).eq('status', 'ativo').neq('id', p.id).limit(4);
  const relacionados = (relData ?? []) as Product[];

  const { data: catData } = await supabase.from('products')
    .select('*, stores(nome, nivel)').eq('categoria', p.categoria).eq('status', 'ativo').neq('id', p.id)
    .order('vendas', { ascending: false }).limit(8);
  const relIds = new Set(relacionados.map((r) => r.id));
  const daCategoria = ((catData ?? []) as Product[]).filter((c) => !relIds.has(c.id)).slice(0, 4);

  const BuyBox = (
    <div className="pdp-box">
      <div className="pdp-price">
        {desconto > 0 && <span className="pdp-old">{money(p.preco)}</span>}
        <div className="pdp-now">{money(preco)}{desconto > 0 && <span className="pdp-off">-{desconto}%</span>}</div>
      </div>
      <BuyButton productId={p.id} />
      <div className="pdp-trust">
        <div>⚡ Entrega imediata após o pagamento</div>
        <div>🔒 Pagamento seguro via Pix</div>
        <div>🛡️ Garantia de {p.garantia_dias} dias</div>
      </div>
      <ShareButton titulo={p.titulo} full />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--sub)', fontSize: 13 }}><FavButton productId={p.id} /> Salvar nos favoritos</div>
      <div className="pdp-soldby">Vendido por <strong>{p.stores?.nome}</strong> ✓</div>
    </div>
  );

  return (
    <>
      <Nav />
      <style>{`
        .pdp{display:flex;gap:34px;max-width:1100px;margin:0 auto;padding:28px 20px 60px;}
        .pdp-main{flex:1;min-width:0;}
        .pdp-aside{width:340px;flex-shrink:0;}
        .pdp-box{position:sticky;top:90px;background:#fff;border:1px solid var(--border);border-radius:18px;padding:22px;box-shadow:0 8px 30px rgba(0,0,0,.06);}
        .pdp-hero{aspect-ratio:16/10;border-radius:18px;overflow:hidden;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:96px;margin-bottom:20px;}
        .pdp-hero img{width:100%;height:100%;object-fit:cover;}
        .pdp-chip{display:inline-block;background:var(--soft);color:var(--orange);font-weight:800;font-size:12px;padding:5px 12px;border-radius:50px;font-family:'Outfit';}
        .pdp-title{font-family:'Outfit';font-size:30px;font-weight:900;letter-spacing:-.8px;margin:12px 0 8px;line-height:1.15;}
        .pdp-meta{color:var(--sub);font-size:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
        .pdp-star{color:#FFB200;font-size:15px;letter-spacing:1px;}
        .pdp-sec{margin-top:30px;}
        .pdp-sec h2{font-family:'Outfit';font-size:19px;font-weight:800;margin-bottom:12px;}
        .pdp-desc{color:var(--sub);font-size:15px;line-height:1.7;white-space:pre-wrap;}
        .pdp-recebe{display:grid;gap:10px;}
        .pdp-recebe div{display:flex;gap:10px;align-items:center;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}
        .pdp-seller{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;}
        .pdp-seller .av{width:50px;height:50px;border-radius:14px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Outfit';font-weight:900;font-size:22px;}
        .pdp-rev{border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px;}
        .pdp-rev .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
        .pdp-price{margin-bottom:16px;}
        .pdp-old{color:var(--muted);text-decoration:line-through;font-size:15px;}
        .pdp-now{font-family:'Outfit';font-size:34px;font-weight:900;letter-spacing:-1px;display:flex;align-items:center;gap:10px;}
        .pdp-off{background:#E6FBF3;color:var(--green);font-size:13px;font-weight:800;padding:3px 10px;border-radius:50px;font-family:'Outfit';}
        .pdp-trust{margin-top:16px;display:grid;gap:9px;font-size:13px;color:var(--sub);border-top:1px solid var(--border);padding-top:16px;}
        .pdp-soldby{margin-top:14px;font-size:12px;color:var(--muted);text-align:center;}
        .pdp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px;}
        .pdp-mbar{display:none;}
        @media(max-width:860px){
          .pdp{flex-direction:column;gap:20px;padding-bottom:90px;}
          .pdp-aside{display:none;}
          .pdp-hero{font-size:72px;}
          .pdp-title{font-size:24px;}
          .pdp-mbar{display:flex;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--border);box-shadow:0 -4px 20px rgba(0,0,0,.08);padding:12px 16px;z-index:50;align-items:center;gap:14px;}
          .pdp-mbar .pp{font-family:'Outfit';font-size:22px;font-weight:900;flex:1;}
        }
      `}</style>

      <div className="pdp">
        <div className="pdp-main">
          <div className="pdp-hero">
            {p.capa_url ? <img src={p.capa_url} alt={p.titulo} /> : <span>{p.emoji}</span>}
          </div>
          <span className="pdp-chip">{p.categoria}</span>
          <h1 className="pdp-title">{p.titulo}</h1>
          <div className="pdp-meta">
            <span className="pdp-star">{stars(media)}</span>
            <span>{media ? media.toFixed(1) : '—'}</span>
            <span>· {reviews.length} avaliações</span>
            <span>· {p.vendas.toLocaleString('pt-BR')} vendas</span>
          </div>

          <div className="pdp-sec">
            <h2>Sobre o produto</h2>
            <div className="pdp-desc">{p.descricao || 'Sem descrição.'}</div>
          </div>

          <div className="pdp-sec">
            <h2>O que você recebe</h2>
            <div className="pdp-recebe">
              <div>⚡ Entrega imediata e automática após o pagamento</div>
              <div>📦 {ENTREGA[p.tipo_entrega] || 'Acesso ao produto'}</div>
              <div>🛡️ Garantia de {p.garantia_dias} dias</div>
            </div>
          </div>

          <div className="pdp-sec">
            <h2>Vendedor</h2>
            <a href={`/loja/${p.stores?.slug}`} className="pdp-seller" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="av">{(p.stores?.nome || 'L').charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontFamily: 'Outfit' }}>{p.stores?.nome} ✓</strong>
                <div className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>Ver loja · Nível {p.stores?.nivel}</div>
              </div>
              <span className="muted" style={{ fontSize: 20 }}>›</span>
            </a>
          </div>

          <div className="pdp-sec">
            <h2>Avaliações</h2>
            {reviews.length ? reviews.map((r, i) => (
              <div className="pdp-rev" key={i}>
                <div className="h">
                  <span className="pdp-star">{stars(r.nota)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--sub)' }}>{r.comentario || 'Sem comentário.'}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Comprador verificado</div>
              </div>
            )) : <p className="muted" style={{ fontSize: 14 }}>Ainda não há avaliações. Seja o primeiro a avaliar após a compra.</p>}
          </div>

          {relacionados.length > 0 && (
            <div className="pdp-sec">
              <h2>Mais deste vendedor</h2>
              <div className="pdp-grid">
                {relacionados.map((rp) => <ProductCard key={rp.id} p={rp} />)}
              </div>
            </div>
          )}

          {daCategoria.length > 0 && (
            <div className="pdp-sec">
              <h2>Você também pode gostar</h2>
              <div className="pdp-grid">
                {daCategoria.map((rp) => <ProductCard key={rp.id} p={rp} />)}
              </div>
            </div>
          )}
        </div>

        <aside className="pdp-aside">{BuyBox}</aside>
      </div>

      <div className="pdp-mbar">
        <div className="pp">{money(preco)}</div>
        <BuyButton productId={p.id} />
      </div>
    </>
  );
}
