import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ vendas: [] }, { status: 401 });

  const since = new URL(req.url).searchParams.get('since');
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ vendas: [] });

  let q = supabase.from('orders')
    .select('valor_vendedor, entregue_em, products(titulo)')
    .eq('store_id', store.id).eq('status', 'entregue');
  if (since) q = q.gt('entregue_em', since);
  const { data } = await q.order('entregue_em', { ascending: false }).limit(5);

  const vendas = (data ?? []).map((o: any) => ({ titulo: o.products?.titulo ?? 'Produto', valor: o.valor_vendedor }));
  return NextResponse.json({ vendas });
}
