import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ids: [] });
  const { data } = await supabase.from('favorites').select('product_id').eq('user_id', user.id);
  return NextResponse.json({ ids: (data ?? []).map((r: any) => r.product_id) });
}
