'use server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { awardPoints, getSettingNum } from '@/lib/points';

export async function enviarAvaliacao(orderId: string, nota: number, comentario: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'não autenticado' };
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return { ok: false, error: 'nota inválida' };

  const { data: order } = await supabase.from('orders')
    .select('id, product_id, status').eq('id', orderId).eq('comprador', user.id).single();
  if (!order || !(order.status === 'pago' || order.status === 'entregue')) {
    return { ok: false, error: 'compra não encontrada' };
  }

  const { data: existing } = await supabase.from('reviews').select('id').eq('order_id', orderId).maybeSingle();
  if (existing) return { ok: false, error: 'Você já avaliou esta compra.' };

  const { error } = await supabase.from('reviews').insert({
    order_id: orderId, product_id: order.product_id, comprador: user.id,
    nota, comentario: (comentario || '').slice(0, 1000) || null,
  });
  if (error) return { ok: false, error: 'falha ao enviar avaliação' };

  // Recalcula a nota média do produto (via admin: comprador não edita products)
  const admin = createAdminClient();
  const { data: all } = await admin.from('reviews').select('nota').eq('product_id', order.product_id);
  const arr = all ?? [];
  const media = arr.length ? arr.reduce((s: number, r: any) => s + r.nota, 0) / arr.length : nota;
  await admin.from('products').update({ nota: Math.round(media * 10) / 10 }).eq('id', order.product_id);

  // Bônus de CB Points por avaliar
  const bonus = await getSettingNum(admin, 'cb_points_review_bonus', 3);
  if (bonus > 0) await awardPoints(admin, user.id, bonus, 'Avaliação enviada', orderId);

  revalidatePath(`/pedido/${orderId}`);
  return { ok: true };
}
