import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { orderId, texto } = await req.json();
  if (!orderId || !texto || !String(texto).trim()) return NextResponse.json({ error: 'descreva o problema' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, comprador, status').eq('id', orderId).maybeSingle();
  if (!order || (order as any).comprador !== user.id) return NextResponse.json({ error: 'pedido não encontrado' }, { status: 404 });
  if (!['pago', 'entregue'].includes((order as any).status)) return NextResponse.json({ error: 'compra não elegível' }, { status: 400 });

  // já tem reclamação aberta?
  const { data: existe } = await admin.from('complaints').select('id').eq('order_id', orderId).eq('status', 'aberta').maybeSingle();
  if (existe) return NextResponse.json({ error: 'Você já tem uma reclamação aberta para este pedido.' }, { status: 400 });

  const { error } = await admin.from('complaints').insert({
    order_id: orderId, autor: user.id, texto: String(texto).trim().slice(0, 2000), status: 'aberta',
  });
  if (error) {
    // TEMPORÁRIO: mostra o motivo real do banco na tela, pra acharmos a causa.
    // Depois que estiver funcionando, a gente troca por uma mensagem amigável.
    console.error('[complaints] insert falhou:', error);
    return NextResponse.json(
      { error: 'Erro do banco: ' + (error.message || error.code || 'desconhecido') },
      { status: 500 }
    );
  }

  await admin.from('order_messages').insert({
    order_id: orderId, remetente: null, papel: 'sistema',
    texto: '⚠️ O cliente abriu uma reclamação. O saldo desta venda fica retido até o suporte resolver. Converse por aqui para tentar resolver.',
  });

  return NextResponse.json({ ok: true });
}
