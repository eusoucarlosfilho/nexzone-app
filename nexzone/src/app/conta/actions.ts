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
