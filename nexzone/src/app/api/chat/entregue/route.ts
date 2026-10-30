import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { autorizarPedido, marcarEntregue } from '@/lib/conversas-servidor';

export const dynamic = 'force-dynamic';

// Vendedor (ou admin) marca o pedido como entregue. POST { orderId }
// Não mexe no status do pagamento, na data entregue_em nem no saldo: só registra a confirmação da entrega.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const auth = await autorizarPedido(orderId, user.id);
  if ('erro' in auth || auth.papel === 'comprador') return NextResponse.json({ error: 'Só o vendedor marca a entrega.' }, { status: 403 });
  const r = await marcarEntregue(auth.admin, auth.order, auth.papel === 'admin' ? 'admin' : 'vendedor');
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status || 500 });
  return NextResponse.json({ ok: true, ja: !!r.ja });
}
