import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGateway } from '@/lib/payments/gateway';
import { getSettings } from '@/lib/settings';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { productId } = await req.json();
  const { data: product } = await supabase
    .from('products')
    .select('*, stores(recipient_id)')
    .eq('id', productId).eq('status', 'ativo').single();
  if (!product) return NextResponse.json({ error: 'produto indisponível' }, { status: 404 });

  // Reaproveita pedido pendente existente (não duplica)
  const { data: existing } = await supabase.from('orders')
    .select('id, pix_code')
    .eq('comprador', user.id).eq('product_id', product.id).eq('status', 'pendente')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing && (existing as any).pix_code) {
    return NextResponse.json({ orderId: existing.id });
  }

  const total = Number(product.preco_promo ?? product.preco);
  const feePercent = (await getSettings()).commission_percent;
  const taxa = +(total * (feePercent / 100)).toFixed(2);
  const valorVendedor = +(total - taxa).toFixed(2);

  const { data: order, error } = await supabase.from('orders').insert({
    comprador: user.id, comprador_email: user.email ?? null, product_id: product.id, store_id: product.store_id,
    total, taxa, valor_vendedor: valorVendedor, status: 'pendente',
  }).select().single();
  if (error || !order) return NextResponse.json({ error: 'falha ao criar pedido' }, { status: 500 });

  const gw = getGateway();
  const pay = await gw.createPixPayment({
    orderId: order.id, amount: total,
    sellerRecipientId: (product as any).stores?.recipient_id ?? null,
    feePercent, description: product.titulo, payerEmail: user.email ?? undefined,
  });

  if (pay.status === 'erro') {
    return NextResponse.json({ error: pay.error || 'falha no gateway' }, { status: 502 });
  }

  await supabase.from('orders').update({
    gateway_ref: pay.gatewayRef,
    pix_code: pay.pixCopiaECola ?? null,
    pix_qr: pay.pixQrBase64 ?? null,
  }).eq('id', order.id);

  return NextResponse.json({ orderId: order.id });
}
