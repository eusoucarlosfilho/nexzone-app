import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { calcBalance } from '@/lib/balance';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
export const dynamic = 'force-dynamic';

export default async function VenderCockpit() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id, nome, status').eq('owner', user.id).maybeSingle();

  if (!store) {
    return (
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Bem-vindo ao NexZone 🚀</h1>
        <p className="muted" style={{ marginTop: 6 }}>Você ainda não tem produtos. Cadastre o primeiro e sua loja é criada automaticamente.</p>
        <Link href="/vender/produtos" className="btn btn-pri" style={{ marginTop: 18, display: 'inline-block' }}>Cadastrar meu primeiro produto</Link>
      </div>
    );
  }

  const { data: orders } = await supabase.from('orders')
    .select('total, valor_vendedor, status, created_at, products(titulo, emoji)')
    .eq('store_id', store.id).order('created_at', { ascending: false });
  const all = (orders ?? []) as any[];
  const entregues = all.filter((o) => o.status === 'entregue' || o.status === 'pago');
  const bal = await calcBalance(supabase, store.id);

  const now = new Date();
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const mesPassadoIni = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const fatTotal = entregues.reduce((s, o) => s + Number(o.valor_vendedor), 0);
  const fatMes = entregues.filter((o) => new Date(o.created_at).getTime() >= mesIni).reduce((s, o) => s + Number(o.valor_vendedor), 0);
  const fatMesPassado = entregues.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= mesPassadoIni && t < mesIni; }).reduce((s, o) => s + Number(o.valor_vendedor), 0);
  const vendasMes = entregues.filter((o) => new Date(o.created_at).getTime() >= mesIni).length;
  const ticket = entregues.length ? fatTotal / entregues.length : 0;

  // meta do mês
  const meta = Math.max(1000, Math.ceil((fatMesPassado * 1.2 || 1000) / 100) * 100);
  const progresso = Math.min(100, meta ? (fatMes / meta) * 100 : 0);

  // gráfico 7 dias (faturamento líquido)
  const daily: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const total = entregues.filter((o) => { const t = new Date(o.created_at); return t >= d && t < next; }).reduce((s, o) => s + Number(o.valor_vendedor), 0);
    daily.push({ label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), total });
  }
  const maxDay = Math.max(1, ...daily.map((d) => d.total));
  const recentes = entregues.slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, letterSpacing: '-.6px' }}>Olá, {store.nome} 👋</h1>
          <p className="muted">Aqui está o pulso da sua loja.</p>
        </div>
        <Link href="/vender/recebimentos" className="card" style={{ padding: '14px 20px', textDecoration: 'none', color: 'inherit', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>SALDO DISPONÍVEL</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 900, color: 'var(--green)' }}>{money(bal.disponivel)}</div>
        </Link>
      </div>

      <div className="sd-stats" style={{ marginTop: 18 }}>
        <div className="sd-stat"><div className="ic">💸</div><b>{money(fatMes)}</b><small>Faturamento do mês</small></div>
        <div className="sd-stat"><div className="ic">🧾</div><b>{vendasMes}</b><small>Vendas no mês</small></div>
        <div className="sd-stat"><div className="ic">🎯</div><b>{money(ticket)}</b><small>Ticket médio</small></div>
        <div className="sd-stat"><div className="ic">🏆</div><b>{money(fatTotal)}</b><small>Faturamento total</small></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <strong style={{ fontFamily: 'Outfit' }}>🎯 Meta do mês</strong>
          <span className="muted" style={{ fontSize: 13 }}>{money(fatMes)} de {money(meta)}</span>
        </div>
        <div className="sd-meta"><div className="fill" style={{ width: `${progresso}%` }} /></div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {progresso >= 100 ? '🔥 Meta batida! Você está voando.' : `Faltam ${money(meta - fatMes)} para bater sua meta do mês.`}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <strong style={{ fontFamily: 'Outfit', display: 'block', marginBottom: 16 }}>Faturamento dos últimos 7 dias</strong>
        <div className="sd-bars">
          {daily.map((d, i) => (
            <div className="sd-bar" key={i}>
              <span className="v">{d.total > 0 ? money(d.total).replace('R$ ', '') : ''}</span>
              <div className="b" style={{ height: `${(d.total / maxDay) * 100}%` }} />
              <span className="l">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <strong style={{ fontFamily: 'Outfit', display: 'block', marginBottom: 8 }}>Vendas recentes</strong>
        {recentes.length ? recentes.map((o, i) => (
          <div className="li" key={i}>
            <div className="em">{o.products?.emoji ?? '📦'}</div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontFamily: 'Outfit', fontSize: 14 }}>{o.products?.titulo ?? 'Produto'}</strong>
              <div className="muted">{new Date(o.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <strong style={{ fontFamily: 'Outfit', color: 'var(--green)' }}>+ {money(o.valor_vendedor)}</strong>
          </div>
        )) : <p className="muted" style={{ fontSize: 13 }}>Nenhuma venda ainda. Divulgue seus produtos e elas aparecem aqui. 🚀</p>}
      </div>
    </div>
  );
}
