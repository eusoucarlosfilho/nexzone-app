import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CaixaEmail from '../CaixaEmail';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caixa de e-mail | Comprei Barato', robots: { index: false, follow: false } };

// Caixa de e-mail em janela própria (abre pelo admin em "Abrir em nova janela" e pelos avisos do sino).
export default async function CaixaEmailPagina({ searchParams }: { searchParams?: { id?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/email');
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') redirect('/');
  const id = Number(searchParams?.id) || null;
  return <CaixaEmail janela abrirId={id} />;
}
