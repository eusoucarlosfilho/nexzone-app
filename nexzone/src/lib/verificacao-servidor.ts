// Verificação do produtor (SQL 19) — leitura e regras no SERVIDOR.
import { semSql19 } from './posVenda-servidor';

export type StatusVerificacao = { sql19: boolean; exige: boolean; status: 'nao_enviada' | 'pendente' | 'aprovado' | 'reprovado'; motivo: string | null; tipo: 'pf' | 'pj' | null; nome: string | null; final: string | null; enviadoEm: string | null };

/** O admin pode desligar a exigência (settings.verificacao_saque = false). Padrão: exige. */
export async function exigeVerificacao(admin: any): Promise<boolean> {
  try {
    const { data } = await admin.from('settings').select('value').eq('key', 'verificacao_saque').maybeSingle();
    const v = (data as any)?.value;
    return !(v === false || v === 'false');
  } catch { return true; }
}

export async function statusVerificacao(admin: any, userId: string): Promise<StatusVerificacao> {
  const base: StatusVerificacao = { sql19: true, exige: true, status: 'nao_enviada', motivo: null, tipo: null, nome: null, final: null, enviadoEm: null };
  const { data, error } = await admin.from('verificacoes_vendedor').select('status, motivo, tipo, nome, documento_final, enviado_em').eq('user_id', userId).maybeSingle();
  if (error) return { ...base, sql19: !semSql19(error), exige: false };
  base.exige = await exigeVerificacao(admin);
  if (!data) return base;
  return { ...base, status: (data as any).status, motivo: (data as any).motivo, tipo: (data as any).tipo, nome: (data as any).nome, final: (data as any).documento_final, enviadoEm: (data as any).enviado_em };
}

/** Pode sacar? (admin sempre pode; sem SQL 19 continua como antes) */
export async function podeSacar(admin: any, userId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { data: p } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if ((p as any)?.role === 'admin') return { ok: true };
  const s = await statusVerificacao(admin, userId);
  if (!s.sql19 || !s.exige || s.status === 'aprovado') return { ok: true };
  if (s.status === 'pendente') return { ok: false, erro: 'Sua verificação de identidade está em análise. Assim que for aprovada, o saque é liberado.' };
  if (s.status === 'reprovado') return { ok: false, erro: 'Sua verificação de identidade não foi aprovada. Revise os dados em Verificação e envie de novo.' };
  return { ok: false, erro: 'Para sacar, verifique sua identidade primeiro (leva 2 minutos): menu Verificação.' };
}

/** Caminho de arquivo enviado pelo próprio usuário, na pasta de verificação */
export const caminhoKycValido = (p: unknown, userId: string) => {
  const s = String(p ?? '');
  return s.length <= 400 && s.startsWith(`${userId}/kyc/`) && !s.includes('..') && !s.includes('//');
};
