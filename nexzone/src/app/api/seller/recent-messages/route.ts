import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Mensagens novas do comprador nos pedidos do vendedor (para notificar no painel).
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const since = new URL(req.url).searchParams.get('since') || new Date(Date.now() - 60000).toISOString();

  const admin = createAdminClient();
  const { data: stores } = await admin.from('stores').select('id').eq('owner', user.id);
  const storeIds = (stores ?? []).map((s: any) => s.id);
  if (!storeIds.length) return NextResponse.json({ mensagens: [] });

  const { data: orders } = await admin.from('orders').select('id, products(titulo)').in('store_id', storeIds);
  const map: any = Object.fromEntries((orders ?? []).map((o: any) => [o.id, o.products?.titulo ?? 'um produto']));
  const orderIds = Object.keys(map);
  if (!orderIds.length) return NextResponse.json({ mensagens: [] });

  const { data: msgs } = await admin.from('order_messages')
    .select('order_id, texto, created_at')
    .eq('papel', 'comprador').in('order_id', orderIds).gt('created_at', since)
    .order('created_at', { ascending: false }).limit(10);

  const mensagens = (msgs ?? []).map((m: any) => ({ orderId: m.order_id, titulo: map[m.order_id], texto: m.texto }));
  return NextResponse.json({ mensagens });
}
