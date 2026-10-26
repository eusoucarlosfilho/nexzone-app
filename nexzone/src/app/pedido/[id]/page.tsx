import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import OrderView from './OrderView';
import { stripeAvailable } from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';

export default async function PedidoPage({ params, searchParams }: { params: { id: string }; searchParams?: { cartao?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pedido/${params.id}`)}`);

  const { data: order } = await supabase.from('orders')
    .select('id, status, total, pix_code, pix_qr, conteudo_liberado, bump_product_id, bump_titulo, bump_conteudo, bump_arquivo_path, products(titulo, emoji, categoria, capa_url, tipo_entrega, arquivo_path)')
    .eq('id', params.id).eq('comprador', user.id).single();
  if (!order) notFound();

  const { data: rev } = await supabase.from('reviews').select('id').eq('order_id', order.id).maybeSingle();
  const { data: cmp } = await supabase.from('complaints').select('id').eq('order_id', order.id).eq('status', 'aberta').maybeSingle();
  const p: any = (order as any).products;
  const cartaoDisponivel = order.status === 'pendente' ? await stripeAvailable() : false;
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 560 }}>
        <OrderView
          orderId={order.id}
          initialStatus={order.status}
          pixCode={order.pix_code}
          pixQr={order.pix_qr}
          conteudo={order.conteudo_liberado}
          temArquivo={!!p?.arquivo_path}
          jaAvaliou={!!rev}
          titulo={p?.titulo ?? 'Produto'}
          emoji={p?.emoji ?? ''}
          categoria={p?.categoria}
          capa_url={p?.capa_url}
          total={Number(order.total)}
          bumpTitulo={(order as any).bump_titulo}
          bumpConteudo={(order as any).bump_conteudo}
          bumpTemArquivo={!!(order as any).bump_arquivo_path}
          reclamacaoAberta={!!cmp}
          cartaoDisponivel={cartaoDisponivel}
          voltouDoCartao={searchParams?.cartao === 'ok'}
        />
      </div>
    </>
  );
}
