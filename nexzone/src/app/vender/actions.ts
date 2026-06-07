'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Garante que o usuário tem loja; cria uma se não tiver.
async function ensureStore() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('não autenticado');
  let { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) {
    const base = (user.email?.split('@')[0] || 'loja');
    const { data: created } = await supabase.from('stores').insert({
      owner: user.id, nome: base, slug: `${slugify(base)}-${user.id.slice(0, 6)}`,
      categoria: 'IA & Ferramentas', status: 'pendente',
    }).select('id').single();
    store = created!;
    await supabase.from('profiles').update({ role: 'vendedor' }).eq('id', user.id);
  }
  return store.id as string;
}

export async function criarProduto(formData: FormData) {
  const supabase = createClient();
  const storeId = await ensureStore();
  const titulo = String(formData.get('titulo') || '').trim();
  const preco = Number(formData.get('preco'));
  if (!titulo || !preco) throw new Error('título e preço são obrigatórios');
  const promoRaw = formData.get('preco_promo');
  await supabase.from('products').insert({
    store_id: storeId, titulo, slug: slugify(titulo),
    descricao: String(formData.get('descricao') || ''),
    categoria: String(formData.get('categoria') || 'IA & Ferramentas'),
    preco, preco_promo: promoRaw ? Number(promoRaw) : null,
    tipo_entrega: String(formData.get('tipo_entrega') || 'arquivo'),
    conteudo_entrega: String(formData.get('conteudo_entrega') || ''),
    garantia_dias: Number(formData.get('garantia_dias') || 7),
    emoji: String(formData.get('emoji') || '📦'),
    status: 'em_revisao',
  });
  revalidatePath('/vender');
}
