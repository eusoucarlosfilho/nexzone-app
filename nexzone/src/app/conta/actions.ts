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
