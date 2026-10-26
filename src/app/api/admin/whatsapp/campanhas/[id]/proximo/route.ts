import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { proximo } from '@/lib/whatsapp/campanhas';

export const dynamic = 'force-dynamic';

// Envia UMA mensagem da campanha (a tela do admin chama em intervalos aleatórios).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Campanha inválida.' }, { status: 400 });
  return NextResponse.json(await proximo(id), { headers: { 'Cache-Control': 'no-store' } });
}
