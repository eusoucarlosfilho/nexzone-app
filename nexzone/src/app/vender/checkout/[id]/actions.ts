'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validarCheckout, validarListaBumps, urlDoArmazenamento, UUID, type BumpItem } from '@/lib/checkoutConfig';

// Salva o construtor do checkout. Aparência/conteúdo + quais produtos são order bumps (até 4) e seus preços.
// config = null → volta ao checkout padrão.
// bumps: lista na ordem do checkout. undefined = não mexe nos bumps; [] = sem order bump.
export async function salvarCheckoutConfig(productId: string, config: any, bumps?: BumpItem[] | null, aceitaCupom?: boolean) {
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

  if (bumps !== undefined) {
    const vb = validarListaBumps(bumps ?? [], productId);
    if (!vb.ok) return { ok: false, error: vb.erro };
    const lista = vb.lista;
    if (lista.length) {
      // Todos os produtos dos bumps precisam ser DESTA loja (nunca de outra loja)
      const { data: daLoja } = await supabase.from('products').select('id')
        .in('id', lista.map((b) => b.product_id)).eq('store_id', store.id);
      const ids = new Set(((daLoja ?? []) as { id: string }[]).map((p) => String(p.id).toLowerCase()));
      if (lista.some((b) => !ids.has(b.product_id))) return { ok: false, error: 'O order bump precisa ser um produto da sua loja.' };
    }
    upd.bumps = lista;
    // Campos antigos espelham o 1º bump (compatibilidade com pedidos e telas antigas)
    upd.bump_product_id = lista[0]?.product_id ?? null;
    upd.bump_valor = lista[0]?.valor ?? null;
    // Textos só dos bumps que continuam na lista
    if (limpo) limpo.bumps = (limpo.bumps as any[]).filter((v) => lista.some((b) => b.product_id === v.product_id));
  }

  const { error } = await supabase.from('products').update(upd)
    .eq('id', productId).eq('store_id', store.id);
  if (error) return { ok: false, error: 'Não foi possível salvar. Tente de novo.' };
  revalidatePath(`/checkout/${productId}`);
  return { ok: true };
}
