import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ perguntas: [] }, { status: 401 });

  const since = new URL(req.url).searchParams.get('since');
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ perguntas: [] });

  let q = supabase.from('product_questions')
    .select('created_at, products(titulo)')
    .eq('store_id', store.id).is('resposta', null);
  if (since) q = q.gt('created_at', since);
  const { data } = await q.order('created_at', { ascending: false }).limit(5);
  const perguntas = (data ?? []).map((x: any) => ({ titulo: x.products?.titulo ?? 'Produto' }));
  return NextResponse.json({ perguntas });
}
