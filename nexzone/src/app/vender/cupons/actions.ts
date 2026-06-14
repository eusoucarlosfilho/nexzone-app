'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function criarCupom(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'não autenticado' };
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return { ok: false, error: 'você ainda não tem loja' };

  const codigo = String(formData.get('codigo') || '').trim().toUpperCase();
  const tipo = String(formData.get('tipo') || 'percent');
  const valor = Number(formData.get('valor'));
  const escopo = String(formData.get('product_id') || '');
  const maxUsos = formData.get('max_usos') ? Number(formData.get('max_usos')) : null;
  const expira = formData.get('expira_em') ? String(formData.get('expira_em')) : null;

  if (!codigo) return { ok: false, error: 'Informe o código do cupom.' };
  if (!valor || valor <= 0) return { ok: false, error: 'Informe um valor válido.' };
  if (tipo === 'percent' && valor > 90) return { ok: false, error: 'Percentual máximo de 90%.' };

  const { error } = await supabase.from('coupons').insert({
    store_id: store.id, codigo, tipo, valor,
    product_id: escopo || null, max_usos: maxUsos, expira_em: expira ? new Date(expira).toISOString() : null, ativo: true,
  });
  if (error) return { ok: false, error: error.message.includes('duplicate') ? 'Já existe um cupom com esse código.' : error.message };
  revalidatePath('/vender/cupons');
  return { ok: true };
}

export async function toggleCupom(id: string, ativo: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await supabase.from('coupons').update({ ativo }).eq('id', id);
  revalidatePath('/vender/cupons');
  return { ok: true };
}
