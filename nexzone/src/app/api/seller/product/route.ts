import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validarImagens, galeriaDe } from '@/lib/galeria';

async function ownsProduct(supabase: any, userId: string, productId: string) {
  const { data } = await supabase
    .from('products')
    .select('id, stores!inner(owner)')
    .eq('id', productId).single();
  return data && (data as any).stores?.owner === userId;
}

// Dados de EDIÇÃO de um produto (inclui conteúdo de entrega e arquivo).
// Carregados só quando o vendedor abre a edição, e só depois de confirmar que o produto é dele —
// a lista de Meus produtos não recebe esses campos.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUNAS_EDICAO =
  'id, titulo, descricao, categoria, preco, preco_promo, tipo_entrega, conteudo_entrega, garantia_dias, status, emoji, capa_url, imagens, arquivo_path, arquivo_nome, destaque_ate, vendas, nota, created_at';

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'produto inválido' }, { status: 400 });
  if (!(await ownsProduct(supabase, user.id, id))) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const { data, error } = await supabase.from('products').select(COLUNAS_EDICAO).eq('id', id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'produto não encontrado' }, { status: 404 });
  return NextResponse.json({ produto: data }, { headers: { 'Cache-Control': 'no-store' } });
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
    // Galeria: até 8 fotos do nosso bucket. Fotos que o produto já tinha (ex.: capa antiga) continuam aceitas.
    const { data: atual } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    const gal = validarImagens(body.imagens, user.id, galeriaDe(atual as any));
    if (!gal.ok) return NextResponse.json({ error: gal.error }, { status: 400 });
    patch = {
      titulo: String(body.titulo).trim(),
      descricao: String(body.descricao || ''),
      categoria: String(body.categoria || ''),
      preco,
      preco_promo: body.preco_promo ? Number(body.preco_promo) : null,
      tipo_entrega: String(body.tipo_entrega || 'arquivo'),
      conteudo_entrega: String(body.conteudo_entrega || ''),
      garantia_dias: Number(body.garantia_dias || 7),
      emoji: String(body.emoji || '\uD83D\uDCE6'),
      arquivo_path: body.arquivo_path ? String(body.arquivo_path) : null,
      arquivo_nome: body.arquivo_nome ? String(body.arquivo_nome) : null,
      imagens: gal.imagens,
      capa_url: gal.imagens[0] ?? null,
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
  // .select('id') devolve as linhas realmente apagadas: sem linha, a exclusão não aconteceu
  // (ex.: o banco não permite apagar este produto, ou ele tem pedidos vinculados).
  const { data: apagados, error } = await supabase.from('products').delete().eq('id', id).select('id');
  if (error) {
    return NextResponse.json({
      error: 'Não foi possível excluir este produto. Produtos com pedidos não podem ser excluídos — você pode pausar o anúncio.',
      codigo: 'exclusao_recusada',
    }, { status: 409 });
  }
  if (!apagados || apagados.length === 0) {
    return NextResponse.json({
      error: 'O produto não foi excluído. Se ele tem pedidos ou a exclusão não está liberada, pause o anúncio.',
      codigo: 'nada_excluido',
    }, { status: 409 });
  }
  return NextResponse.json({ ok: true, excluidos: apagados.length });
}
