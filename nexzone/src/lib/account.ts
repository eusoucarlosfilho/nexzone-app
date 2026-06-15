import { createAdminClient } from './supabase/server';

export type AccountStatus = 'ativo' | 'restrito' | 'bloqueado';

// Lê o status da conta de um usuário. Em qualquer erro, devolve 'ativo'
// (nunca bloqueia alguém por causa de uma falha de leitura).
export async function contaStatus(userId: string): Promise<AccountStatus> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('profiles').select('status').eq('id', userId).maybeSingle();
    const s = (data as any)?.status;
    return s === 'bloqueado' || s === 'restrito' ? s : 'ativo';
  } catch {
    return 'ativo';
  }
}
