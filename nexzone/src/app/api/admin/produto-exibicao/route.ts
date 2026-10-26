import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { lerEstoque, lerContador, lerNota, manuaisDe } from '@/lib/estoque';

// Admin → Produtos → Gerenciar.
//   • números automáticos (pedidos pagos, avaliações de compradores) como referência
//   • modo MANUAL (SQL 08): o admin digita vendas, avaliações e estrelas exibidas; tudo vai para o histórico
//   • ocultar/mostrar a linha de avaliações e vendas na página do produto (SQL 07)
//   • estoque (SQL 07)
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
  const teste08 = await admin.from('products').select('contadores_manuais').eq('id', id).maybeSingle();
  const sql08 = !teste08.error;
  const manual = await manuaisDe(admin, id);
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
    sql08,
    manual,
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

  // Campos aceitos: ocultarContadores, estoque e manual {ativo, vendas, avaliacoes, nota}.
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
  const admin = createAdminClient();

  // Modo manual de vendas / avaliações / estrelas
  let log: { antes: any; depois: any } | null = null;
  if (body.manual && typeof body.manual === 'object') {
    const m = body.manual;
    if (typeof m.ativo !== 'boolean') return NextResponse.json({ error: 'manual.ativo deve ser true ou false' }, { status: 400, headers: SEM_CACHE });
    const antes = await manuaisDe(admin, id);
    const { data: atual } = await admin.from('products').select('vendas, nota').eq('id', id).maybeSingle();
    if (m.ativo) {
      const v = lerContador(m.vendas), av = lerContador(m.avaliacoes), n = lerNota(m.nota);
      for (const r of [v, av, n]) if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400, headers: SEM_CACHE });
      const vendas = (v as any).valor as number | null, avaliacoes = (av as any).valor as number | null, nota = (n as any).valor as number | null;
      if (avaliacoes && avaliacoes > 0 && nota === null) return NextResponse.json({ error: 'Informe as estrelas (1 a 5) junto com o número de avaliações.' }, { status: 400, headers: SEM_CACHE });
      Object.assign(patch, { contadores_manuais: true, vendas_manual: vendas, avaliacoes_manual: avaliacoes, nota_manual: nota });
      log = { antes: { ...antes, vendasExibidas: (atual as any)?.vendas ?? null, notaExibida: (atual as any)?.nota ?? null }, depois: { ativo: true, vendas, avaliacoes, nota } };
    } else {
      // Volta ao automático: recalcula a partir dos pedidos pagos e das avaliações reais
      const [ped, rev] = await Promise.all([
        admin.from('orders').select('id', { count: 'exact', head: true }).eq('product_id', id).in('status', ['pago', 'entregue']),
        admin.from('reviews').select('nota').eq('product_id', id).limit(5000),
      ]);
      const ns = ((rev.data ?? []) as any[]).map((r) => Number(r.nota)).filter((x) => x >= 1 && x <= 5);
      Object.assign(patch, {
        contadores_manuais: false,
        vendas: ped.count ?? (atual as any)?.vendas ?? 0,
        nota: ns.length ? Math.round((ns.reduce((s, x) => s + x, 0) / ns.length) * 10) / 10 : 0,
      });
      log = { antes, depois: { ativo: false, vendas: patch.vendas, nota: patch.nota } };
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada para alterar' }, { status: 400, headers: SEM_CACHE });

  const { error } = await admin.from('products').update(patch).eq('id', id);
  if (error) {
    console.error('[produto-exibicao]', error.message);
    const falta = log ? 'O SQL 08 (contadores manuais) já foi rodado?' : 'O SQL 07 (estoque e contadores) já foi rodado?';
    return NextResponse.json({ error: `Falha ao salvar. ${falta}` }, { status: 500, headers: SEM_CACHE });
  }
  if (log) {
    const { error: e2 } = await admin.from('product_contadores_log').insert({ product_id: id, admin_id: a.userId, antes: log.antes, depois: log.depois });
    if (e2) console.error('[produto-exibicao] histórico', e2.message);
  }
  const dados = await carregar(admin, id);
  return NextResponse.json({ ok: true, ...(dados ?? {}) }, { headers: SEM_CACHE });
}
