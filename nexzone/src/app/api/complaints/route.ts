import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { avisarReclamacaoAberta } from '@/lib/whatsapp/avisos';
import { liberacaoReclamacao } from '@/lib/conversas-servidor';

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

  // Só depois de 24 h (ou se o vendedor já marcou entregue) e só dentro da garantia
  const lib = await liberacaoReclamacao(admin, orderId, null);
  if (!lib.pode) return NextResponse.json({ error: lib.erro, liberaEm: lib.liberaEm ?? null }, { status: 409 });

  // já tem reclamação aberta?
  const { data: existe } = await admin.from('complaints').select('id').eq('order_id', orderId).eq('status', 'aberta').maybeSingle();
  if (existe) return NextResponse.json({ error: 'Você já tem uma reclamação aberta para este pedido.' }, { status: 400 });

  const textoLimpo = String(texto).trim().slice(0, 2000);
  const { error } = await admin.from('complaints').insert({
    order_id: orderId, autor: user.id, texto: textoLimpo, status: 'aberta',
  });
  if (error) {
    console.error('[complaints] insert falhou:', error);
    return NextResponse.json({ error: 'falha ao abrir reclamação' }, { status: 500 });
  }

  // 1) Posta o texto da reclamação no chat, como mensagem do cliente,
  //    pra que vendedor, admin e o próprio cliente vejam o conteúdo.
  await admin.from('order_messages').insert({
    order_id: orderId, remetente: user.id, papel: 'comprador',
    texto: `Reclamação aberta:\n\n${textoLimpo}`,
  });

  // 2) Aviso do sistema sobre o saldo retido.
  await admin.from('order_messages').insert({
    order_id: orderId, remetente: null, papel: 'sistema',
    texto: 'O cliente abriu uma reclamação. O saldo desta venda fica retido até o suporte resolver. Converse por aqui para tentar resolver.',
  });

  await avisarReclamacaoAberta(orderId); // WhatsApp ao vendedor (se ligado); nunca lança erro
  return NextResponse.json({ ok: true });
}
