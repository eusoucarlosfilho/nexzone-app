import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/server';
import NotificacoesLista from './NotificacoesLista';
import AtivarCelular from '@/components/AtivarCelular';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notificações · Comprei Barato', robots: { index: false } };

export default async function NotificacoesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/notificacoes');
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 820 }}>
        <AtivarCelular />
        <NotificacoesLista />
      </div>
      <Footer />
    </>
  );
}
