import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { redirect } from 'next/navigation';
import CreateProduct from './CreateProduct';
import MyProducts from './MyProducts';

export const dynamic = 'force-dynamic';

export default async function ProdutosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  const { boost_plans } = await getSettings();
  const { data: produtos } = store
    ? await supabase.from('products').select('*').eq('store_id', store.id).order('created_at', { ascending: false })
    : { data: [] as any[] };

  return (
    <div>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Produtos</h1>
      <p className="muted">Cadastre e gerencie seu catálogo. Produtos novos passam por revisão antes de ir ao ar.</p>

      <div className="card" style={{ marginTop: 22, maxWidth: 680 }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: 18, marginBottom: 16 }}>Cadastrar produto</h2>
        <CreateProduct userId={user.id} />
      </div>

      <h2 style={{ fontFamily: 'Outfit', fontSize: 18, margin: '28px 0 14px' }}>Meus produtos</h2>
      <div className="card" style={{ padding: 0 }}>
        <MyProducts products={produtos ?? []} userId={user.id} planos={boost_plans} />
      </div>
    </div>
  );
}
