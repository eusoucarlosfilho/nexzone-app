import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function ownsProduct(supabase: any, userId: string, productId: string) {
  const { data } = await supabase
    .from('products')
    .select('id, stores!inner(owner)')
    .eq('id', productId).single();
  return data && (data as any).stores?.owner === userId;
}

// Editar produto
export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id || !(await ownsProduct(supabase, user.id, id))) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const action = body.action;
  let patch: any = {};
  if (action === 'pausar') patch = { status: 'pausado' };
  else if (action === 'reativar') patch = { status: 'em_revisao' }; // reativar passa por revisão
  else {
    // edição de campos: volta para revisão
    const preco = Number(body.preco);
    if (!body.titulo || !preco || preco <= 0) return NextResponse.json({ error: 'título e preço válidos são obrigatórios' }, { status: 400 });
    patch = {
      titulo: String(body.titulo).trim(),
      descricao: String(body.descricao || ''),
      categoria: String(body.categoria || ''),
      preco,
      preco_promo: body.preco_promo ? Number(body.preco_promo) : null,
      tipo_entrega: String(body.tipo_entrega || 'arquivo'),
      conteudo_entrega: String(body.conteudo_entrega || ''),
      garantia_dias: Number(body.garantia_dias || 7),
      emoji: String(body.emoji || '📦'),
      status: 'em_revisao',
    };
  }

  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: 'falha ao salvar' }, { status: 500 });
  return NextResponse.json({ ok: true, status: patch.status });
}

// Excluir produto
export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { id } = await req.json();
  if (!id || !(await ownsProduct(supabase, user.id, id))) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'falha ao excluir' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
