'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('não autenticado');
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') throw new Error('acesso negado');
  return supabase;
}

export async function aprovarProduto(id: string) {
  const supabase = await assertAdmin();
  await supabase.from('products').update({ status: 'ativo' }).eq('id', id);
  revalidatePath('/admin');
}
export async function reprovarProduto(id: string) {
  const supabase = await assertAdmin();
  await supabase.from('products').update({ status: 'reprovado' }).eq('id', id);
  revalidatePath('/admin');
}
