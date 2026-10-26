import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { reenviar } from '@/lib/whatsapp/enviar';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const { id } = await req.json().catch(() => ({}));
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 });
  const r = await reenviar(n);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 400 });
}
