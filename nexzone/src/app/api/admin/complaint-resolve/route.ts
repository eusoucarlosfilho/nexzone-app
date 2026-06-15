import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const { complaintId } = await req.json();
  if (!complaintId) return NextResponse.json({ error: 'sem id' }, { status: 400 });

  const admin = createAdminClient();
  const { data: cmp } = await admin.from('complaints').select('id, order_id, status').eq('id', complaintId).maybeSingle();
  if (!cmp) return NextResponse.json({ error: 'reclamação não encontrada' }, { status: 404 });

  await admin.from('complaints').update({ status: 'resolvida', resolvida_em: new Date().toISOString() }).eq('id', complaintId);
  await admin.from('order_messages').insert({
    order_id: (cmp as any).order_id, remetente: null, papel: 'sistema',
    texto: '✅ O suporte marcou a reclamação como resolvida. O saldo desta venda volta ao fluxo normal de liberação.',
  });

  return NextResponse.json({ ok: true });
}
