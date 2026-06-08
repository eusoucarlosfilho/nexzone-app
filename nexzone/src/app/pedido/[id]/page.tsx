import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import OrderView from './OrderView';

export const dynamic = 'force-dynamic';

export default async function PedidoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: order } = await supabase.from('orders')
    .select('id, status, total, pix_code, pix_qr, conteudo_liberado, products(titulo, emoji, tipo_entrega, arquivo_path)')
    .eq('id', params.id).eq('comprador', user.id).single();
  if (!order) notFound();

  const p: any = (order as any).products;
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
          titulo={p?.titulo ?? 'Produto'}
          emoji={p?.emoji ?? '📦'}
          total={Number(order.total)}
        />
      </div>
    </>
  );
}
