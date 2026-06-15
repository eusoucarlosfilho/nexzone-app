import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const ACOES = ['block', 'unblock', 'restrict', 'unrestrict', 'aviso', 'advertencia'] as const;
type Acao = typeof ACOES[number];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const { userId, action, texto } = await req.json();
  if (!userId) return NextResponse.json({ error: 'sem userId' }, { status: 400 });
  if (!ACOES.includes(action as Acao)) return NextResponse.json({ error: 'ação inválida' }, { status: 400 });

  // Proteção: o admin não pode bloquear/restringir a si mesmo
  if (userId === user.id && (action === 'block' || action === 'restrict')) {
    return NextResponse.json({ error: 'Você não pode bloquear ou restringir a si mesmo.' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === 'aviso' || action === 'advertencia') {
    const t = String(texto || '').trim();
    if (!t) return NextResponse.json({ error: 'escreva a mensagem' }, { status: 400 });
    const { error } = await admin.from('user_notices').insert({
      user_id: userId, tipo: action, texto: t.slice(0, 2000), autor_admin: user.id, lida: false,
    });
    if (error) { console.error('[user-action] notice falhou:', error); return NextResponse.json({ error: 'falha ao enviar' }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  }

  // Mudança de status
  const novoStatus =
    action === 'block' ? 'bloqueado' :
    action === 'restrict' ? 'restrito' : 'ativo'; // unblock / unrestrict
  const { error } = await admin.from('profiles').update({ status: novoStatus }).eq('id', userId);
  if (error) { console.error('[user-action] status falhou:', error); return NextResponse.json({ error: 'falha ao atualizar' }, { status: 500 }); }
  return NextResponse.json({ ok: true, status: novoStatus });
}
