import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminDashboard from './AdminDashboard';
import { getSettings } from '@/lib/settings';
import { getPaymentConfigPublic } from '@/lib/payments/config';

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

  // Já confirmamos que é admin acima: usamos o client admin (service role)
  // para reclamações/torpedos, que dependem de RLS e não apareciam com o client comum.
  const admin = createAdminClient();

  // Mapa id->email (usado para "quem atendeu" a reclamação e para a lista de admins)
  let emailById: Record<string, string> = {};
  try {
    const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    emailById = Object.fromEntries(((usersList?.users) ?? []).map((u: any) => [u.id, u.email ?? '—']));
  } catch { emailById = {}; }

  const [ordersRes, productsRes, storesRes, buyersRes, payoutsRes, boostsRes, complaintsRes, alertsRes] = await Promise.all([
    supabase.from('orders')
      .select('id, status, total, taxa, created_at, store_id, products(titulo, emoji), stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('products')
      .select('id, titulo, emoji, preco, preco_promo, categoria, status, vendas, nota, created_at, store_id, stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('stores')
      .select('id, nome, slug, categoria, status, nivel, created_at, owner')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['comprador', 'ambos']),
    supabase.from('payouts')
      .select('id, valor, status, pix_key, pix_tipo, created_at, pago_em, store_id, stores(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('boosts')
      .select('id, valor, dias, status, created_at, expira_em, store_id, products(titulo, emoji), stores(nome)')
      .order('created_at', { ascending: false }),
    admin.from('complaints')
      .select('id, order_id, texto, status, created_at')
      .in('status', ['aberta', 'resolvida']).order('created_at', { ascending: false }).limit(200),
    admin.from('seller_alerts')
      .select('id, order_id, canal, destino, status, detalhe, created_at')
      .order('created_at', { ascending: false }).limit(100),
  ]);

  const orders = (ordersRes.data ?? []) as any[];
  const products = (productsRes.data ?? []) as any[];
  const stores = (storesRes.data ?? []) as any[];
  const payouts = (payoutsRes.data ?? []) as any[];
  const boosts = (boostsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const alerts = (alertsRes.data ?? []) as any[];

  // E-mail de quem pegou/resolveu cada reclamação
  // Enriquecimento resiliente: tenta ler as colunas de atendimento; se a migration
  // ainda não rodou, simplesmente ignora (não quebra a lista).
  try {
    const cids = complaints.map((c: any) => c.id);
    if (cids.length) {
      const { data: extra } = await admin.from('complaints')
        .select('id, atendido_por, atendido_em, resolvida_em, resolvido_por').in('id', cids);
      if (extra) {
        const em: Record<string, any> = Object.fromEntries((extra as any[]).map((e) => [e.id, e]));
        complaints.forEach((c: any) => {
          const e = em[c.id];
          if (e) { c.atendido_por = e.atendido_por; c.atendido_em = e.atendido_em; c.resolvida_em = e.resolvida_em; c.resolvido_por = e.resolvido_por; }
        });
      }
    }
  } catch { /* migration de atendimento ainda não rodou — ok */ }

  complaints.forEach((c: any) => {
    c.atendente_email = c.atendido_por ? (emailById[c.atendido_por] || '—') : null;
    c.resolvedor_email = c.resolvido_por ? (emailById[c.resolvido_por] || '—') : null;
  });

  // Junta os pedidos das reclamações/torpedos no código (sem depender de FK no PostgREST).
  const detalheOrderIds = Array.from(new Set(
    [...complaints, ...alerts].map((x: any) => x.order_id).filter(Boolean)
  ));
  if (detalheOrderIds.length) {
    const { data: detOrders } = await admin.from('orders')
      .select('id, total, comprador_email, products(titulo, emoji), stores(nome)')
      .in('id', detalheOrderIds);
    const omap: Record<string, any> = Object.fromEntries(((detOrders ?? []) as any[]).map((o) => [o.id, o]));
    complaints.forEach((c: any) => { c.orders = omap[c.order_id] || {}; });
    alerts.forEach((a: any) => { a.orders = omap[a.order_id] || {}; });
  }

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
      id: s.id, owner: s.owner, nome: s.nome, slug: s.slug, status: s.status, nivel: s.nivel, categoria: s.categoria, created_at: s.created_at,
      produtosTotal: a.produtosTotal, produtosAtivos: a.produtosAtivos, vendas: a.vendas, gmv: a.gmv, comissao: a.comissao,
      ticket: a.vendas ? a.gmv / a.vendas : 0, ultimaVenda: a.ultimaVenda, ultimoProduto: a.ultimoProduto,
      aSacar: a.aSacar, sacado: a.sacado, destaques: a.destaques, notaMedia: a.notaQtd ? a.notaSum / a.notaQtd : 0,
      eng: engajamento(s, a),
    };
  }).sort((x, y) => y.gmv - x.gmv);
  const buyersCount = buyersRes.count ?? 0;

  // ===== Lista de TODOS os usuários (comprador, vendedor, admin) =====
  const storeOwnerById: Record<string, string> = Object.fromEntries(stores.map((s: any) => [s.id, s.owner]));
  const orderStoreById: Record<string, string> = Object.fromEntries(orders.map((o: any) => [o.id, o.store_id]));
  const openComplaintsByOwner: Record<string, number> = {};
  complaints.filter((c: any) => c.status === 'aberta').forEach((c: any) => {
    const storeId = orderStoreById[c.order_id];
    const owner = storeId ? storeOwnerById[storeId] : null;
    if (owner) openComplaintsByOwner[owner] = (openComplaintsByOwner[owner] || 0) + 1;
  });
  const sellerByOwner: Record<string, any> = Object.fromEntries(sellers.map((s: any) => [s.owner, s]));

  // Busca TODOS os perfis com select('*'): assim a query NUNCA quebra por uma
  // coluna que talvez não exista no schema (ex.: cb_points, status). Lemos cada
  // campo de forma defensiva, com valor padrão.
  const { data: profilesRaw } = await admin.from('profiles').select('*');
  const profilesAll = ((profilesRaw as any[]) ?? []).slice().sort(
    (a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()
  );

  const users = (profilesAll).map((p: any) => ({
    id: p.id,
    email: emailById[p.id] || '—',
    nome: p.nome || (emailById[p.id] && emailById[p.id] !== '—' ? String(emailById[p.id]).split('@')[0] : 'Usuário'),
    role: p.role || 'comprador',
    status: p.status || 'ativo',
    cb_points: p.cb_points ?? 0,
    created_at: p.created_at,
    seller: sellerByOwner[p.id] || null,
    reclamacoesAbertas: openComplaintsByOwner[p.id] || 0,
  }));

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

  const settings: any = await getSettings();
  settings.payment = await getPaymentConfigPublic();

  // DeepSeek (importação por IA): expõe só se está configurada ou não, nunca a chave.
  try {
    const { data: dsRow } = await admin.from('settings').select('value').eq('key', 'deepseek_api_key').maybeSingle();
    settings.deepseek_key_set = !!(dsRow as any)?.value;
  } catch { settings.deepseek_key_set = false; }

  // Lista de administradores (perfil role=admin + e-mail vindo do auth)
  try {
    const { data: adminProfiles } = await admin.from('profiles').select('id').eq('role', 'admin');
    settings.admins = ((adminProfiles) ?? []).map((p: any) => ({ id: p.id, email: emailById[p.id] || '—' }));
  } catch { settings.admins = []; }

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

  return <AdminDashboard adminEmail={user.email} users={users} metrics={metrics} daily={daily} orders={orders} products={products} stores={stores} payouts={payouts} boosts={boosts} settings={settings} growth={growth} sellers={sellers} complaints={complaints} alerts={alerts} />;
}
