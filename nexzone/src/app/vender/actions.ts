'use server';
import { createClient } from '@/lib/supabase/server';
import { lerEstoque } from '@/lib/estoque';
import { arquivoPermitido } from '@/lib/arquivoEntrega';
import { mensagemPadraoDaLoja } from '@/lib/mensagemPadrao';
import { revalidatePath } from 'next/cache';
import { contaStatus } from '@/lib/account';
import { validarImagens } from '@/lib/galeria';
import { CATEGORIA_PADRAO } from '@/lib/categorias';
import { lerTaxas } from '@/lib/settings';
import { tipoValido, planoEfetivo, exigeJogo } from '@/lib/taxas';
import { createAdminClient } from '@/lib/supabase/server';
import { analisarAnuncio } from '@/lib/analiseAnuncio-servidor';

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
    if (!arquivoPermitido(String(formData.get('arquivo_path') || ''), user.id)) return { ok: false, error: 'Arquivo de entrega inválido. Envie o arquivo pelo botão de upload.' };
    const tipoAnuncio = tipoValido(formData.get('tipo_anuncio'));
    const jogo = String(formData.get('jogo') || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
    if (exigeJogo(tipoAnuncio) && !jogo) return { ok: false, error: 'Informe o jogo do anúncio.' };
    const linhaProduto: any = {
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
    };
    // Tipo do anúncio e jogo (SQL 21) vão na mesma gravação; sem as colunas, cria o produto igual a antes
    let { data: criado, error } = await supabase.from('products').insert({ ...linhaProduto, tipo_anuncio: tipoAnuncio, jogo }).select('id').single();
    if (error && /tipo_anuncio|jogo/.test(error.message || '')) ({ data: criado, error } = await supabase.from('products').insert(linhaProduto).select('id').single());
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
    // Plano de visibilidade (SQL 21): só vale com os planos pagos ligados; Topo respeita as vagas da categoria
    let aviso: string | null = null;
    if ((criado as any)?.id) {
      const plano = planoEfetivo(formData.get('plano'), await lerTaxas());
      if (plano !== 'basico') {
        const { error: ePlano } = await supabase.from('products').update({ plano }).eq('id', (criado as any).id);
        if (ePlano && /topo_sem_vaga/.test(ePlano.message || '')) aviso = 'As vagas do plano Topo desta categoria estão ocupadas. O anúncio ficou no plano Básico; você pode trocar depois em Meus produtos.';
      }
    }
    // Análise automática (SQL 35): risco baixo entra no ar na hora; o resto vai para a fila com o motivo marcado
    let status = 'em_revisao';
    if ((criado as any)?.id) {
      try { const an = await analisarAnuncio(createAdminClient(), String((criado as any).id), { origem: 'criacao' }); if (an.status) status = an.status; } catch { /* fica na fila */ }
    }
    revalidatePath('/vender');
    return { ok: true, id: (criado as any)?.id ?? null, aviso, status };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro inesperado ao cadastrar o produto.' };
  }
}
