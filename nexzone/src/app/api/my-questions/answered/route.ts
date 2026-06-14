import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ respostas: [] }, { status: 401 });

  const since = new URL(req.url).searchParams.get('since');
  let q = supabase.from('product_questions')
    .select('respondida_em, products(titulo)')
    .eq('autor', user.id).not('resposta', 'is', null);
  if (since) q = q.gt('respondida_em', since);
  const { data } = await q.order('respondida_em', { ascending: false }).limit(5);
  const respostas = (data ?? []).map((x: any) => ({ titulo: x.products?.titulo ?? 'Produto' }));
  return NextResponse.json({ respostas });
}
