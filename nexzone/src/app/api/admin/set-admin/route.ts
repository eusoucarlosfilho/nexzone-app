import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const { email, action } = await req.json();
  const alvoEmail = String(email || '').trim().toLowerCase();
  if (!alvoEmail) return NextResponse.json({ error: 'Informe o e-mail.' }, { status: 400 });
  if (action !== 'promote' && action !== 'demote') {
    return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Acha o usuário pelo e-mail (no Auth)
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alvo = (list?.users ?? []).find((u: any) => (u.email || '').toLowerCase() === alvoEmail);
  if (!alvo) {
    return NextResponse.json(
      { error: 'Esse e-mail ainda não tem conta no site. Peça para a pessoa criar a conta primeiro e depois adicione aqui.' },
      { status: 404 }
    );
  }

  if (action === 'demote' && alvo.id === user.id) {
    return NextResponse.json({ error: 'Você não pode remover a si mesmo como administrador.' }, { status: 400 });
  }

  const novoRole = action === 'promote' ? 'admin' : 'ambos';
  const { error } = await admin.from('profiles').update({ role: novoRole }).eq('id', alvo.id);
  if (error) {
    console.error('[set-admin] update falhou:', error);
    return NextResponse.json({ error: 'falha ao atualizar o usuário' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
