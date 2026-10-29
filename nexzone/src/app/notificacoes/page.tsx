import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/server';
import NotificacoesLista from './NotificacoesLista';
import AtivarCelular from '@/components/AtivarCelular';
import CentralNotificacoes from '@/components/CentralNotificacoes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notificações · Comprei Barato', robots: { index: false } };

export default async function NotificacoesPage({ searchParams }: { searchParams?: { aba?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/notificacoes');
  const prefs = searchParams?.aba === 'preferencias';
  const aba = (ativa: boolean): React.CSSProperties => ({
    padding: '9px 16px', borderRadius: 50, fontWeight: 800, fontSize: 14, textDecoration: 'none',
    background: ativa ? 'var(--text)' : 'var(--surface)', color: ativa ? '#fff' : 'var(--muted)', border: '1px solid var(--border)',
  });
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 820 }}>
        <nav aria-label="Notificações" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 18px' }}>
          <Link href="/notificacoes" style={aba(!prefs)} aria-current={!prefs ? 'page' : undefined}>Avisos recebidos</Link>
          <Link href="/notificacoes?aba=preferencias" style={aba(prefs)} aria-current={prefs ? 'page' : undefined}>Escolher notificações</Link>
        </nav>
        {prefs ? (
          <>
            <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>Central de notificações</h1>
            <CentralNotificacoes />
          </>
        ) : (
          <>
            <AtivarCelular />
            <NotificacoesLista />
          </>
        )}
      </div>
      <Footer />
    </>
  );
}
