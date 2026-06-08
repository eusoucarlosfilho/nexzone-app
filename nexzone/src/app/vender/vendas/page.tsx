import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VendasClient from './VendasClient';

export const dynamic = 'force-dynamic';

export default async function VendasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (<div><h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Vendas</h1><p className="muted">Cadastre um produto primeiro para começar a vender.</p></div>);
  }

  const { data: vendas } = await supabase.from('orders')
    .select('id, total, taxa, valor_vendedor, status, created_at, comprador_email, products(titulo, emoji)')
    .eq('store_id', store.id)
    .in('status', ['pago', 'entregue', 'reembolsado'])
    .order('created_at', { ascending: false });

  return <VendasClient vendas={vendas ?? []} />;
}
