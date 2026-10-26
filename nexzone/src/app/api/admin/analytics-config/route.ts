import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { createAdminClient } from '@/lib/supabase/server';
import { esquecerCacheFunil, funilAtivo } from '@/lib/track-servidor';

export const dynamic = 'force-dynamic';

// Liga/desliga a gravação dos EVENTOS DE FUNIL (cadastro, cliques, busca). Padrão: desligado.
// Ligar só depois da revisão de privacidade (V3_PENDENCIAS.md). Exige adminSeguro (C1).
export async function GET() {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  esquecerCacheFunil();
  return NextResponse.json({ ativo: await funilAtivo() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => null);
  if (typeof body?.ativo !== 'boolean') return NextResponse.json({ error: 'Informe ativo: true ou false.' }, { status: 400 });
  const { error } = await createAdminClient().from('settings').upsert({ key: 'analytics_funil', value: body.ativo, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  esquecerCacheFunil();
  return NextResponse.json({ ativo: body.ativo });
}
