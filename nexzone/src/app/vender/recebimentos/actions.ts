'use server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { calcBalance } from '@/lib/balance';
import { revalidatePath } from 'next/cache';
import { contaStatus } from '@/lib/account';
import { avisarSaque } from '@/lib/whatsapp/avisos';
import { podeSacar } from '@/lib/verificacao-servidor';
import { lerTaxas } from '@/lib/settings';
import { taxaDoSaque } from '@/lib/taxas';

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
  // Verificação de identidade (SQL 19): vender é livre; sacar exige identidade aprovada.
  if (user) {
    const v = await podeSacar(createAdminClient(), user.id);
    if (!v.ok) return { ok: false, error: v.erro };
  }
  const bal = await calcBalance(supabase, store.id);
  if (bal.disponivel <= 0) return { ok: false, error: 'Você não tem saldo disponível para saque.' };
  // Gravado pelo servidor: o lojista não cria saque direto pelo banco (SQL 13).
  // O banco aceita só 1 saque em aberto por loja, então dois cliques ao mesmo tempo não sacam em dobro.
  // Um saque grátis por semana (7 dias corridos); os extras pagam a taxa do saque (SQL 21).
  const admin = createAdminClient();
  const seteDias = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: naSemana } = await admin.from('payouts').select('id', { count: 'exact', head: true })
    .eq('store_id', store.id).neq('status', 'recusado').gte('created_at', seteDias);
  const taxa = taxaDoSaque(naSemana ?? 0, await lerTaxas());
  const valor = Math.floor((bal.disponivel - taxa) * 100) / 100;
  if (valor <= 0) return { ok: false, error: `Saldo insuficiente para cobrir a taxa deste saque (${taxa.toFixed(2).replace('.', ',')}). O primeiro saque de cada semana é grátis.` };
  const linhaSaque: any = { store_id: store.id, valor, status: 'solicitado', pix_key: store.pix_key, pix_tipo: store.pix_tipo };
  let { error: eSaque } = await admin.from('payouts').insert(taxa > 0 ? { ...linhaSaque, taxa_saque: taxa } : linhaSaque);
  if (eSaque && /taxa_saque/.test((eSaque as any).message || '')) ({ error: eSaque } = await admin.from('payouts').insert(linhaSaque)); // sem SQL 21
  if (eSaque) {
    if ((eSaque as any).code === '23505') return { ok: false, error: 'Você já tem um saque em análise. Aguarde a conclusão para pedir outro.' };
    if (/verificacao_pendente/.test((eSaque as any).message || '')) return { ok: false, error: 'Para sacar, verifique sua identidade primeiro: menu Verificação.' };
    return { ok: false, error: 'Não foi possível solicitar o saque. Tente de novo.' };
  }
  // WhatsApp de confirmação (se ligado). Só aviso: não muda valor nem regra do saque; nunca lança erro.
  await avisarSaque(null, store.id, 'saque_solicitado', valor);
  revalidatePath('/vender/recebimentos');
  return { ok: true };
}
