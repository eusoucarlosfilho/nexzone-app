'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function salvarCheckoutConfig(productId: string, config: any, bump?: { bump_product_id: string | null; bump_valor: number | null }, aceitaCupom?: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'não autenticado' };
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return { ok: false, error: 'sem loja' };

  const clean = config && Object.values(config).some((v) => v) ? config : null;
  const upd: any = { checkout_config: clean, aceita_cupom: !!aceitaCupom };
  if (bump) {
    upd.bump_product_id = bump.bump_product_id || null;
    upd.bump_valor = bump.bump_product_id && bump.bump_valor ? bump.bump_valor : null;
  }
  const { error } = await supabase.from('products').update(upd)
    .eq('id', productId).eq('store_id', store.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/checkout/${productId}`);
  return { ok: true };
}
