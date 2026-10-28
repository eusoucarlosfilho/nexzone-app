import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { lerConfig } from '@/lib/recrutamento-servidor';
import Obrigado from './Obrigado';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cadastro recebido | Comprei Barato', robots: { index: false, follow: false } };

export default async function ObrigadoPage() {
  let pixel = '', whatsapp = '';
  try { const c = await lerConfig(createAdminClient()); pixel = c.pixel; whatsapp = c.whatsapp; } catch {}
  return <Obrigado pixel={pixel} whatsapp={whatsapp} />;
}
