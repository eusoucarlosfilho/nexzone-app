'use server';
import { createClient } from '@/lib/supabase/server';
import { lerEstoque } from '@/lib/estoque';
import { mensagemPadraoDaLoja } from '@/lib/mensagemPadrao';
import { revalidatePath } from 'next/cache';
import { contaStatus } from '@/lib/account';
import { validarImagens } from '@/lib/galeria';
import { CATEGORIA_PADRAO } from '@/lib/categorias';

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
      categoria: CATEGORIA_PADRAO, status: 'pendente',
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
    // Galeria: até 8 fotos, só do nosso bucket 'capas' (pasta do vendedor). A capa é a 1ª.
    const gal = validarImagens(formData.get('imagens'), user.id);
    if (!gal.ok) return { ok: false, error: gal.error };
    const est = lerEstoque(formData.get('estoque'));
    if (!est.ok) return { ok: false, error: est.erro };
    const { data: criado, error } = await supabase.from('products').insert({
      store_id: storeId, titulo, slug: slugify(titulo),
      descricao: String(formData.get('descricao') || ''),
      categoria: String(formData.get('categoria') || CATEGORIA_PADRAO),
      preco, preco_promo: promoRaw ? Number(promoRaw) : null,
      tipo_entrega: String(formData.get('tipo_entrega') || 'arquivo'),
      conteudo_entrega: String(formData.get('conteudo_entrega') || ''),
      arquivo_path: String(formData.get('arquivo_path') || '') || null,
      arquivo_nome: String(formData.get('arquivo_nome') || '') || null,
      garantia_dias: Number(formData.get('garantia_dias') || 7),
      emoji: String(formData.get('emoji') || '\uD83D\uDCE6'),
      imagens: gal.imagens,
      capa_url: gal.imagens[0] ?? null,
      status: 'em_revisao',
    }).select('id').single();
    if (error) return { ok: false, error: error.message };
    // Estoque em gravação separada: se o SQL 07 ainda não rodou, o produto é criado mesmo assim.
    if (est.valor !== null && (criado as any)?.id) {
      await supabase.from('products').update({ estoque: est.valor }).eq('id', (criado as any).id);
    }
    // Mensagem pós-compra padrão da loja (SQL 10): marca o anúncio e garante o texto padrão atual
    if (formData.get('usa_mensagem_padrao') === '1' && (criado as any)?.id) {
      const padrao = await mensagemPadraoDaLoja(supabase, user.id);
      await supabase.from('products').update(padrao ? { usa_mensagem_padrao: true, conteudo_entrega: padrao } : { usa_mensagem_padrao: true }).eq('id', (criado as any).id);
    }
    revalidatePath('/vender');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro inesperado ao cadastrar o produto.' };
  }
}
