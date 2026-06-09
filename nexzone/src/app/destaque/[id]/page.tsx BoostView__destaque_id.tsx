import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import BoostView from './BoostView';

export const dynamic = 'force-dynamic';

export default async function DestaquePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: boost } = await supabase.from('boosts')
    .select('id, status, dias, valor, pix_code, pix_qr, expira_em, products(titulo, emoji)')
    .eq('id', params.id).maybeSingle();
  if (!boost) notFound();
  const p: any = (boost as any).products;

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 560 }}>
        <BoostView
          boostId={boost.id}
          initialStatus={boost.status}
          dias={boost.dias}
          valor={Number(boost.valor)}
          pixCode={boost.pix_code}
          pixQr={boost.pix_qr}
          expira={boost.expira_em}
          titulo={p?.titulo ?? 'Produto'}
          emoji={p?.emoji ?? '📦'}
        />
      </div>
    </>
  );
}
