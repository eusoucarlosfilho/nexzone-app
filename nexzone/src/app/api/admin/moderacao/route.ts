import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { validarModeracao } from '@/lib/moderacao';
import { aplicarModeracao } from '@/lib/moderacao-servidor';

// Admin → Produtos → Gerenciar → Moderação.
// GET  ?id=  detalhes do anúncio: links, entrega, pedidos, reclamações e histórico
// POST {id, acao, itens, texto}  correção / pausar (travado) / cancelar / reativar
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'produto inválido' }, { status: 400, headers: SEM_CACHE });
  const admin = createAdminClient();

  const { data: p } = await admin.from('products')
    .select('id, titulo, status, preco, preco_promo, categoria, tipo_entrega, conteudo_entrega, arquivo_nome, created_at, store_id, stores(id, nome, slug, owner, status)')
    .eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ error: 'produto não encontrado' }, { status: 404, headers: SEM_CACHE });

  const [mod, hist, eds, peds, recl] = await Promise.all([
    admin.from('products').select('moderacao, moderacao_itens, moderacao_texto, moderacao_em').eq('id', id).maybeSingle(),
    admin.from('product_moderacao').select('acao, itens, texto, status_antes, status_depois, admin_id, created_at').eq('product_id', id).order('created_at', { ascending: false }).limit(30),
    admin.from('product_edicoes').select('tipo, alteracoes, autor, created_at, decisao').eq('product_id', id).order('created_at', { ascending: false }).limit(30),
    admin.from('orders').select('id, status, total, created_at').eq('product_id', id).order('created_at', { ascending: false }).limit(200),
    admin.from('complaints').select('id, status, texto, created_at, orders!inner(product_id)').eq('orders.product_id', id).order('created_at', { ascending: false }).limit(20),
  ]);

  const pedidos = ((peds.data ?? []) as any[]);
  const conta = (st: string[]) => pedidos.filter((o) => st.includes(o.status)).length;
  const somaPagos = pedidos.filter((o) => ['pago', 'entregue'].includes(o.status)).reduce((s, o) => s + Number(o.total || 0), 0);

  // Histórico unificado (moderação + alterações do anúncio)
  const historico = [
    ...((hist.data ?? []) as any[]).map((h) => ({ tipo: 'moderacao', acao: h.acao, itens: h.itens ?? [], texto: h.texto, quem: h.admin_id ? 'Equipe' : 'Sistema', em: h.created_at })),
    ...((eds.data ?? []) as any[]).map((e) => ({
      tipo: 'edicao', acao: e.tipo === 'reativacao' ? 'reenviou' : 'editou',
      campos: Object.keys(e.alteracoes || {}), quem: e.autor && e.autor === (p as any).stores?.owner ? 'Vendedor' : e.autor ? 'Equipe' : 'Sistema', em: e.created_at, decisao: e.decisao,
    })),
  ].sort((x, y) => String(y.em).localeCompare(String(x.em))).slice(0, 40);

  return NextResponse.json({
    produto: {
      id: p.id, titulo: p.titulo, status: p.status, preco: Number((p as any).preco_promo ?? p.preco), categoria: p.categoria,
      tipo_entrega: p.tipo_entrega, conteudo_entrega: (p as any).conteudo_entrega ?? '', arquivo_nome: (p as any).arquivo_nome ?? null, created_at: p.created_at,
    },
    loja: (p as any).stores ? { id: (p as any).stores.id, nome: (p as any).stores.nome, slug: (p as any).stores.slug, owner: (p as any).stores.owner, status: (p as any).stores.status } : null,
    sql14: !mod.error,
    moderacao: mod.error ? null : {
      estado: (mod.data as any)?.moderacao ?? null, itens: (mod.data as any)?.moderacao_itens ?? [], texto: (mod.data as any)?.moderacao_texto ?? '', em: (mod.data as any)?.moderacao_em ?? null,
    },
    pedidos: {
      pagos: conta(['pago', 'entregue']), pendentes: conta(['pendente']), reembolsados: conta(['reembolsado']), faturamento: somaPagos,
      ultimos: pedidos.slice(0, 8).map((o) => ({ id: o.id, status: o.status, total: Number(o.total), em: o.created_at })),
    },
    reclamacoes: ((recl.data ?? []) as any[]).map((c) => ({ id: c.id, status: c.status, texto: String(c.texto || '').slice(0, 200), em: c.created_at })),
    historico,
  }, { headers: SEM_CACHE });
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'produto inválido' }, { status: 400, headers: SEM_CACHE });
  const v = validarModeracao(body);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400, headers: SEM_CACHE });
  const r = await aplicarModeracao(createAdminClient(), a.userId, id, v.pedido);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status ?? 500, headers: SEM_CACHE });
  return NextResponse.json({ ok: true, status: r.status, moderacao: r.moderacao }, { headers: SEM_CACHE });
}
