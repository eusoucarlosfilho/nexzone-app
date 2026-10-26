import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { carregarBase } from '@/lib/admin/usuarios-servidor';
import { resumir } from '@/lib/admin/usuarios';
import { inicioDoDia } from '@/lib/admin/tempo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Indicadores e gráficos de Admin > Usuários. Só números agregados.
// Grupos geográficos com menos de 3 pessoas são somados em "outros" (proteção contra identificação).
export async function GET() {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const base = await carregarBase();
  const agora = new Date();
  const r = resumir(base.linhas, {
    hoje: inicioDoDia(0, agora), d7: inicioDoDia(6, agora), d14: inicioDoDia(13, agora),
    d30: inicioDoDia(29, agora), d60: inicioDoDia(59, agora), agora,
  });
  return NextResponse.json({ ...r, disponibilidade: base.disponibilidade, geradoEm: base.geradoEm }, { headers: { 'Cache-Control': 'no-store' } });
}
