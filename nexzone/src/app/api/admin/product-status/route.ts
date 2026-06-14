import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const { id, action } = await req.json();
  const status = action === 'aprovar' ? 'ativo' : 'reprovado';
  const { error } = await supabase.from('products').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: 'falha' }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
