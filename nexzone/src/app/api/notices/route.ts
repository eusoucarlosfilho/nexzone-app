import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: 'ativo', notices: [] });

  const admin = createAdminClient();
  const [{ data: prof }, { data: notices }] = await Promise.all([
    admin.from('profiles').select('status').eq('id', user.id).maybeSingle(),
    admin.from('user_notices').select('id, tipo, texto, created_at')
      .eq('user_id', user.id).eq('lida', false).order('created_at', { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    status: (prof as any)?.status ?? 'ativo',
    notices: notices ?? [],
  });
}

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const admin = createAdminClient();
  await admin.from('user_notices').update({ lida: true }).eq('user_id', user.id).eq('lida', false);
  return NextResponse.json({ ok: true });
}
