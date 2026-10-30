import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { autorizarPedido } from '@/lib/conversas-servidor';
import { notificarMensagem } from '@/lib/notificacoes';

export const dynamic = 'force-dynamic';

// Admin: libera uma mensagem retida (não era contato externo). POST { id }
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const id = String(b.id || '');
  const { data: m } = await createAdminClient().from('order_messages').select('id, order_id, papel, remetente, retido_texto').eq('id', id).maybeSingle();
  if (!m || !(m as any).retido_texto) return NextResponse.json({ error: 'Mensagem não encontrada ou já liberada.' }, { status: 404 });
  const auth = await autorizarPedido((m as any).order_id, user.id);
  if ('erro' in auth || auth.papel !== 'admin') return NextResponse.json({ error: 'Só o admin libera mensagens.' }, { status: 403 });
  const texto = (m as any).retido_texto;
  const { error } = await auth.admin.from('order_messages').update({ texto, retido_texto: null, alerta: 'liberada' }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Não foi possível liberar.' }, { status: 500 });
  await notificarMensagem(auth.admin, { orderId: (m as any).order_id, papel: (m as any).papel, remetenteId: (m as any).remetente, texto });
  return NextResponse.json({ ok: true });
}
