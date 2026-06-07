import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { aprovarProduto, reprovarProduto } from './actions';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return (<><Nav /><div className="page"><h1>Acesso restrito</h1><p className="muted">Defina seu usuário como admin no banco: <code>update profiles set role='admin' where id='SEU_ID';</code></p></div></>);
  }

  const { data: fila } = await supabase.from('products').select('*, stores(nome)').eq('status', 'em_revisao').order('created_at');
  const { data: orders } = await supabase.from('orders').select('total, taxa');
  const gmv = (orders ?? []).reduce((s, o: any) => s + Number(o.total), 0);
  const take = (orders ?? []).reduce((s, o: any) => s + Number(o.taxa), 0);

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Admin</h1>
        <p className="muted">GMV: <strong>{money(gmv)}</strong> · Receita 3%: <strong>{money(take)}</strong> · Na fila: <strong>{(fila ?? []).length}</strong></p>
        <h2 style={{ fontFamily: 'Outfit', fontSize: 18, margin: '22px 0 14px' }}>Fila de aprovação</h2>
        <div className="card" style={{ padding: 0 }}>
          {(fila ?? []).length ? (fila as any[]).map((p) => (
            <div className="li" key={p.id}>
              <div className="em">{p.emoji}</div>
              <div><strong style={{ fontFamily: 'Outfit' }}>{p.titulo}</strong><div className="muted">{p.stores?.nome} · {money(p.preco_promo ?? p.preco)}</div></div>
              <div className="spacer" />
              <form action={aprovarProduto.bind(null, p.id)}><button className="btn btn-pri btn-sm">Aprovar</button></form>
              <form action={reprovarProduto.bind(null, p.id)}><button className="btn btn-ghost btn-sm">Reprovar</button></form>
            </div>
          )) : <div style={{ padding: 24 }} className="muted">Fila zerada.</div>}
        </div>
      </div>
    </>
  );
}
