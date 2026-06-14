import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CuponsClient from './CuponsClient';

export const dynamic = 'force-dynamic';

export default async function CuponsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();

  const [cupRes
  ] = await Promise.all([
    store ? supabase.from('coupons').select('*').eq('store_id', store.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ]);
  const { data: produtos } = store
    ? await supabase.from('products').select('id, titulo').eq('store_id', store.id).order('created_at', { ascending: false })
    : { data: [] as any[] };

  return (
    <div>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Cupons</h1>
      <p className="muted">Crie cupons de desconto para suas campanhas. O comprador aplica no checkout.</p>
      <CuponsClient cupons={cupRes.data ?? []} produtos={produtos ?? []} />
    </div>
  );
}
