import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { enviarPara } from '@/lib/push-servidor';

export const dynamic = 'force-dynamic';

// Manda uma notificação de teste para os aparelhos de quem está logado.
export async function POST() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const admin = createAdminClient();
  const { data: subs, error } = await admin.from('push_inscricoes').select('id, endpoint, p256dh, auth').eq('user_id', user.id).limit(10);
  if (error) return NextResponse.json({ error: 'Notificação no celular ainda não está ativa (falta o SQL 22).' }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ error: 'Nenhum aparelho ativado ainda.' }, { status: 400 });
  try {
    const r = await enviarPara(admin, subs as any, { titulo: '🎮 Notificações ligadas!', texto: 'É assim que vão chegar suas vendas, mensagens e avisos do Comprei Barato.', url: '/notificacoes', tag: 'teste' });
    return NextResponse.json({ ok: true, ...r });
  } catch {
    return NextResponse.json({ error: 'Não foi possível enviar o teste.' }, { status: 500 });
  }
}
