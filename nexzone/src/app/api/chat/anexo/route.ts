import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { autorizarPedido, uploadAnexoChat, linkAnexoChat } from '@/lib/conversas-servidor';

export const dynamic = 'force-dynamic';

// Anexos do chat do pedido (bucket PRIVADO "chat-anexos").
//   POST { orderId, tipo, tamanho } → URL assinada para subir o arquivo (só quem participa do pedido)
//   GET  ?id=<mensagem>            → abre o anexo por um link de 5 minutos (só quem participa do pedido)
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const auth = await autorizarPedido(orderId, user.id);
  if ('erro' in auth) return NextResponse.json({ error: auth.erro }, { status: 403 });
  if (!['pago', 'entregue', 'reembolsado'].includes(auth.order.status)) return NextResponse.json({ error: 'A conversa abre depois do pagamento.' }, { status: 409 });
  const r = await uploadAnexoChat(auth.admin, orderId, String(b.tipo || ''), Number(b.tamanho));
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id || id.length > 64) return NextResponse.json({ error: 'anexo inválido' }, { status: 400 });
  const { data: m } = await createAdminClient().from('order_messages').select('order_id, anexo_path, anexo_nome, anexo_tipo').eq('id', id).maybeSingle();
  if (!m || !(m as any).anexo_path) return NextResponse.json({ error: 'anexo não encontrado' }, { status: 404 });
  const auth = await autorizarPedido((m as any).order_id, user.id);
  if ('erro' in auth) return NextResponse.json({ error: 'sem acesso' }, { status: 403 });
  const baixar = new URL(req.url).searchParams.get('baixar') === '1';
  const url = await linkAnexoChat(auth.admin, (m as any).anexo_path, (m as any).anexo_nome || 'anexo', baixar);
  if (!url) return NextResponse.json({ error: 'Não foi possível abrir o anexo.' }, { status: 500 });
  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
}
