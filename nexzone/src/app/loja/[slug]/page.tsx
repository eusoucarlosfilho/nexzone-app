import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';
import Icon from '@/components/Icon';
import JourneyBadge from '@/components/JourneyBadge';
import { computeJourney, getStoreRevenue } from '@/lib/journey';
import { PRODUTO_CARD } from '@/lib/consultas';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data: store } = await admin.from('stores').select('nome, descricao, banner_url, ocultar_vendedor').eq('slug', params.slug).maybeSingle();
  if (!store || (store as any).ocultar_vendedor === true) return { title: 'Loja — Comprei Barato' };
  const desc = store.descricao ? String(store.descricao).slice(0, 150) : `Confira os produtos de ${store.nome} no Comprei Barato.`;
  const images = store.banner_url ? [{ url: store.banner_url as string }] : [];
  return { title: `${store.nome} — Comprei Barato`, description: desc, openGraph: { title: String(store.nome), description: desc, images, type: 'website' } };
}

// Mural de avaliações da loja: todas as notas dos compradores em todos os anúncios (inclusive os que saíram do ar).
type Avaliacao = { nota: number; comentario: string | null; created_at: string; produto: string; produtoId: string; ativo: boolean; quem: string };
async function avaliacoesDaLoja(admin: ReturnType<typeof createAdminClient>, storeId: string) {
  const vazio = { total: 0, media: 0, dist: [0, 0, 0, 0, 0], lista: [] as Avaliacao[] };
  try {
    const { data: ps } = await admin.from('products').select('id, titulo, status').eq('store_id', storeId).limit(2000);
    const prods = (ps ?? []) as any[];
    if (!prods.length) return vazio;
    const porId = Object.fromEntries(prods.map((p) => [p.id, p]));
    const { data: rs } = await admin.from('reviews').select('nota, comentario, created_at, product_id, comprador').in('product_id', prods.map((p) => p.id)).order('created_at', { ascending: false }).limit(2000);
    const revs = ((rs ?? []) as any[]).filter((r) => Number(r.nota) >= 1 && Number(r.nota) <= 5);
    if (!revs.length) return vazio;
    const ids = Array.from(new Set(revs.map((r) => r.comprador).filter(Boolean))).slice(0, 500);
    const { data: perfis } = ids.length ? await admin.from('profiles').select('id, nome').in('id', ids) : { data: [] as any[] };
    // Privacidade: só o 1º nome e a inicial do sobrenome ("Felipe A.")
    const nomeCurto = (n: unknown) => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); return p.length ? `${p[0]}${p[1] ? ` ${p[p.length - 1][0].toUpperCase()}.` : ''}` : 'Comprador'; };
    const nomes = Object.fromEntries(((perfis ?? []) as any[]).map((x) => [x.id, nomeCurto(x.nome)]));
    const dist = [0, 0, 0, 0, 0];
    for (const r of revs) dist[5 - Math.round(Number(r.nota))]++;
    const media = revs.reduce((t, r) => t + Number(r.nota), 0) / revs.length;
    const lista: Avaliacao[] = revs.slice(0, 60).map((r) => ({
      nota: Math.round(Number(r.nota)), comentario: r.comentario ? String(r.comentario).slice(0, 600) : null, created_at: r.created_at,
      produto: porId[r.product_id]?.titulo || 'Produto', produtoId: r.product_id, ativo: porId[r.product_id]?.status === 'ativo', quem: nomes[r.comprador] || 'Comprador',
    }));
    return { total: revs.length, media: Math.round(media * 10) / 10, dist, lista };
  } catch { return vazio; }
}
const estrelas = (n: number) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));

