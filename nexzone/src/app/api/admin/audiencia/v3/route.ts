import { NextResponse, type NextRequest } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { carregarDados } from '@/lib/admin/audiencia-servidor-v3';
import { calcularAudiencia } from '@/lib/admin/audiencia-v3';
import { intervalo, periodoValido } from '@/lib/admin/tempo';
import { funilAtivo } from '@/lib/track-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Audiência V3: indicadores, funil, abandono de cadastro, origem do tráfego. Só agregados. Exige adminSeguro (C1).
export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const sp = req.nextUrl.searchParams;
  const periodo = periodoValido(sp.get('periodo') || '7d');
  const iv = intervalo(periodo, sp.get('de'), sp.get('ate'));
  const dados = await carregarDados(iv.de, iv.ate, iv.anteriorDe);
  const r = calcularAudiencia(dados);
  return NextResponse.json({ periodo, de: iv.de, ate: iv.ate, ...r, funilLigado: await funilAtivo() }, { headers: { 'Cache-Control': 'no-store' } });
}
