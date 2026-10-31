import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VendasClient from './VendasClient';
import VendasPorOrigem from './VendasPorOrigem';
import { contatosDosCompradores, carrinhosAbandonados } from '@/lib/clientesPedidos';
import { entregasEfetivas } from '@/lib/conversas-servidor';

export const dynamic = 'force-dynamic';

export default async function VendasPage({ searchParams }: { searchParams?: { f?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id, nome').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (<div><h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Vendas</h1><p className="muted">Cadastre um produto primeiro para começar a vender.</p></div>);
  }

  // Vendas concluídas + pedidos aguardando pagamento (para recuperar) + reembolsados
  const { data: vendas } = await supabase.from('orders')
    .select('id, total, taxa, valor_vendedor, status, created_at, comprador, comprador_email, product_id, conteudo_liberado, products(titulo, emoji, categoria, capa_url, tipo_anuncio)')
    .eq('store_id', store.id)
    .in('status', ['pendente', 'pago', 'entregue', 'reembolsado', 'cancelado'])
    .order('created_at', { ascending: false })
    .limit(3000);

  // Nome e WhatsApp do comprador (só dos pedidos desta loja)
  const lista = (vendas ?? []) as any[];
  let clientes = {};
  try { clientes = await contatosDosCompradores(createAdminClient(), lista.map((v) => v.comprador)); } catch { clientes = {}; }
  // Privacidade: o vendedor NÃO recebe telefone nem e-mail completo do cliente (contato só pela plataforma).
  // Isto é cortado aqui no servidor, para os dados nunca chegarem ao navegador do vendedor.
  clientes = Object.fromEntries(Object.entries(clientes as Record<string, any>).map(([k, c]) => [k, { nome: c?.nome ?? null, whatsapp: null, avisos: false }]));
  for (const v of lista) v.comprador_email = ''; // o vendedor vê o nome; e-mail e WhatsApp ficam só com a plataforma

  // Quem preencheu o checkout e saiu sem gerar o Pix (SQL 19), só dos produtos desta loja
  let carrinhos: any[] = [];
  try {
    const { data: prods } = await supabase.from('products').select('id').eq('store_id', store.id).limit(1000);
    carrinhos = await carrinhosAbandonados(createAdminClient(), { productIds: ((prods ?? []) as any[]).map((p) => p.id) });
    carrinhos = carrinhos.map((c: any) => ({ ...c, email: '', whatsapp: null, avisos: false }));
  } catch { carrinhos = []; }

  // Origem das vendas (SQL 15). Sem o SQL 15: o relatório mostra tudo como "Direto / sem rastreio".
  const { data: origens, error: oErr } = await supabase.from('orders')
    .select('id, origem').eq('store_id', store.id).in('status', ['pago', 'entregue']).limit(5000);
  const mapa: Record<string, any> = oErr ? {} : Object.fromEntries(((origens ?? []) as any[]).map((o) => [o.id, o.origem]));
  const comOrigem = lista.filter((v) => v.status === 'pago' || v.status === 'entregue' || v.status === 'reembolsado')
    .map((v) => ({ total: Number(v.total), status: v.status, origem: mapa[v.id] ?? null }));

  // Situação de cada venda paga (entregue / conversando / a entregar / reembolso em andamento) e avaliação do cliente
  const extras = await situacaoDasVendas(lista);
  for (const v of lista) v.conteudo_liberado = null; // não manda o conteúdo da entrega para a tabela

  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.compreibarato.com.br').replace(/\/+$/, '');
  return (
    <>
      <VendasClient vendas={lista} situacao={extras.situacao} avaliacoes={extras.avaliacoes} notaCliente={extras.notaCliente} sql32={extras.sql32} cbAtivo={extras.cbAtivo} bonus={extras.bonus} clientes={clientes} loja={(store as any).nome || ''} site={site} inicial={searchParams?.f === 'aguardando' || searchParams?.f === 'abandonou' ? searchParams.f : 'vendas'} carrinhos={carrinhos} privado />
      <VendasPorOrigem vendas={comOrigem} />
    </>
  );
}

type Situacao = 'entregue' | 'conversando' | 'a_entregar' | 'reembolso';
async function situacaoDasVendas(lista: any[]) {
  const vazio = { situacao: {} as Record<string, Situacao>, avaliacoes: {} as Record<string, { nota: number; comentario: string | null }>, notaCliente: {} as Record<string, { media: number; qtd: number }>, sql32: true, cbAtivo: false, bonus: 0 };
  const pagas = lista.filter((v) => v.status === 'pago' || v.status === 'entregue');
  if (!pagas.length) return vazio;
  try {
    const admin = createAdminClient();
    const ids = pagas.map((v) => v.id);
    const lotes: string[][] = [];
    for (let i = 0; i < ids.length; i += 150) lotes.push(ids.slice(i, i + 150));
    const ent = await entregasEfetivas(admin, pagas.map((v) => ({ id: v.id, status: v.status, product_id: v.product_id, conteudo_liberado: v.conteudo_liberado, tipo_anuncio: v.products?.tipo_anuncio })));
    const conversa = new Set<string>(), reembolso = new Set<string>();
    const avaliacoes: Record<string, { nota: number; comentario: string | null }> = {};
    let sql32 = true;
    for (const lote of lotes) {
      const [msgs, reemb, av] = await Promise.all([
        admin.from('order_messages').select('order_id').in('order_id', lote).eq('papel', 'comprador').limit(5000),
        admin.from('reembolso_pedidos').select('order_id, status').in('order_id', lote).eq('status', 'aberto'),
        admin.from('avaliacoes_cliente').select('order_id, nota, comentario').in('order_id', lote),
      ]);
      for (const m of (msgs.data ?? []) as any[]) conversa.add(m.order_id);
      for (const r of (reemb.data ?? []) as any[]) reembolso.add(r.order_id);
      if (av.error) sql32 = false;
      for (const a of (av.data ?? []) as any[]) avaliacoes[a.order_id] = { nota: a.nota, comentario: a.comentario };
    }
    const situacao: Record<string, Situacao> = {};
    for (const v of pagas) situacao[v.id] = reembolso.has(v.id) ? 'reembolso' : ent.entregue[v.id] ? 'entregue' : conversa.has(v.id) ? 'conversando' : 'a_entregar';
    // reputação do cliente (avaliações de TODAS as lojas): ajuda o vendedor a reconhecer cliente problemático
    const notaCliente: Record<string, { media: number; qtd: number }> = {};
    if (sql32) {
      const compradores = Array.from(new Set(pagas.map((v) => v.comprador).filter(Boolean))).slice(0, 500);
      if (compradores.length) {
        const { data: todas } = await admin.from('avaliacoes_cliente').select('comprador, nota').in('comprador', compradores).limit(20000);
        const soma: Record<string, [number, number]> = {};
        for (const a of (todas ?? []) as any[]) { const x = soma[a.comprador] ?? [0, 0]; x[0] += Number(a.nota); x[1]++; soma[a.comprador] = x; }
        for (const [k, [t, q]] of Object.entries(soma)) notaCliente[k] = { media: Math.round((t / q) * 10) / 10, qtd: q };
      }
    }
    const { data: cfg } = await admin.from('settings').select('key, value').in('key', ['cb_points_ativo', 'cb_points_review_bonus']);
    const m = Object.fromEntries(((cfg ?? []) as any[]).map((r) => [r.key, r.value]));
    const cbAtivo = m.cb_points_ativo === true || m.cb_points_ativo === 'true';
    const b = Number(String(m.cb_points_review_bonus ?? '3').replace(/"/g, ''));
    return { situacao, avaliacoes, notaCliente, sql32, cbAtivo, bonus: cbAtivo && Number.isFinite(b) && b > 0 ? b : 0 };
  } catch {
    return vazio;
  }
}
