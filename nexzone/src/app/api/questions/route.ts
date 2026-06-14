import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get('productId');
  if (!productId) return NextResponse.json({ questions: [] });
  const admin = createAdminClient();
  const { data } = await admin.from('product_questions')
    .select('id, autor, autor_nome, pergunta, resposta, respondida_em, created_at')
    .eq('product_id', productId).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ questions: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { productId, pergunta } = await req.json();
  const texto = String(pergunta || '').trim();
  if (texto.length < 5) return NextResponse.json({ error: 'Escreva uma pergunta com pelo menos 5 caracteres.' }, { status: 400 });
  if (texto.length > 500) return NextResponse.json({ error: 'Pergunta muito longa (máx. 500 caracteres).' }, { status: 400 });

  const admin = createAdminClient();
  const { data: product } = await admin.from('products').select('id, store_id, status').eq('id', productId).maybeSingle();
  if (!product || product.status !== 'ativo') return NextResponse.json({ error: 'produto indisponível' }, { status: 404 });

  const { data: me } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle();
  const { error } = await admin.from('product_questions').insert({
    product_id: product.id, store_id: product.store_id, autor: user.id,
    autor_nome: (me as any)?.nome ?? 'Cliente', pergunta: texto,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
