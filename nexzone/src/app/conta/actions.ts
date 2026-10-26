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
