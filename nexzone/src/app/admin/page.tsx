import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminDashboard from './AdminDashboard';
import { getSettings } from '@/lib/settings';

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
      .select('id, status, total, taxa, created_at, store_id, products(titulo, emoji), stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('products')
      .select('id, titulo, emoji, preco, preco_promo, categoria, status, vendas, nota, created_at, store_id, stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('stores')
      .select('id, nome, slug, categoria, status, nivel, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['comprador', 'ambos']),
    supabase.from('payouts')
      .select('id, valor, status, pix_key, pix_tipo, created_at, pago_em, store_id, stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('boosts')
      .select('id, valor, dias, status, created_at, expira_em, store_id, products(titulo, emoji), stores(nome)')
      .order('created_at', { ascending: false }),
  ]);

  const orders = (ordersRes.data ?? []) as any[];
  const products = (productsRes.data ?? []) as any[];
  const stores = (storesRes.data ?? []) as any[];
  const payouts = (payoutsRes.data ?? []) as any[];
  const boosts = (boostsRes.data ?? []) as any[];

  // ---- Enriquecimento por vendedor (CRM de vendedores) ----
  const now = Date.now();
  const dias = (d: any) => (d ? (now - new Date(d).getTime()) / 86400000 : Infinity);
  const acc: Record<string, any> = {};
  stores.forEach((s) => { acc[s.id] = { vendas: 0, gmv: 0, comissao: 0, ultimaVenda: null, produtosTotal: 0, produtosAtivos: 0, ultimoProduto: null, aSacar: 0, sacado: 0, destaques: 0, notaSum: 0, notaQtd: 0 }; });
  orders.forEach((o) => { const a = acc[o.store_id]; if (!a) return; if (o.status === 'pago' || o.status === 'entregue') { a.vendas++; a.gmv += Number(o.total); a.comissao += Number(o.taxa); if (!a.ultimaVenda || new Date(o.created_at) > new Date(a.ultimaVenda)) a.ultimaVenda = o.created_at; } });
  products.forEach((p) => { const a = acc[p.store_id]; if (!a) return; a.produtosTotal++; if (p.status === 'ativo') a.produtosAtivos++; if (!a.ultimoProduto || new Date(p.created_at) > new Date(a.ultimoProduto)) a.ultimoProduto = p.created_at; if (p.nota) { a.notaSum += Number(p.nota); a.notaQtd++; } });
  payouts.forEach((p) => { const a = acc[p.store_id]; if (!a) return; if (p.status === 'solicitado') a.aSacar += Number(p.valor); if (p.status === 'pago') a.sacado += Number(p.valor); });
  boosts.forEach((b) => { const a = acc[b.store_id]; if (!a) return; if (b.status === 'pago') a.destaques++; });

  function engajamento(s: any, a: any) {
    const idade = dias(s.created_at);
    const ultAtiv = Math.min(dias(a.ultimaVenda), dias(a.ultimoProduto));
    if (a.vendas === 0 && idade <= 7) return { tag: 'Novo', emoji: '🆕', tone: 'rev' };
    if (ultAtiv <= 7) return { tag: 'Ativo', emoji: '🔥', tone: 'act' };
    if (a.produtosTotal > 0 && a.vendas === 0 && idade > 7) return { tag: 'Travado', emoji: '⚠️', tone: 'pendente' };
    if (ultAtiv > 21) return { tag: 'Parado', emoji: '😴', tone: 'rej' };
    return { tag: 'Regular', emoji: '•', tone: 'pendente' };
  }

  const sellers = stores.map((s) => {
    const a = acc[s.id];
    return {
      id: s.id, nome: s.nome, slug: s.slug, status: s.status, nivel: s.nivel, categoria: s.categoria, created_at: s.created_at,
      produtosTotal: a.produtosTotal, produtosAtivos: a.produtosAtivos, vendas: a.vendas, gmv: a.gmv, comissao: a.comissao,
      ticket: a.vendas ? a.gmv / a.vendas : 0, ultimaVenda: a.ultimaVenda, ultimoProduto: a.ultimoProduto,
      aSacar: a.aSacar, sacado: a.sacado, destaques: a.destaques, notaMedia: a.notaQtd ? a.notaSum / a.notaQtd : 0,
      eng: engajamento(s, a),
    };
  }).sort((x, y) => y.gmv - x.gmv);
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

  const settings = await getSettings();

  const vendMap: Record<string, number> = {};
  paid.forEach((o) => { const n = o.stores?.nome || '—'; vendMap[n] = (vendMap[n] || 0) + Number(o.total); });
  const topVendedores = Object.entries(vendMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total).slice(0, 8);
  const topProdutos = [...products].sort((a, b) => (b.vendas || 0) - (a.vendas || 0)).slice(0, 8);
  const growth = { topVendedores, topProdutos };

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

  return <AdminDashboard metrics={metrics} daily={daily} orders={orders} products={products} stores={stores} payouts={payouts} boosts={boosts} settings={settings} growth={growth} sellers={sellers} />;
}
