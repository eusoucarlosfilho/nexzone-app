import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { CHAVE_MIX, configMix } from '@/lib/ofertas/servidor';
import { normalizarMix } from '@/lib/ofertas/mix';

export const dynamic = 'force-dynamic';

// Proporção de ofertas de parceiros na vitrine (tabela settings, chave ofertas_parceiras_mix).
export async function GET() {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  return NextResponse.json({ mix: await configMix() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => null);
  const mix = normalizarMix(body?.mix);
  const { error } = await createAdminClient().from('settings').upsert({ key: CHAVE_MIX, value: mix, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true, mix });
}
