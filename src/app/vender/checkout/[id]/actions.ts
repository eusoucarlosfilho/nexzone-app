'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validarCheckout, urlDoArmazenamento } from '@/lib/checkoutConfig';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Salva o construtor do checkout (Fase 1). Só aparência/conteúdo + qual produto é o order bump e seu preço.
// config = null → volta ao checkout padrão.
export async function salvarCheckoutConfig(productId: string, config: any, bump?: { bump_product_id: string | null; bump_valor: number | null }, aceitaCupom?: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'não autenticado' };
  if (!UUID.test(String(productId))) return { ok: false, error: 'produto inválido' };
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return { ok: false, error: 'sem loja' };

  let limpo: any = null;
  if (config) {
    const v = validarCheckout(config, urlDoArmazenamento(process.env.NEXT_PUBLIC_SUPABASE_URL));
    if (!v.ok) return { ok: false, error: v.erro };
    limpo = v.config;
  }
  const upd: any = { checkout_config: limpo, aceita_cupom: !!aceitaCupom };

  if (bump) {
    const bid = bump.bump_product_id || null;
    if (bid) {
      // O produto do bump precisa ser DESTA loja e diferente do principal
      if (!UUID.test(bid) || bid === productId) return { ok: false, error: 'Produto do order bump inválido.' };
      const { data: bp } = await supabase.from('products').select('id, store_id').eq('id', bid).maybeSingle();
      if (!bp || (bp as any).store_id !== store.id) return { ok: false, error: 'O order bump precisa ser um produto da sua loja.' };
      const valor = Math.round(Number(bump.bump_valor) * 100) / 100;
      if (!Number.isFinite(valor) || valor < 1 || valor > 100000) return { ok: false, error: 'Preço do order bump: use um valor a partir de R$ 1,00.' };
      upd.bump_product_id = bid;
      upd.bump_valor = valor;
    } else {
      upd.bump_product_id = null;
      upd.bump_valor = null;
    }
  }

  const { error } = await supabase.from('products').update(upd)
    .eq('id', productId).eq('store_id', store.id);
  if (error) return { ok: false, error: 'Não foi possível salvar. Tente de novo.' };
  revalidatePath(`/checkout/${productId}`);
  return { ok: true };
}
