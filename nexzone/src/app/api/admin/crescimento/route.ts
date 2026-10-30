import { NextResponse, type NextRequest } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { carregarDados, publicacoesDesde } from '@/lib/admin/audiencia-servidor-v3';
import { calcularCrescimento } from '@/lib/admin/audiencia-v3';
import { intervalo, periodoValido } from '@/lib/admin/tempo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Visão consolidada de crescimento. Nenhuma métrica financeira (K2). Exige adminSeguro (C1).
export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const sp = req.nextUrl.searchParams;
  const periodo = periodoValido(sp.get('periodo') || '30d');
  const iv = intervalo(periodo, sp.get('de'), sp.get('ate'));
  const [dados, pubs] = await Promise.all([carregarDados(iv.de, iv.ate, iv.anteriorDe), publicacoesDesde(iv.anteriorDe)]);
  return NextResponse.json({ periodo, de: iv.de, ate: iv.ate, ...calcularCrescimento(dados, pubs) }, { headers: { 'Cache-Control': 'no-store' } });
}
