'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Liga/desliga o consentimento de promoções do PRÓPRIO usuário (RLS: só a própria linha).
// Só grava email_marketing; o horário do consentimento é registrado pelo banco.
export async function salvarPreferencias(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/conta');

  const quer = formData.get('email_marketing') === 'on';
  const { error } = await supabase.from('profiles').update({ email_marketing: quer }).eq('id', user.id);
  if (error) {
    console.error('[conta] preferências:', error.message);
    redirect('/conta?erro=1');
  }
  revalidatePath('/conta');
  redirect('/conta?salvo=1');
}

// WhatsApp do PRÓPRIO usuário (RLS: só a própria linha): número + avisos + ofertas.
// Número vazio = remove. Número inválido = volta com erro, sem gravar.
import { normalizarTelefone } from '@/lib/whatsapp/telefone';

export async function salvarWhatsapp(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/conta');
  const bruto = String(formData.get('whatsapp') || '').trim();
  const tel = bruto ? normalizarTelefone(bruto) : null;
  const voltar = String(formData.get('voltar') || '/conta');
  const destino = /^\/(conta|pedido\/[0-9a-f-]{36})$/.test(voltar) ? voltar : '/conta';
  if (bruto && !tel) redirect(`${destino}?whats=invalido`);
  const patch: Record<string, unknown> = { whatsapp: tel, whatsapp_atualizado_em: new Date().toISOString() };
  // No convite da página do pedido só vem o número (os consentimentos ficam como estão / padrão ligado)
  if (formData.get('form') === 'conta') {
    patch.whatsapp_avisos = formData.get('whatsapp_avisos') === 'on';
    patch.whatsapp_promocoes = formData.get('whatsapp_promocoes') === 'on';
  }
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) {
    console.error('[conta] whatsapp:', error.message);
    redirect(`${destino}?whats=erro`);
  }
  revalidatePath(destino);
  redirect(`${destino}?whats=ok`);
}

// Localização DECLARADA pelo próprio usuário (opcional): estado e cidade.
// Fica nos metadados da conta (Auth) e, se o SQL V3 de perfil já foi aplicado, também no perfil.
// Nunca usa GPS nem endereço. Enviar os dois vazios apaga a informação.
export async function salvarLocalizacao(formData: FormData) {
  const { ufValida, cidadeValida } = await import('@/lib/brasil');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/conta');

  const uf = ufValida(formData.get('uf'));
  const cidade = uf ? cidadeValida(formData.get('cidade')) : null;
  const dados = uf
    ? { uf, cidade: cidade ?? null, pais: 'BR', loc_fonte: 'declarada' }
    : { uf: null, cidade: null, pais: null, loc_fonte: null };
  const { error } = await supabase.auth.updateUser({ data: dados });
  if (error) {
    console.error('[conta] localização:', error.message);
    redirect('/conta?erro=1');
  }
  // Colunas do perfil (SQL V3 02). Sem elas, o update falha em silêncio e os metadados bastam.
  try {
    await supabase.from('profiles').update({
      uf: dados.uf, cidade: dados.cidade, pais: dados.pais, localizacao_fonte: dados.loc_fonte,
      localizacao_em: uf ? new Date().toISOString() : null,
    }).eq('id', user.id);
  } catch {}
  revalidatePath('/conta');
  redirect('/conta?salvo=1');
}
