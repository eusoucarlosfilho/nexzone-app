import { NextResponse, type NextRequest } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { createInstance, disconnect, getQrCode, getStatus } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
const SEM_CACHE = { 'Cache-Control': 'no-store' };

// Estado da conexão (+ QR Code quando pedido e ainda não conectado).
export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const status = await getStatus();
  let qr: string | null = null, codigo: string | null = null;
  if (req.nextUrl.searchParams.get('qr') === '1' && (status.estado === 'aguardando_qr' || status.estado === 'desconectado')) {
    const q = await getQrCode();
    if (q.ok) { qr = q.qr; codigo = q.codigoPareamento; }
  }
  return NextResponse.json({ status, qr, codigoPareamento: codigo }, { headers: SEM_CACHE });
}

// conectar | desconectar | reconectar
export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const { acao } = await req.json().catch(() => ({}));
  if (acao === 'desconectar') {
    const r = await disconnect();
    return NextResponse.json(r.ok ? { ok: true } : { error: r.erro }, { status: r.ok ? 200 : 502 });
  }
  if (acao === 'conectar' || acao === 'reconectar') {
    if (acao === 'reconectar') await disconnect();
    const c = await createInstance();
    if (!c.ok) return NextResponse.json({ error: c.erro }, { status: 502 });
    const q = await getQrCode();
    if (!q.ok) return NextResponse.json({ error: q.erro }, { status: 502 });
    return NextResponse.json({ ok: true, qr: q.qr, codigoPareamento: q.codigoPareamento }, { headers: SEM_CACHE });
  }
  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
