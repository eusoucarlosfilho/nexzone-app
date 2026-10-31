import { NextResponse, type NextRequest } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { intervalo, type Preset } from '@/lib/periodo';
import { calcularInteligencia } from '@/lib/inteligencia';
import { carregarInteligencia } from '@/lib/inteligencia-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin › Inteligência Comercial. Só agregados (nenhum dado pessoal sai daqui). Exige adminSeguro (C1).
// GET ?p=hoje|ontem|7d|30d|mes|mes_passado|dia|periodo&dia=AAAA-MM-DD&de=&ate=
const PERMITIDOS: Preset[] = ['hoje', 'ontem', '7d', '30d', 'mes', 'mes_passado', 'dia', 'periodo'];
const MAX_DIAS = 92; // período personalizado: até ~3 meses por consulta (custo de leitura)

export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const sp = req.nextUrl.searchParams;
  const p = (PERMITIDOS as string[]).includes(sp.get('p') || '') ? (sp.get('p') as Preset) : '7d';
  const iv = intervalo(p, { dia: sp.get('dia') || '', de: sp.get('de') || '', ate: sp.get('ate') || '' });
  if (!iv) return NextResponse.json({ error: 'Escolha as datas do período.' }, { status: 400 });
  const fim = Math.min(iv.fim, Date.now() + 86400000);
  const ini = Math.max(iv.ini, fim - MAX_DIAS * 86400000);
  const dados = await carregarInteligencia(ini, fim);
  const r = calcularInteligencia(dados);
  return NextResponse.json({ periodo: p, de: ini, ate: fim, limitado: ini > iv.ini, ...r }, { headers: { 'Cache-Control': 'no-store' } });
}
