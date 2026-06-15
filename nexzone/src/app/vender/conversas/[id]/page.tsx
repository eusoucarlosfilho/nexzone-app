import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import SellerChatView from './SellerChatView';

export const dynamic = 'force-dynamic';
const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default async function ConversaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) redirect('/vender');

  const { data: order } = await supabase.from('orders')
    .select('id, total, status, created_at, comprador_email, conteudo_liberado, products(titulo, emoji)')
    .eq('id', params.id).eq('store_id', store.id).maybeSingle();
  if (!order) notFound();

  const p: any = (order as any).products;

  return (
    <div style={{ maxWidth: 620 }}>
      <Link href="/vender/conversas" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>← Voltar para conversas</Link>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: 'var(--surface)' }}>{p?.emoji ?? '📦'}</div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{p?.titulo ?? 'Produto'}</strong>
          <div className="muted" style={{ fontSize: 12 }}>{(order as any).comprador_email ?? 'Cliente'} · {money((order as any).total)}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Outfit', padding: '4px 11px', borderRadius: 50, color: (order as any).status === 'entregue' ? '#00875A' : '#B7791F', background: (order as any).status === 'entregue' ? '#00875A22' : '#B7791F22' }}>
          {(order as any).status === 'entregue' ? 'Entregue' : 'A entregar'}
        </span>
      </div>

      <SellerChatView orderId={(order as any).id} entregue={(order as any).status === 'entregue'} conteudoAtual={(order as any).conteudo_liberado ?? ''} />
    </div>
  );
}
