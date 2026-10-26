import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ProductThumb from '@/components/ProductThumb';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/Icon';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
export const dynamic = 'force-dynamic';

// Abas de filtro (só visualização; os pedidos vêm da mesma consulta de antes)
const ABAS: { id: string; label: string; status: string[] | null }[] = [
  { id: 'todas', label: 'Todas', status: null },
  { id: 'pendentes', label: 'Aguardando pagamento', status: ['pendente'] },
  { id: 'liberadas', label: 'Liberadas', status: ['pago', 'entregue'] },
  { id: 'encerradas', label: 'Reembolsadas e canceladas', status: ['reembolsado', 'cancelado'] },
];

function acao(status: string) {
  if (status === 'pendente') return 'Pagar';
  if (status === 'pago' || status === 'entregue') return 'Acessar';
  return 'Ver detalhes';
}

export default async function MinhasComprasPage({ searchParams }: { searchParams: { aba?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total, created_at, products(titulo, emoji, categoria, capa_url)')
    .eq('comprador', user.id)
    .order('created_at', { ascending: false });

  const todas = (orders ?? []) as any[];
  const aba = ABAS.find((a) => a.id === searchParams?.aba) ?? ABAS[0];
  const list = aba.status ? todas.filter((o) => aba.status!.includes(o.status)) : todas;
  const qtd = (a: typeof ABAS[number]) => (a.status ? todas.filter((o) => a.status!.includes(o.status)).length : todas.length);

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Minhas Compras</h1>
        <p className="muted">Seus pedidos, downloads e acessos. Toque em um pedido para ver os detalhes.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href="/favoritos" className="btn btn-ghost btn-sm"><Icon name="heart" size={16} /> Favoritos</Link>
          <Link href="/suporte" className="btn btn-ghost btn-sm"><Icon name="help" size={16} /> Ajuda e suporte</Link>
        </div>
        {todas.length > 0 && (
          <nav aria-label="Filtrar compras" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 18, paddingBottom: 4 }}>
            {ABAS.map((a) => (
              <Link key={a.id} href={a.id === 'todas' ? '/minhas-compras' : `/minhas-compras?aba=${a.id}`}
                className={`btn btn-sm ${aba.id === a.id ? 'btn-pri' : 'btn-ghost'}`} aria-current={aba.id === a.id ? 'page' : undefined}
                style={{ whiteSpace: 'nowrap' }}>{a.label} · {qtd(a)}</Link>
            ))}
          </nav>
        )}
        {list.length ? (
          <div className="card" style={{ padding: 0, marginTop: 20 }}>
            {list.map((o) => {
              return (
                <Link href={`/pedido/${o.id}`} key={o.id} className="li" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <ProductThumb className="em" capa_url={o.products?.capa_url} categoria={o.products?.categoria} titulo={o.products?.titulo} tamanho={46} raio={14} icone={22} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontFamily: 'Outfit' }}>{o.products?.titulo ?? 'Produto'}</strong>
                    <div className="muted">{money(o.total)} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <StatusBadge tipo="pedido" status={o.status === 'entregue' ? 'entregue' : o.status} />
                  <span className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }}>{acao(o.status)}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 20 }}>
            {todas.length
              ? <EmptyState icon="receipt" title="Nenhuma compra nesta aba" action={<Link href="/minhas-compras" className="btn btn-ghost btn-sm">Ver todas</Link>} />
              : <EmptyState icon="bag" title="Você ainda não tem compras" text="Quando você comprar, seus acessos e downloads aparecem aqui."
                  action={<Link href="/produtos" className="btn btn-pri btn-sm">Explorar produtos</Link>} />}
          </div>
        )}
      </div>
    </>
  );
}
