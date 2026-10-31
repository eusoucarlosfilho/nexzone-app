import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resumoIndicacoes } from '@/lib/indicacao-servidor';

export const dynamic = 'force-dynamic';

// Minhas indicações: só os números do usuário logado (o id vem da sessão, nunca do navegador).
export async function GET() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const r = await resumoIndicacoes(createAdminClient(), user.id);
  return NextResponse.json(r, { headers: { 'Cache-Control': 'private, no-store' } });
}
