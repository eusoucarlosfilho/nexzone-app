import Nav from '@/components/Nav';
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
      <><Nav /><div className="page">
        <h1>Recebimentos</h1>
        <p className="muted">Você precisa criar sua loja primeiro.</p>
        <Link className="btn btn-pri btn-sm" href="/vender" style={{ marginTop: 12, display: 'inline-block' }}>Ir para o painel</Link>
      </div></>
    );
  }

  const bal = await calcBalance(supabase, store.id);
  const { data: payouts } = await supabase.from('payouts')
    .select('id, valor, status, created_at, pago_em').eq('store_id', store.id)
    .order('created_at', { ascending: false });

  return (
    <><Nav /><div className="page">
      <RecebimentosClient bal={bal} pixKey={store.pix_key} pixTipo={store.pix_tipo} payouts={payouts ?? []} />
    </div></>
  );
}