export default async function LojaPage({ params, searchParams }: { params: { slug: string }; searchParams?: { aba?: string } }) {
  const admin = createAdminClient();
  const { data: store } = await admin.from('stores')
    .select('id, nome, descricao, categoria, nivel, status, logo_url, banner_url, cor, ocultar_vendedor')
    .eq('slug', params.slug).neq('status', 'suspenso').maybeSingle();
  // Loja que vende como Comprei Barato não tem página pública
  if (!store || (store as any).ocultar_vendedor === true) notFound();

  const supabase = createClient();
  const { data: prods } = await supabase.from('products')
    .select(PRODUTO_CARD).eq('store_id', store.id).eq('status', 'ativo')
    .order('vendas', { ascending: false }).limit(120);
  const produtos = (prods ?? []) as unknown as Product[];
  const verificada = store.status === 'verificado';
  const cor = store.cor || '#FF6B00';
  const rev = await getStoreRevenue(admin, store.id);
  const selo = computeJourney(rev.faturamento, rev.vendas).atual;
  const av = await avaliacoesDaLoja(admin, store.id);
  const aba = searchParams?.aba === 'avaliacoes' ? 'avaliacoes' : 'produtos';

  return (
    <>
      <Nav />

      <div style={{ height: 200, background: store.banner_url ? `url(${store.banner_url}) center/cover` : `linear-gradient(135deg, ${cor}, #FF9A3C)` }} />

      <div className="page" style={{ marginTop: -46 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 14 }}>
          <div style={{ width: 92, height: 92, borderRadius: 20, border: '4px solid #fff', background: store.logo_url ? `url(${store.logo_url}) center/cover` : `linear-gradient(135deg, ${cor}, #FF9A3C)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Outfit', fontWeight: 900, fontSize: 38, flexShrink: 0, boxShadow: '0 6px 20px rgba(0,0,0,.12)' }}>
            {!store.logo_url && store.nome.charAt(0).toUpperCase()}
          </div>
          <div style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
                {store.nome}
                {verificada && <Icon name="checkCircle" size={20} style={{ color: "var(--green)" }} title="Vendedor verificado" />}
              </h1>
              {selo && (
                <span title={`Selo ${selo.nome} da jornada de faturamento`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 4px', borderRadius: 50, background: '#fff', border: '1px solid var(--border)', fontSize: 12, fontWeight: 900, color: selo.cores.edge }}>
                  <JourneyBadge tierId={selo.id} size={22} />
                  {selo.nome}
                </span>
              )}
            </div>
            <div className="muted" style={{ textTransform: 'capitalize' }}>
              {verificada ? 'Vendedor verificado · ' : ''}Nível {store.nivel}{store.categoria ? ` · ${store.categoria}` : ''}
            </div>
            {av.total > 0 && <Link href="?aba=avaliacoes" className="lj-nota"><span>{estrelas(av.media)}</span> <b>{String(av.media).replace('.', ',')}</b> · {av.total} {av.total === 1 ? 'avaliação' : 'avaliações'}</Link>}
          </div>
        </div>
        {store.descricao && <p style={{ color: 'var(--sub)', maxWidth: 640, marginBottom: 20 }}>{store.descricao}</p>}

        <style dangerouslySetInnerHTML={{ __html: CSS_LOJA }} />
        <nav className="lj-abas" aria-label="Seções da loja">
          <Link href="?" scroll={false} className={aba === 'produtos' ? 'on' : ''} aria-current={aba === 'produtos' ? 'page' : undefined}>Produtos <small>{produtos.length}</small></Link>
          <Link href="?aba=avaliacoes" scroll={false} className={aba === 'avaliacoes' ? 'on' : ''} aria-current={aba === 'avaliacoes' ? 'page' : undefined}>Avaliações <small>{av.total}</small></Link>
        </nav>

        {aba === 'produtos' ? (produtos.length
          ? <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          : <p className="muted">Esta loja ainda não tem produtos publicados.</p>
        ) : (
          <section aria-label="Avaliações dos compradores">
            {!av.total ? (
              <div className="lj-vazio"><b>Ainda sem avaliações</b><p className="muted">As avaliações aparecem aqui quando os compradores avaliam a compra depois da entrega.</p></div>
            ) : (
              <>
                <div className="lj-resumo">
                  <div className="lj-media"><b>{String(av.media).replace('.', ',')}</b><span>{estrelas(av.media)}</span><small>{av.total} {av.total === 1 ? 'avaliação' : 'avaliações'} de compras reais</small></div>
                  <div className="lj-barras">
                    {av.dist.map((q, i) => (
                      <div key={i} className="lj-barra"><span>{5 - i} ★</span><i><em style={{ width: `${av.total ? Math.round((q / av.total) * 100) : 0}%` }} /></i><small>{q}</small></div>
                    ))}
                  </div>
                </div>
                <div className="lj-lista">
                  {av.lista.map((r, i) => (
                    <article key={i} className="lj-av">
                      <header><span className="lj-est" aria-label={`${r.nota} de 5 estrelas`}>{estrelas(r.nota)}</span><b>{r.quem}</b><time>{new Date(r.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time></header>
                      {r.comentario ? <p>{r.comentario}</p> : <p className="muted" style={{ fontStyle: 'italic' }}>Avaliou sem comentário.</p>}
                      <small className="muted">Comprou: {r.ativo ? <Link href={`/produto/${r.produtoId}`}>{r.produto}</Link> : r.produto}</small>
                    </article>
                  ))}
                </div>
                {av.total > av.lista.length && <p className="muted" style={{ marginTop: 12 }}>Mostrando as {av.lista.length} avaliações mais recentes.</p>}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}

const CSS_LOJA = `
.lj-nota{display:inline-flex;align-items:center;gap:6px;margin-top:4px;font-size:13.5px;color:var(--sub);text-decoration:none}
.lj-nota span{color:#F5B400;letter-spacing:1px}.lj-nota b{color:var(--text);font-family:Outfit}
.lj-abas{display:flex;gap:6px;border-bottom:1px solid var(--border);margin:22px 0 16px}
.lj-abas a{padding:10px 16px;font-family:Outfit;font-weight:800;font-size:15px;color:var(--sub);text-decoration:none;border-bottom:3px solid transparent;margin-bottom:-1px;display:inline-flex;gap:6px;align-items:center}
.lj-abas a small{background:var(--soft);color:var(--sub);border-radius:50px;padding:1px 8px;font-size:12px}
.lj-abas a.on{color:var(--text);border-color:var(--orange)}
.lj-abas a.on small{background:var(--orange);color:#fff}
.lj-vazio{border:1px dashed var(--border);border-radius:18px;padding:28px;text-align:center}
.lj-resumo{display:grid;grid-template-columns:minmax(160px,220px) 1fr;gap:24px;align-items:center;background:#fff;border:1px solid var(--border);border-radius:20px;padding:20px;margin-bottom:16px}
.lj-media{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}
.lj-media b{font-family:Outfit;font-size:46px;font-weight:900;line-height:1}
.lj-media span{color:#F5B400;font-size:20px;letter-spacing:2px}
.lj-media small{color:var(--sub);font-size:12.5px}
.lj-barras{display:flex;flex-direction:column;gap:6px}
.lj-barra{display:grid;grid-template-columns:36px 1fr 30px;gap:8px;align-items:center;font-size:13px;color:var(--sub);font-weight:700}
.lj-barra i{display:block;height:8px;border-radius:8px;background:var(--soft);overflow:hidden}
.lj-barra em{display:block;height:100%;background:#F5B400;border-radius:8px}
.lj-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.lj-av{background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.lj-av header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lj-av header b{font-family:Outfit;font-size:14px}
.lj-av time{margin-left:auto;color:var(--muted);font-size:12px}
.lj-est{color:#F5B400;letter-spacing:1px}
.lj-av p{margin:0;font-size:14.5px;line-height:1.5;overflow-wrap:anywhere}
.lj-av small a{color:var(--orange-ink)}
@media(max-width:640px){.lj-resumo{grid-template-columns:1fr}}
`;
