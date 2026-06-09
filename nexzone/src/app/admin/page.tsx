import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', textAlign: 'center' }}>
        <h1>Acesso restrito</h1>
        <p>Esta área é só para administradores.</p>
      </div>
    );
  }

  const [ordersRes, productsRes, storesRes, buyersRes, payoutsRes, boostsRes] = await Promise.all([
    supabase.from('orders')
      .select('id, status, total, taxa, created_at, products(titulo, emoji), stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('products')
      .select('id, titulo, emoji, preco, preco_promo, categoria, status, vendas, created_at, stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('stores')
      .select('id, nome, categoria, status, nivel, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['comprador', 'ambos']),
    supabase.from('payouts')
      .select('id, valor, status, pix_key, pix_tipo, created_at, pago_em, stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('boosts')
      .select('id, valor, dias, status, created_at, expira_em, products(titulo, emoji), stores(nome)')
      .order('created_at', { ascending: false }),
  ]);

  const orders = (ordersRes.data ?? []) as any[];
  const products = (productsRes.data ?? []) as any[];
  const stores = (storesRes.data ?? []) as any[];
  const payouts = (payoutsRes.data ?? []) as any[];
  const boosts = (boostsRes.data ?? []) as any[];
  const buyersCount = buyersRes.count ?? 0;

  const paid = orders.filter((o) => o.status === 'pago' || o.status === 'entregue');
  const gmv = paid.reduce((s, o) => s + Number(o.total), 0);
  const receita = paid.reduce((s, o) => s + Number(o.taxa), 0);
  const ticket = paid.length ? gmv / paid.length : 0;

  const daily: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const total = paid
      .filter((o) => { const t = new Date(o.created_at); return t >= d && t < next; })
      .reduce((s, o) => s + Number(o.total), 0);
    daily.push({ label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), total });
  }

  const metrics = {
    gmv, receita, ticket,
    pedidosPagos: paid.length,
    pedidosTotal: orders.length,
    filaProdutos: products.filter((p) => p.status === 'em_revisao').length,
    lojasPendentes: stores.filter((s) => s.status === 'pendente').length,
    totalLojas: stores.length,
    totalProdutos: products.length,
    totalProdutosAtivos: products.filter((p) => p.status === 'ativo').length,
    saquesPendentes: payouts.filter((p) => p.status === 'solicitado').length,
    aRepassar: payouts.filter((p) => p.status === 'solicitado').reduce((s, p) => s + Number(p.valor), 0),
    receitaDivulgacao: boosts.filter((b: any) => b.status === 'pago').reduce((s: number, b: any) => s + Number(b.valor), 0),
    destaquesAtivos: boosts.filter((b: any) => b.status === 'pago' && b.expira_em && new Date(b.expira_em) > new Date()).length,
    buyersCount,
  };

  return <AdminDashboard metrics={metrics} daily={daily} orders={orders} products={products} stores={stores} payouts={payouts} boosts={boosts} />;
}
