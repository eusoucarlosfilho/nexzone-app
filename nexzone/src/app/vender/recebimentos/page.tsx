import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { calcBalance } from '@/lib/balance';
import RecebimentosClient from './RecebimentosClient';

export const dynamic = 'force-dynamic';

export default async function RecebimentosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores')
    .select('id, pix_key, pix_tipo').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Recebimentos</h1>
        <p className="muted">Cadastre um produto primeiro para criar sua loja.</p>
        <Link className="btn btn-pri btn-sm" href="/vender/produtos" style={{ marginTop: 12, display: 'inline-block' }}>Cadastrar produto</Link>
      </div>
    );
  }

  const bal = await calcBalance(supabase, store.id);
  const { data: payouts } = await supabase.from('payouts')
    .select('id, valor, status, created_at, pago_em').eq('store_id', store.id)
    .order('created_at', { ascending: false });

  return <RecebimentosClient bal={bal} pixKey={store.pix_key} pixTipo={store.pix_tipo} payouts={payouts ?? []} />;
}
