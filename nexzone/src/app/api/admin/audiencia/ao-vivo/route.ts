import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { categoriasDe, sessoesDesde } from '@/lib/admin/audiencia-servidor-v3';
import { calcularAoVivo } from '@/lib/admin/audiencia-v3';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Painel ao vivo: contagens agregadas das sessões com sinal nos últimos 5 minutos.
// Não devolve sessões, caminhos individuais nem localização de ninguém.
export async function GET() {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const desde = new Date(Date.now() - 6 * 3600e3); // sessões abertas nas últimas 6 h podem ainda estar ativas
  const s = await sessoesDesde(desde, 20000);
  const ativos = s.linhas.filter((x) => new Date(x.last_seen).getTime() > Date.now() - 5 * 60e3);
  const cats = await categoriasDe(ativos.map((x) => x.current_path || x.landing_path || ''));
  return NextResponse.json({ ...calcularAoVivo(s.linhas, cats), agora: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
