import Nav from '@/components/Nav';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { situacaoGarantia } from '@/lib/reembolso-servidor';
import { entregaPeloVendedor } from '@/lib/confianca';
import AjudaPedido from './AjudaPedido';
import { liberacaoReclamacao } from '@/lib/conversas-servidor';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

// Central de ajuda do pedido: fora da tela de obrigado, para o reembolso não ser o primeiro clique.
// O reembolso continua a 1 toque daqui, dentro da garantia (direito de arrependimento, CDC art. 49).
export default async function AjudaPedidoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pedido/${params.id}/ajuda`)}`);

  const { data: order } = await supabase.from('orders')
    .select('id, status, total, products(titulo, tipo_anuncio)')
    .eq('id', params.id).eq('comprador', user.id).single();
  if (!order) notFound();
  const p: any = (order as any).products;
  const admin = createAdminClient();
  const [g, cmp] = await Promise.all([
    situacaoGarantia(admin, order.id),
    supabase.from('complaints').select('id').eq('order_id', order.id).eq('status', 'aberta').maybeSingle(),
  ]);
  const garantia = g && g.sql18 ? { dias: g.dias, ate: g.elegivel.ate ? g.elegivel.ate.toISOString() : null, pode: g.elegivel.pode, motivo: g.elegivel.pode ? null : g.elegivel.motivo, pedidos: g.pedidos } : null;
  const pago = order.status === 'pago' || order.status === 'entregue';
  const lib = pago ? await liberacaoReclamacao(admin, order.id, null).catch(() => null) : null;

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 560 }}>
        <Link href={`/pedido/${order.id}`} className="muted" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}><Icon name="arrowLeft" size={14} /> Voltar ao pedido</Link>
        <h1 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 24, margin: '0 0 4px' }}>Ajuda com o pedido</h1>
        <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>{p?.titulo ?? 'Produto'} · pedido {String(order.id).slice(0, 8)}</p>
        {pago || order.status === 'reembolsado' ? (
          <AjudaPedido orderId={order.id} garantia={garantia} reclamacaoAberta={!!cmp.data} manual={entregaPeloVendedor(p?.tipo_anuncio)} reembolsado={order.status === 'reembolsado'} liberaEm={lib && !lib.pode ? lib.liberaEm ?? null : null} />
        ) : (
          <div className="card">
            <p style={{ margin: 0 }}>Este pedido ainda não foi pago, então não há nada para reembolsar. Se pagou agora, a confirmação aparece no pedido em instantes.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Link href={`/pedido/${order.id}`} className="btn btn-pri btn-sm">Ver o pedido</Link>
              <Link href="/suporte" className="btn btn-ghost btn-sm">Falar com o suporte</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
