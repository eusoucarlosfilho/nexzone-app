import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { lerEstoque } from '@/lib/estoque';

// Admin → Produtos → Gerenciar.
// Mostra os números REAIS (vendas, avaliações, nota) e permite:
//   • ocultar/mostrar a linha de avaliações e vendas na página do produto (ocultar_contadores)
//   • ajustar o estoque
// Não existe gravação de vendas, avaliações ou nota: esses números vêm só de pedidos e avaliações reais.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CACHE = { 'Cache-Control': 'no-store' };

async function carregar(admin: any, id: string) {
  const { data: prod } = await admin.from('products')
    .select('id, titulo, status, vendas, nota, store_id, stores(id, nome, ocultar_vendedor)').eq('id', id).maybeSingle();
  if (!prod) return null;
  const [rev, ped, ext] = await Promise.all([
    admin.from('reviews').select('nota').eq('product_id', id).limit(5000),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('product_id', id).in('status', ['pago', 'entregue']),
    admin.from('products').select('estoque, pausado_sem_estoque, ocultar_contadores').eq('id', id).maybeSingle(),
  ]);
  const notas = ((rev.data ?? []) as any[]).map((r) => Number(r.nota)).filter((v) => v >= 1 && v <= 5);
  const sql07 = !ext.error;
  return {
    id: prod.id,
    titulo: prod.titulo,
    status: prod.status,
    vendas: Number(prod.vendas) || 0,                // contador exibido no site
    pedidosPagos: ped.count ?? null,                 // conferência: pedidos pagos/entregues no banco
    avaliacoes: notas.length,
    media: notas.length ? Math.round((notas.reduce((s, v) => s + v, 0) / notas.length) * 10) / 10 : 0,
    sql07,
    estoque: sql07 ? ((ext.data as any)?.estoque ?? null) : null,
    pausadoSemEstoque: sql07 ? (ext.data as any)?.pausado_sem_estoque === true : false,
    ocultarContadores: sql07 ? (ext.data as any)?.ocultar_contadores === true : false,
    loja: prod.stores ? { id: prod.stores.id, nome: prod.stores.nome, ocultarVendedor: prod.stores.ocultar_vendedor === true } : null,
  };
}

export async function GET(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'produto inválido' }, { status: 400, headers: SEM_CACHE });
  const dados = await carregar(createAdminClient(), id);
  if (!dados) return NextResponse.json({ error: 'produto não encontrado' }, { status: 404, headers: SEM_CACHE });
  return NextResponse.json(dados, { headers: SEM_CACHE });
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'produto inválido' }, { status: 400, headers: SEM_CACHE });

  // Só estes dois campos são aceitos. Qualquer outro (vendas, nota, avaliações) é ignorado.
  const patch: Record<string, unknown> = {};
  if ('ocultarContadores' in body) {
    if (typeof body.ocultarContadores !== 'boolean') return NextResponse.json({ error: 'ocultarContadores deve ser true ou false' }, { status: 400, headers: SEM_CACHE });
    patch.ocultar_contadores = body.ocultarContadores;
  }
  if ('estoque' in body) {
    const lido = lerEstoque(body.estoque);
    if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400, headers: SEM_CACHE });
    patch.estoque = lido.valor;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada para alterar' }, { status: 400, headers: SEM_CACHE });

  const admin = createAdminClient();
  const { error } = await admin.from('products').update(patch).eq('id', id);
  if (error) {
    console.error('[produto-exibicao]', error.message);
    return NextResponse.json({ error: 'Falha ao salvar. O SQL 07 (estoque e contadores) já foi rodado?' }, { status: 500, headers: SEM_CACHE });
  }
  const dados = await carregar(admin, id);
  return NextResponse.json({ ok: true, ...(dados ?? {}) }, { headers: SEM_CACHE });
}
