import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const orderId = new URL(req.url).searchParams.get('order');
  if (!orderId) return NextResponse.json({ error: 'sem pedido' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders')
    .select('status, comprador, products(arquivo_path)')
    .eq('id', orderId).single();

  const paid = order && (order.status === 'pago' || order.status === 'entregue');
  if (!order || order.comprador !== user.id || !paid) {
    return NextResponse.json({ error: 'sem acesso a este download' }, { status: 403 });
  }
  const path = (order as any).products?.arquivo_path;
  if (!path) return NextResponse.json({ error: 'produto sem arquivo' }, { status: 404 });

  const { data, error } = await admin.storage.from('entregaveis').createSignedUrl(path, 3600, { download: true });
  if (error || !data) return NextResponse.json({ error: 'falha ao gerar link' }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
