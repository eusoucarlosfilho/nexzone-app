import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default async function ConversasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (<div><h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Conversas</h1><p className="muted">Cadastre um produto primeiro para começar a vender e conversar com clientes.</p></div>);
  }

  const { data: pedidos } = await supabase.from('orders')
    .select('id, total, status, created_at, comprador_email, products(titulo, emoji)')
    .eq('store_id', store.id)
    .in('status', ['pago', 'entregue'])
    .order('created_at', { ascending: false });

  const lista = pedidos ?? [];

  return (
    <div>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Conversas</h1>
      <p className="muted" style={{ marginBottom: 18 }}>Cada venda abre uma conversa com o cliente. Entregue o produto e tire dúvidas por aqui.</p>

      {lista.length === 0 ? (
        <div className="card"><p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhuma venda ainda. Quando você vender, a conversa com o cliente aparece aqui.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {lista.map((o: any, i: number) => (
            <Link key={o.id} href={`/vender/conversas/${o.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', textDecoration: 'none', color: 'inherit', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <div className="em" style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'var(--surface)', flexShrink: 0 }}>{o.products?.emoji ?? '📦'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontFamily: 'Outfit', fontSize: 14, display: 'block' }}>{o.products?.titulo ?? 'Produto'}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{o.comprador_email ?? 'Cliente'} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {o.status === 'pago' && <span style={{ fontSize: 11, fontWeight: 800, color: '#B7791F', background: '#B7791F22', padding: '3px 10px', borderRadius: 50, fontFamily: 'Outfit' }}>Entregar</span>}
              <strong style={{ fontFamily: 'Outfit', fontSize: 14 }}>{money(o.total)}</strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
