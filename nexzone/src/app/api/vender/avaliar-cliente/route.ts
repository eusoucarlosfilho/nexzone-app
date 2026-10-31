import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { autorizarPedido } from '@/lib/conversas-servidor';
import { awardPoints, getSettingNum } from '@/lib/points';

export const dynamic = 'force-dynamic';

// Vendedor avalia o cliente de uma venda. POST { orderId, nota (1-5), comentario? }
// Uma avaliação por venda. Ganha CB Points (mesmo bônus da avaliação do comprador) quando o programa está ligado.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const nota = Math.round(Number(b.nota));
  if (!(nota >= 1 && nota <= 5)) return NextResponse.json({ error: 'Escolha de 1 a 5 estrelas.' }, { status: 400 });
  const comentario = String(b.comentario ?? '').replace(/[<>]/g, '').trim().slice(0, 500) || null;

  const auth = await autorizarPedido(orderId, user.id);
  if ('erro' in auth || auth.papel !== 'vendedor') return NextResponse.json({ error: 'Só o vendedor desta venda avalia o cliente.' }, { status: 403 });
  const o: any = auth.order;
  if (!['pago', 'entregue'].includes(String(o.status))) return NextResponse.json({ error: 'Só dá para avaliar o cliente de uma venda paga.' }, { status: 409 });

  const { error } = await auth.admin.from('avaliacoes_cliente').insert({ order_id: o.id, store_id: o.store_id, comprador: o.comprador, avaliador: user.id, nota, comentario });
  if (error) {
    if (/avaliacoes_cliente|42P01|does not exist/i.test(`${error.code} ${error.message}`)) return NextResponse.json({ error: 'Falta rodar o SQL 32 para avaliar clientes.' }, { status: 503 });
    if (/duplicate|unique/i.test(error.message || '')) return NextResponse.json({ error: 'Você já avaliou este cliente nesta venda.' }, { status: 409 });
    return NextResponse.json({ error: 'Não foi possível salvar agora.' }, { status: 500 });
  }
  let pontos = 0;
  try {
    const { data: liga } = await auth.admin.from('settings').select('value').eq('key', 'cb_points_ativo').maybeSingle();
    const ativo = (liga as any)?.value === true || (liga as any)?.value === 'true';
    pontos = ativo ? await getSettingNum(auth.admin, 'cb_points_review_bonus', 3) : 0;
    if (pontos > 0) await awardPoints(auth.admin, user.id, pontos, 'Avaliou o cliente', o.id);
  } catch { pontos = 0; }
  return NextResponse.json({ ok: true, pontos });
}
