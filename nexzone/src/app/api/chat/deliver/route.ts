import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { orderId, conteudo } = await req.json();
  if (!orderId || !conteudo || !String(conteudo).trim()) return NextResponse.json({ error: 'conteúdo vazio' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, store_id, status').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'pedido não encontrado' }, { status: 404 });

  // Só o dono da loja entrega
  const { data: store } = await admin.from('stores').select('id').eq('id', (order as any).store_id).eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'sem acesso' }, { status: 403 });

  const texto = String(conteudo).trim().slice(0, 4000);

  await admin.from('orders').update({
    conteudo_liberado: texto, status: 'entregue', entregue_em: new Date().toISOString(),
  }).eq('id', orderId);

  // Mensagem de sistema + a entrega como mensagem do vendedor
  await admin.from('order_messages').insert([
    { order_id: orderId, remetente: null, papel: 'sistema', texto: '✅ O vendedor entregou o produto. O conteúdo já está liberado na sua compra.' },
    { order_id: orderId, remetente: user.id, papel: 'vendedor', texto },
  ]);

  return NextResponse.json({ ok: true });
}
