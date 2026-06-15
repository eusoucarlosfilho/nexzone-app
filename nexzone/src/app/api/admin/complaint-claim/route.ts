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
  const { data: cmp } = await admin.from('complaints').select('id, atendido_por, status').eq('id', complaintId).maybeSingle();
  if (!cmp) return NextResponse.json({ error: 'reclamação não encontrada' }, { status: 404 });
  if ((cmp as any).atendido_por) return NextResponse.json({ error: 'Alguém já está atendendo esta reclamação.' }, { status: 400 });

  const { error } = await admin.from('complaints')
    .update({ atendido_por: user.id, atendido_em: new Date().toISOString() })
    .eq('id', complaintId).is('atendido_por', null); // evita corrida entre dois admins
  if (error) return NextResponse.json({ error: 'falha ao pegar' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
