import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { questionId, resposta } = await req.json();
  const texto = String(resposta || '').trim();
  if (texto.length < 1) return NextResponse.json({ error: 'Escreva uma resposta.' }, { status: 400 });
  if (texto.length > 1000) return NextResponse.json({ error: 'Resposta muito longa (máx. 1000 caracteres).' }, { status: 400 });

  const admin = createAdminClient();
  const { data: q } = await admin.from('product_questions')
    .select('id, store_id, stores(owner)').eq('id', questionId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'pergunta não encontrada' }, { status: 404 });
  if ((q as any).stores?.owner !== user.id) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });

  const { error } = await admin.from('product_questions')
    .update({ resposta: texto, respondida_em: new Date().toISOString() }).eq('id', questionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
