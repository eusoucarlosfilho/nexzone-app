import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { responderOferta, ofertaDoPedido } from '@/lib/posVenda-servidor';

export const dynamic = 'force-dynamic';

// Oferta logo depois da compra. { orderId, aceitar: true | false }
// Aceitar cria o pedido do produto da oferta, com o Pix já gerado, sem o comprador preencher nada de novo.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const r = await responderOferta(createAdminClient(), { orderId, userId: user.id, email: user.email ?? null, aceitar: b.aceitar === true });
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status || 400 });
  return NextResponse.json({ ok: true, novoPedido: r.novoPedido ?? null });
}

// GET ?orderId=… → a oferta que este comprador deve ver agora (ou null)
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ oferta: null }, { status: 401 });
  const orderId = new URL(req.url).searchParams.get('orderId') || '';
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ oferta: null });
  try {
    const oferta = await ofertaDoPedido(createAdminClient(), orderId, user.id);
    return NextResponse.json({ oferta }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ oferta: null }); }
}
