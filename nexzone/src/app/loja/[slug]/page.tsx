import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LojaPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data: store } = await admin.from('stores')
    .select('id, nome, descricao, categoria, nivel, status')
    .eq('slug', params.slug).neq('status', 'suspenso').maybeSingle();
  if (!store) notFound();

  const supabase = createClient();
  const { data: prods } = await supabase.from('products')
    .select('*, stores(nome, nivel)').eq('store_id', store.id).eq('status', 'ativo')
    .order('vendas', { ascending: false });
  const produtos = (prods ?? []) as Product[];
  const verificada = store.status === 'verificado';

  return (
    <>
      <Nav />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Outfit', fontWeight: 900, fontSize: 28 }}>
            {store.nome.charAt(0).toUpperCase()}
          </div>
          <div>
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
