import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { autorizarPedido, cancelarPeloVendedor } from '@/lib/conversas-servidor';

export const dynamic = 'force-dynamic';

// Vendedor cancela a venda e devolve ao cliente. POST { orderId, motivo }
// Entra na fila de Reembolsos do admin (que devolve no gateway e confirma); o saldo da venda fica retido até lá.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const motivo = String(b.motivo || '').replace(/[<>]/g, '').trim();
  if (motivo.length < 5) return NextResponse.json({ error: 'Conte em poucas palavras o motivo do cancelamento.' }, { status: 400 });
  const auth = await autorizarPedido(orderId, user.id);
  if ('erro' in auth || auth.papel !== 'vendedor') return NextResponse.json({ error: 'Só o vendedor cancela a venda.' }, { status: 403 });
  const r = await cancelarPeloVendedor(auth.admin, auth.order, motivo);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: r.status || 500 });
}
