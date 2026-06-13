import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: 'sem produto' }, { status: 400 });

  const { data: existing } = await supabase.from('favorites')
    .select('product_id').eq('user_id', user.id).eq('product_id', productId).maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', productId);
    return NextResponse.json({ favorited: false });
  }
  await supabase.from('favorites').insert({ user_id: user.id, product_id: productId });
  return NextResponse.json({ favorited: true });
}
