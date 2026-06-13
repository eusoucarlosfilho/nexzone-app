import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
export const dynamic = 'force-dynamic';

const STATUS: Record<string, [string, string]> = {
  pendente: ['rev', 'Aguardando pagamento'],
  pago: ['act', 'Pago'],
  entregue: ['act', 'Liberado'],
  reembolsado: ['rej', 'Reembolsado'],
  cancelado: ['rej', 'Cancelado'],
};

export default async function MinhasComprasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total, created_at, products(titulo, emoji)')
    .eq('comprador', user.id)
    .order('created_at', { ascending: false });

  const list = (orders ?? []) as any[];

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Minhas Compras</h1>
        <p className="muted">Seus pedidos e acessos.</p>
        {list.length ? (
          <div className="card" style={{ padding: 0, marginTop: 20 }}>
            {list.map((o) => {
              const st = STATUS[o.status] || ['rev', o.status];
              const pendente = o.status === 'pendente';
              return (
                <Link href={`/pedido/${o.id}`} key={o.id} className="li" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="em">{o.products?.emoji ?? '📦'}</div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontFamily: 'Outfit' }}>{o.products?.titulo ?? 'Produto'}</strong>
                    <div className="muted">{money(o.total)} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <span className={`pill ${st[0]}`}>{st[1]}</span>
                  <span className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }}>{pendente ? 'Pagar' : 'Acessar'}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
            <p className="muted">Você ainda não tem compras.</p>
            <Link href="/" className="btn btn-pri btn-sm" style={{ marginTop: 12, display: 'inline-block' }}>Explorar produtos</Link>
          </div>
        )}
      </div>
    </>
  );
}
