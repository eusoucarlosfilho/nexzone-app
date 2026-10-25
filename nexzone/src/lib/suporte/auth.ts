// Central de Suporte — quem está logado (servidor).
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function usuarioAtual() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
  } catch { return null; }
}

/** Para rotas /api/admin/suporte: devolve o admin logado ou uma resposta 401/403. */
export async function exigirAdmin(): Promise<{ user: { id: string; email?: string | null }; admin: ReturnType<typeof createAdminClient> } | NextResponse> {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  return { user, admin };
}
