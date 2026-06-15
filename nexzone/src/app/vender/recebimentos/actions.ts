'use server';
import { createClient } from '@/lib/supabase/server';
import { calcBalance } from '@/lib/balance';
import { revalidatePath } from 'next/cache';
import { contaStatus } from '@/lib/account';

async function getStore() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('não autenticado');
  const { data: store } = await supabase.from('stores')
    .select('id, pix_key, pix_tipo').eq('owner', user.id).maybeSingle();
  if (!store) throw new Error('sem loja');
  return { supabase, store: store as any };
}

export async function salvarPix(pixKey: string, pixTipo: string) {
  const { supabase, store } = await getStore();
  await supabase.from('stores').update({ pix_key: pixKey, pix_tipo: pixTipo }).eq('id', store.id);
  revalidatePath('/vender/recebimentos');
  return { ok: true };
}

export async function solicitarSaque() {
  const { supabase, store } = await getStore();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const st = await contaStatus(user.id);
    if (st === 'bloqueado') return { ok: false, error: 'Sua conta está bloqueada. Fale com o suporte.' };
    if (st === 'restrito') return { ok: false, error: 'Sua conta está restrita e não pode sacar no momento. Fale com o suporte.' };
  }
  if (!store.pix_key) return { ok: false, error: 'Cadastre sua chave Pix primeiro.' };
  const bal = await calcBalance(supabase, store.id);
  if (bal.disponivel <= 0) return { ok: false, error: 'Você não tem saldo disponível para saque.' };
  await supabase.from('payouts').insert({
    store_id: store.id, valor: bal.disponivel, status: 'solicitado',
    pix_key: store.pix_key, pix_tipo: store.pix_tipo,
  });
  revalidatePath('/vender/recebimentos');
  return { ok: true };
}
