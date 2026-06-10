import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import CheckoutEditor from './CheckoutEditor';

export const dynamic = 'force-dynamic';

export default async function CheckoutEditorPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  const { data: product } = await supabase.from('products')
    .select('id, titulo, checkout_config, store_id').eq('id', params.id).maybeSingle();
  if (!product || !store || product.store_id !== store.id) notFound();

  return (
    <div>
      <Link href="/vender/produtos" className="muted" style={{ fontSize: 13 }}>‹ Voltar aos produtos</Link>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, margin: '8px 0' }}>Personalizar checkout</h1>
      <div style={{ marginTop: 14 }}>
        <CheckoutEditor productId={product.id} userId={user.id} titulo={product.titulo} inicial={product.checkout_config} />
      </div>
    </div>
  );
}
