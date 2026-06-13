import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data: store } = await admin.from('stores').select('nome, descricao, banner_url').eq('slug', params.slug).maybeSingle();
  if (!store) return { title: 'Loja — Comprei Barato' };
  const desc = store.descricao ? String(store.descricao).slice(0, 150) : `Confira os produtos de ${store.nome} no Comprei Barato.`;
  const images = store.banner_url ? [{ url: store.banner_url as string }] : [];
  return { title: `${store.nome} — Comprei Barato`, description: desc, openGraph: { title: String(store.nome), description: desc, images, type: 'website' } };
}

export default async function LojaPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data: store } = await admin.from('stores')
    .select('id, nome, descricao, categoria, nivel, status, logo_url, banner_url, cor')
    .eq('slug', params.slug).neq('status', 'suspenso').maybeSingle();
  if (!store) notFound();

  const supabase = createClient();
  const { data: prods } = await supabase.from('products')
    .select('*, stores(nome, nivel)').eq('store_id', store.id).eq('status', 'ativo')
    .order('vendas', { ascending: false });
  const produtos = (prods ?? []) as Product[];
  const verificada = store.status === 'verificado';
  const cor = store.cor || '#FF6B00';

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
            <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>{store.nome} {verificada && '✓'}</h1>
            <div className="muted" style={{ textTransform: 'capitalize' }}>
              {verificada ? 'Vendedor verificado · ' : ''}Nível {store.nivel}{store.categoria ? ` · ${store.categoria}` : ''}
            </div>
          </div>
        </div>
        {store.descricao && <p style={{ color: 'var(--sub)', maxWidth: 640, marginBottom: 20 }}>{store.descricao}</p>}

        <h2 style={{ fontFamily: 'Outfit', fontSize: 18, margin: '22px 0 14px' }}>Produtos</h2>
        {produtos.length
          ? <div className="pg">{produtos.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          : <p className="muted">Esta loja ainda não tem produtos publicados.</p>}
      </div>
    </>
  );
}
