import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const { id, action } = await req.json();
  if (action !== 'reembolsar') return NextResponse.json({ error: 'ação inválida' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, status, product_id').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'pedido não encontrado' }, { status: 404 });
  if (!(order.status === 'pago' || order.status === 'entregue')) {
    return NextResponse.json({ error: 'só é possível reembolsar pedidos pagos/entregues' }, { status: 400 });
  }

  await admin.from('orders').update({ status: 'reembolsado' }).eq('id', id);
  const { data: prod } = await admin.from('products').select('vendas').eq('id', order.product_id).single();
  await admin.from('products').update({ vendas: Math.max(0, (prod?.vendas ?? 1) - 1) }).eq('id', order.product_id);

  return NextResponse.json({ ok: true, status: 'reembolsado' });
}
