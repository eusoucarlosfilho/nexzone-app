import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VendasClient from './VendasClient';
import VendasPorOrigem from './VendasPorOrigem';
import { contatosDosCompradores } from '@/lib/clientesPedidos';

export const dynamic = 'force-dynamic';

export default async function VendasPage({ searchParams }: { searchParams?: { f?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id, nome').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (<div><h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Vendas</h1><p className="muted">Cadastre um produto primeiro para começar a vender.</p></div>);
  }

  // Vendas concluídas + pedidos aguardando pagamento (para recuperar) + reembolsados
  const { data: vendas } = await supabase.from('orders')
    .select('id, total, taxa, valor_vendedor, status, created_at, comprador, comprador_email, product_id, products(titulo, emoji, categoria, capa_url)')
    .eq('store_id', store.id)
    .in('status', ['pendente', 'pago', 'entregue', 'reembolsado', 'cancelado'])
    .order('created_at', { ascending: false })
    .limit(3000);

  // Nome e WhatsApp do comprador (só dos pedidos desta loja)
  const lista = (vendas ?? []) as any[];
  let clientes = {};
  try { clientes = await contatosDosCompradores(createAdminClient(), lista.map((v) => v.comprador)); } catch { clientes = {}; }

  // Origem das vendas (SQL 15). Sem o SQL 15: o relatório mostra tudo como "Direto / sem rastreio".
  const { data: origens, error: oErr } = await supabase.from('orders')
    .select('id, origem').eq('store_id', store.id).in('status', ['pago', 'entregue']).limit(5000);
  const mapa: Record<string, any> = oErr ? {} : Object.fromEntries(((origens ?? []) as any[]).map((o) => [o.id, o.origem]));
  const comOrigem = lista.filter((v) => v.status === 'pago' || v.status === 'entregue' || v.status === 'reembolsado')
    .map((v) => ({ total: Number(v.total), status: v.status, origem: mapa[v.id] ?? null }));

  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.compreibarato.com.br').replace(/\/+$/, '');
  return (
    <>
      <VendasClient vendas={lista} clientes={clientes} loja={(store as any).nome || ''} site={site} inicial={searchParams?.f === 'aguardando' ? 'aguardando' : 'vendas'} />
      <VendasPorOrigem vendas={comOrigem} />
    </>
  );
}
