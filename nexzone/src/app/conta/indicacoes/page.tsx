import { redirect } from 'next/navigation';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/server';
import IndicacoesCliente from './IndicacoesCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minhas indicações · Comprei Barato', robots: { index: false } };

export default async function MinhasIndicacoesPage() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect('/login?next=/conta/indicacoes');
  return (
    <>
      <Nav />
      <main className="c" style={{ padding: '24px var(--gut) 50px', maxWidth: 900 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, margin: '0 0 4px' }}>Minhas indicações</h1>
        <p className="muted" style={{ margin: '0 0 18px' }}>Convide amigos com o seu link. Quando um amigo novo fizer a primeira compra, você ganha CB Points.</p>
        <IndicacoesCliente />
      </main>
      <Footer />
    </>
  );
}
