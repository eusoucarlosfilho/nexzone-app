'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function salvarLoja(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('não autenticado');
  await supabase.from('stores').update({
    nome: String(formData.get('nome') || '').trim(),
    descricao: String(formData.get('descricao') || ''),
    categoria: String(formData.get('categoria') || ''),
    logo_url: String(formData.get('logo_url') || '') || null,
    banner_url: String(formData.get('banner_url') || '') || null,
    cor: String(formData.get('cor') || '') || null,
  }).eq('owner', user.id);
  revalidatePath('/vender/loja');
}
