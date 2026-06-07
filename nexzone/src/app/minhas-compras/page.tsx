import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
export const dynamic = 'force-dynamic';

export default async function MinhasComprasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total, conteudo_liberado, created_at, products(titulo, emoji, tipo_entrega)')
    .eq('comprador', user.id)
    .order('created_at', { ascending: false });

  const pagos = (orders ?? []).filter((o: any) => o.status === 'pago' || o.status === 'entregue');

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Minhas Compras</h1>
        <p className="muted">Seus produtos e acessos.</p>
        {pagos.length ? (
          <div className="card" style={{ padding: 0, marginTop: 20 }}>
            {pagos.map((o: any) => (
              <div className="li" key={o.id}>
                <div className="em">{o.products?.emoji ?? '📦'}</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontFamily: 'Outfit' }}>{o.products?.titulo ?? 'Produto'}</strong>
                  <div className="muted">{money(o.total)} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                {o.conteudo_liberado ? (
                  String(o.conteudo_liberado).startsWith('http')
                    ? <a className="btn btn-pri btn-sm" href={o.conteudo_liberado} target="_blank" rel="noreferrer">Acessar produto</a>
                    : <span className="muted" style={{ maxWidth: 260, fontSize: 12, wordBreak: 'break-word' }}>{o.conteudo_liberado}</span>
                ) : <span className="pill rev">Processando</span>}
              </div>
            ))}
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
