import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getGateway } from '@/lib/payments/gateway';
import { getSettings } from '@/lib/settings';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { productId, dias, cpf } = await req.json();
  const settings = await getSettings();
  const plano = settings.boost_plans.find((p) => p.dias === Number(dias));
  if (!plano) return NextResponse.json({ error: 'plano inválido' }, { status: 400 });

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'sem loja' }, { status: 403 });

  const { data: product } = await supabase.from('products')
    .select('id, titulo, store_id').eq('id', productId).eq('store_id', store.id).maybeSingle();
  if (!product) return NextResponse.json({ error: 'produto não encontrado' }, { status: 404 });

  // reaproveita boost pendente do mesmo produto+plano
  const { data: existing } = await supabase.from('boosts')
    .select('id, pix_code').eq('product_id', productId).eq('dias', plano.dias).eq('status', 'pendente')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing && (existing as any).pix_code) return NextResponse.json({ boostId: existing.id });

  const { data: boost, error } = await supabase.from('boosts').insert({
    store_id: store.id, product_id: productId, dias: plano.dias, valor: plano.valor, status: 'pendente',
  }).select().single();
  if (error || !boost) return NextResponse.json({ error: 'falha ao criar' }, { status: 500 });

  const { data: me } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle();
  const gw = await getGateway();
  const pay = await gw.createPixPayment({
    orderId: `boost:${boost.id}`, amount: plano.valor, sellerRecipientId: null, feePercent: 0,
    description: `Destaque ${plano.dias} dias — ${product.titulo}`, payerEmail: user.email ?? undefined,
    payerName: (me as any)?.nome ?? undefined, payerDocument: cpf ?? undefined,
  });
  if (pay.status === 'erro') return NextResponse.json({ error: pay.error || 'falha no gateway' }, { status: 502 });

  const adminUpd = createAdminClient();
  await adminUpd.from('boosts').update({
    gateway_ref: pay.gatewayRef, pix_code: pay.pixCopiaECola ?? null, pix_qr: pay.pixQrBase64 ?? null,
  }).eq('id', boost.id);

  return NextResponse.json({ boostId: boost.id });
}
