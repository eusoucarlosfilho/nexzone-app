import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import CheckoutClient from './CheckoutClient';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('products')
    .select('*, stores(nome)').eq('id', params.id).eq('status', 'ativo').single();
  if (!data) notFound();
  const p = data as Product;

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 900, marginBottom: 16 }}>Finalizar compra</h1>
        <CheckoutClient
          productId={p.id}
          titulo={p.titulo}
          emoji={p.emoji}
          loja={p.stores?.nome ?? 'Loja'}
          preco={Number(p.preco_promo ?? p.preco)}
        />
      </div>
    </>
  );
}
