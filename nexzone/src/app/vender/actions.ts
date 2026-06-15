'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { contaStatus } from '@/lib/account';

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
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'não autenticado' };
    const st = await contaStatus(user.id);
    if (st === 'bloqueado') return { ok: false, error: 'Sua conta está bloqueada. Fale com o suporte.' };
    if (st === 'restrito') return { ok: false, error: 'Sua conta está restrita e não pode cadastrar produtos no momento. Fale com o suporte.' };
    const storeId = await ensureStore();
    const titulo = String(formData.get('titulo') || '').trim();
    const preco = Number(formData.get('preco'));
    if (!titulo) return { ok: false, error: 'Informe o título do produto.' };
    if (!preco || isNaN(preco) || preco <= 0) return { ok: false, error: 'Informe um preço válido (ex: 19.90).' };
    const promoRaw = formData.get('preco_promo');
    const { error } = await supabase.from('products').insert({
      store_id: storeId, titulo, slug: slugify(titulo),
      descricao: String(formData.get('descricao') || ''),
      categoria: String(formData.get('categoria') || 'IA & Ferramentas'),
      preco, preco_promo: promoRaw ? Number(promoRaw) : null,
      tipo_entrega: String(formData.get('tipo_entrega') || 'arquivo'),
      conteudo_entrega: String(formData.get('conteudo_entrega') || ''),
      arquivo_path: String(formData.get('arquivo_path') || '') || null,
      arquivo_nome: String(formData.get('arquivo_nome') || '') || null,
      garantia_dias: Number(formData.get('garantia_dias') || 7),
      emoji: String(formData.get('emoji') || '📦'),
      capa_url: String(formData.get('capa_url') || '') || null,
      status: 'em_revisao',
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/vender');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro inesperado ao cadastrar o produto.' };
  }
}
