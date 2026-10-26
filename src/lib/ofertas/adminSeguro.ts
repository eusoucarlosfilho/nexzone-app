// Autorização das operações administrativas de OFERTAS PARCEIRAS.
//
// Por que não basta profiles.role = 'admin': a vulnerabilidade C1 (papel do perfil alterável pelo
// próprio usuário) ainda está aberta. Então estas rotas exigem TAMBÉM que o id do usuário esteja na
// variável de ambiente ADMIN_USER_IDS (lista de UUIDs separados por vírgula), definida só no servidor.
// O id vem da sessão do Supabase Auth e não pode ser forjado pelo usuário.
//
// Sem a variável configurada, as operações ficam BLOQUEADAS (falha fechada).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idsAdminConfigurados(): string[] {
  return (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => UUID.test(s));
}

export type Autorizacao =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; codigo: 'nao_autenticado' | 'nao_admin' | 'admin_bloqueado_c1'; mensagem: string };

export async function adminSeguro(): Promise<Autorizacao> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, codigo: 'nao_autenticado', mensagem: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if ((profile as any)?.role !== 'admin') return { ok: false, status: 403, codigo: 'nao_admin', mensagem: 'Acesso restrito a administradores.' };
  const lista = idsAdminConfigurados();
  if (!lista.length || !lista.includes(user.id.toLowerCase())) {
    return {
      ok: false, status: 403, codigo: 'admin_bloqueado_c1',
      mensagem: 'Operação bloqueada por segurança: falta a correção da C1 ou a lista ADMIN_USER_IDS no servidor.',
    };
  }
  return { ok: true, userId: user.id };
}

/** Resposta padrão para operação negada. */
export function negado(a: Exclude<Autorizacao, { ok: true }>) {
  return NextResponse.json({ error: a.mensagem, codigo: a.codigo }, { status: a.status, headers: { 'Cache-Control': 'no-store' } });
}
