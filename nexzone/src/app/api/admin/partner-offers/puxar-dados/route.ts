import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { puxarDados } from '@/lib/ofertas/puxarDados';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // precisa de DNS para a proteção contra endereços internos

// Pré-preenche o cadastro a partir das metatags públicas do link. Só administrador autorizado (C1).
export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url.slice(0, 2048) : '';
  if (!url) return NextResponse.json({ error: 'Cole o link do produto.' }, { status: 400 });
  const r = await puxarDados(url);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ dados: r.dados }, { headers: { 'Cache-Control': 'no-store' } });
}
