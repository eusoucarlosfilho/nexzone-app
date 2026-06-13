import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'sem id' }, { status: 400 });
  const { data } = await supabase.from('orders')
    .select('status, conteudo_liberado').eq('id', id).eq('comprador', user.id).single();
  if (!data) return NextResponse.json({ error: 'pedido não encontrado' }, { status: 404 });
  return NextResponse.json({ status: data.status, conteudo: data.conteudo_liberado });
}
