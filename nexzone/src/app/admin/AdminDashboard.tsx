'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import SettingsForm from './SettingsForm';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const fmt = (v: number) => Number(v).toLocaleString('pt-BR');

const STATUS: Record<string, [string, string]> = {
  pendente: ['#B7791F', 'Pendente'],
  pago: ['#00B87A', 'Pago'],
  entregue: ['#00B87A', 'Entregue'],
  reembolsado: ['#E23B3B', 'Reembolsado'],
  cancelado: ['#E23B3B', 'Cancelado'],
  em_revisao: ['#B7791F', 'Em revisão'],
  ativo: ['#00B87A', 'Ativo'],
  reprovado: ['#E23B3B', 'Reprovado'],
};

export default function AdminDashboard({ metrics, daily, orders, products, stores, payouts, boosts, settings, growth, sellers }: any) {
  const [tab, setTab] = useState('cockpit');
  const [queue, setQueue] = useState(products.filter((p: any) => p.status === 'em_revisao'));
  const [allProducts, setAllProducts] = useState(products);
  const [orderFilter, setOrderFilter] = useState('todos');
  const [orderList, setOrderList] = useState(orders || []);
  const [expSeller, setExpSeller] = useState<string | null>(null);
  const [engFiltro, setEngFiltro] = useState('todos');
  const [payoutList, setPayoutList] = useState(payouts || []);
  const [boostList] = useState(boosts || []);
  const [busy, setBusy] = useState<string | null>(null);

  async function moderar(id: string, action: 'aprovar' | 'reprovar') {
    setBusy(id);
    try {
      const r = await fetch('/api/admin/product-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ id, action }),
      });
      const d = await r.json();
      if (r.ok) {
        setQueue((q: any[]) => q.filter((p) => p.id !== id));
        setAllProducts((ps: any[]) => ps.map((p) => p.id === id ? { ...p, status: d.status } : p));
      }
    } finally { setBusy(null); }
  }

  async function moderarSaque(id: string, action: 'pagar' | 'recusar') {
    setBusy(id);
    try {
      const r = await fetch('/api/admin/payout-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ id, action }),
      });
      const d = await r.json();
      if (r.ok) setPayoutList((ps: any[]) => ps.map((p) => p.id === id ? { ...p, status: d.status } : p));
    } finally { setBusy(null); }
  }

  async function reembolsar(id: string) {
    if (!confirm('Confirmar reembolso? Marque como reembolsado SOMENTE após estornar o valor no Mercado Pago.')) return;
    setBusy(id);
    try {
      const r = await fetch('/api/admin/order-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ id, action: 'reembolsar' }),
      });
      const d = await r.json();
      if (r.ok) { setOrderList((l: any[]) => l.map((o) => o.id === id ? { ...o, status: 'reembolsado' } : o)); toast('Pedido reembolsado.', 'success'); }
      else toast(d.error || 'Erro ao reembolsar', 'error');
    } finally { setBusy(null); }
  }

  const NAV = [
    ['cockpit', '📊', 'Cockpit', 0],
    ['aprovacao', '✅', 'Aprovação', queue.length],
    ['pedidos', '🧾', 'Pedidos', 0],
    ['vendedores', '🏪', 'Vendedores', metrics.lojasPendentes],
    ['produtos', '📦', 'Produtos', 0],
    ['saques', '💸', 'Saques', metrics.saquesPendentes],
    ['destaques', '⭐', 'Destaques', metrics.destaquesAtivos],
    ['crescimento', '📊', 'Crescimento', 0],
    ['config', '⚙️', 'Configurações', 0],
  ];

  const maxDay = Math.max(1, ...daily.map((d: any) => d.total));
  const filteredOrders = orderFilter === 'todos' ? orderList : orderList.filter((o: any) => o.status === orderFilter);

  const Pill = ({ s }: { s: string }) => {
    const [c, label] = STATUS[s] || ['#9E9EBA', s];
    return <span className="adm-pill" style={{ color: c, background: c + '22' }}>{label}</span>;
  };

  return (
    <div className="adm">
      <style>{`
        .adm{--bg:#0E0E18;--panel:#16161F;--panel2:#1C1C28;--bd:#26263340;--bd2:#2A2A3A;--tx:#EDEDF5;--sub:#9292AC;--or:#FF7A14;--or2:#FF9A3C;--grad:linear-gradient(135deg,#FF6B00,#FF9A3C);min-height:100vh;background:var(--bg);color:var(--tx);font-family:'Nunito',sans-serif;display:flex;}
        .adm *{box-sizing:border-box;}
        .adm-side{width:230px;background:var(--panel);border-right:1px solid var(--bd2);padding:22px 14px;flex-shrink:0;display:flex;flex-direction:column;gap:4px;position:sticky;top:0;height:100vh;}
        .adm-logo{font-family:'Outfit';font-weight:900;font-size:22px;letter-spacing:-1px;padding:0 8px 18px;}
        .adm-logo span{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .adm-nav{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;font-family:'Outfit';font-weight:600;font-size:14px;color:var(--sub);background:none;border:none;cursor:pointer;width:100%;text-align:left;transition:.15s;}
        .adm-nav:hover{background:var(--panel2);color:var(--tx);}
        .adm-nav.on{background:#FF7A1420;color:var(--or2);}
        .adm-nav .bd{margin-left:auto;background:var(--or);color:#fff;font-size:11px;font-weight:800;border-radius:50px;padding:1px 8px;}
        .adm-foot{margin-top:auto;border-top:1px solid var(--bd2);padding-top:12px;}
        .adm-foot a{display:block;padding:9px 13px;font-size:13px;color:var(--sub);text-decoration:none;border-radius:9px;font-family:'Outfit';font-weight:600;}
        .adm-foot a:hover{background:var(--panel2);color:var(--tx);}
        .adm-main{flex:1;padding:30px 34px;min-width:0;}
        .adm-h{font-family:'Outfit';font-size:26px;font-weight:800;letter-spacing:-.6px;margin:0 0 4px;}
        .adm-sub{color:var(--sub);font-size:14px;margin:0 0 26px;}
        .adm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin-bottom:24px;}
        .adm-stat{background:var(--panel);border:1px solid var(--bd2);border-radius:16px;padding:20px;}
        .adm-stat .ic{width:40px;height:40px;border-radius:11px;background:#FF7A1420;color:var(--or2);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;}
        .adm-stat b{font-family:'Outfit';font-size:25px;font-weight:800;display:block;letter-spacing:-.5px;}
        .adm-stat small{color:var(--sub);font-size:12px;font-weight:700;}
        .adm-card{background:var(--panel);border:1px solid var(--bd2);border-radius:16px;padding:22px;margin-bottom:20px;}
        .adm-ct{font-family:'Outfit';font-weight:800;font-size:15px;margin:0 0 16px;}
        .adm-bars{display:flex;align-items:flex-end;gap:10px;height:140px;}
        .adm-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:flex-end;height:100%;}
        .adm-bar .b{width:100%;max-width:38px;background:var(--grad);border-radius:7px 7px 0 0;min-height:4px;transition:.3s;}
        .adm-bar .l{font-size:11px;color:var(--sub);font-weight:700;}
        .adm-bar .v{font-size:11px;color:var(--tx);font-weight:800;font-family:'Outfit';}
        .adm-table{width:100%;border-collapse:collapse;font-size:13px;}
        .adm-table th{text-align:left;color:var(--sub);font-family:'Outfit';font-weight:700;font-size:11px;letter-spacing:.5px;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--bd2);}
        .adm-table td{padding:13px 12px;border-bottom:1px solid var(--bd);}
        .adm-table tr:last-child td{border-bottom:none;}
        .adm-table .em{font-size:18px;}
        .adm-pill{font-size:11px;font-weight:800;font-family:'Outfit';padding:3px 10px;border-radius:50px;white-space:nowrap;}
        .adm-row{display:flex;align-items:center;gap:13px;padding:14px 0;border-bottom:1px solid var(--bd);}
        .adm-row:last-child{border-bottom:none;}
        .adm-row .em{width:42px;height:42px;border-radius:11px;background:var(--panel2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
        .adm-row .info{flex:1;min-width:0;}
        .adm-row .info b{font-family:'Outfit';font-size:14px;display:block;}
        .adm-row .info span{font-size:12px;color:var(--sub);}
        .adm-btn{font-family:'Outfit';font-weight:700;font-size:13px;padding:8px 15px;border-radius:9px;border:none;cursor:pointer;}
        .adm-btn.ap{background:var(--grad);color:#fff;}
        .adm-btn.rp{background:none;border:1px solid var(--bd2);color:var(--sub);}
        .adm-btn:disabled{opacity:.5;}
        .adm-filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;}
        .adm-fb{font-family:'Outfit';font-weight:700;font-size:12px;padding:7px 14px;border-radius:50px;background:var(--panel2);color:var(--sub);border:1px solid var(--bd2);cursor:pointer;}
        .adm-fb.on{background:#FF7A1420;color:var(--or2);border-color:#FF7A1450;}
        .adm-empty{text-align:center;color:var(--sub);padding:40px;font-size:14px;}
        .adm-soon{display:inline-block;font-size:10px;font-weight:800;color:var(--sub);background:var(--panel2);border:1px solid var(--bd2);border-radius:50px;padding:2px 9px;margin-left:8px;}
        @media(max-width:820px){.adm{flex-direction:column;}.adm-side{width:100%;height:auto;position:static;flex-direction:row;overflow-x:auto;padding:10px;}.adm-logo{display:none;}.adm-foot{display:none;}.adm-nav{width:auto;white-space:nowrap;}.adm-main{padding:20px 16px;}}
      `}</style>

      <aside className="adm-side">
        <div className="adm-logo">Nex<span>Zone</span></div>
        {NAV.map(([id, ic, label, badge]: any) => (
          <button key={id} className={`adm-nav ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            <span>{ic}</span> {label} {badge > 0 && <span className="bd">{badge}</span>}
          </button>
        ))}
        <div className="adm-foot">
          <a href="/">← Voltar ao site</a>
          <form action="/auth/signout" method="post"><button className="adm-nav" style={{ color: '#E23B3B' }}>⎋ Sair</button></form>
        </div>
      </aside>

      <main className="adm-main">
        {tab === 'cockpit' && (
          <>
            <h1 className="adm-h">Cockpit</h1>
            <p className="adm-sub">Visão geral do Comprei Barato em tempo real.</p>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic">💰</div><b>{money(metrics.gmv)}</b><small>GMV (volume vendido)</small></div>
              <div className="adm-stat"><div className="ic">📈</div><b>{money(metrics.receita)}</b><small>Sua receita (3%)</small></div>
              <div className="adm-stat"><div className="ic">🧾</div><b>{fmt(metrics.pedidosPagos)}</b><small>Vendas pagas</small></div>
              <div className="adm-stat"><div className="ic">🎯</div><b>{money(metrics.ticket)}</b><small>Ticket médio</small></div>
            </div>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic">🏪</div><b>{fmt(metrics.totalLojas)}</b><small>Vendedores</small></div>
              <div className="adm-stat"><div className="ic">📦</div><b>{fmt(metrics.totalProdutosAtivos)}</b><small>Produtos ativos</small></div>
              <div className="adm-stat"><div className="ic">👥</div><b>{fmt(metrics.buyersCount)}</b><small>Compradores</small></div>
              <div className="adm-stat"><div className="ic">⏳</div><b>{fmt(metrics.filaProdutos)}</b><small>Aguardando aprovação</small></div>
              <div className="adm-stat"><div className="ic">⭐</div><b>{money(metrics.receitaDivulgacao)}</b><small>Receita de divulgação</small></div>
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Receita dos últimos 7 dias</h3>
              <div className="adm-bars">
                {daily.map((d: any, i: number) => (
                  <div className="adm-bar" key={i}>
                    <span className="v">{d.total > 0 ? money(d.total).replace('R$ ', '') : ''}</span>
                    <div className="b" style={{ height: `${(d.total / maxDay) * 100}%` }} />
                    <span className="l">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Pedidos recentes</h3>
              {orders.length ? (
                <table className="adm-table">
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead>
                  <tbody>
                    {orders.slice(0, 6).map((o: any) => (
                      <tr key={o.id}>
                        <td><span className="em">{o.products?.emoji ?? '📦'}</span> {o.products?.titulo ?? 'Produto'}</td>
                        <td style={{ color: 'var(--sub)' }}>{o.stores?.nome ?? '—'}</td>
                        <td>{money(o.total)}</td>
                        <td><Pill s={o.status} /></td>
                        <td style={{ color: 'var(--sub)' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="adm-empty">Nenhum pedido ainda.</div>}
            </div>
          </>
        )}

        {tab === 'aprovacao' && (
          <>
            <h1 className="adm-h">Fila de Aprovação</h1>
            <p className="adm-sub">Curadoria = a defesa da plataforma. Aprove só o que mantém a confiança.</p>
            <div className="adm-card">
              {queue.length ? queue.map((p: any) => (
                <div className="adm-row" key={p.id}>
                  <div className="em">{p.emoji}</div>
                  <div className="info"><b>{p.titulo}</b><span>{p.stores?.nome ?? '—'} · {p.categoria} · {money(p.preco_promo ?? p.preco)}</span></div>
                  <button className="adm-btn ap" disabled={busy === p.id} onClick={() => moderar(p.id, 'aprovar')}>Aprovar</button>
                  <button className="adm-btn rp" disabled={busy === p.id} onClick={() => moderar(p.id, 'reprovar')}>Reprovar</button>
                </div>
              )) : <div className="adm-empty">✅ Fila zerada. Nenhum produto aguardando.</div>}
            </div>
          </>
        )}

        {tab === 'pedidos' && (
          <>
            <h1 className="adm-h">Pedidos</h1>
            <p className="adm-sub">Todos os pedidos da plataforma.</p>
            <div className="adm-filters">
              {['todos', 'pendente', 'pago', 'entregue', 'reembolsado'].map((f) => (
                <button key={f} className={`adm-fb ${orderFilter === f ? 'on' : ''}`} onClick={() => setOrderFilter(f)}>
                  {f === 'todos' ? 'Todos' : (STATUS[f]?.[1] ?? f)}
                </button>
              ))}
            </div>
            <div className="adm-card">
              {filteredOrders.length ? (
                <table className="adm-table">
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Valor</th><th>Taxa 3%</th><th>Status</th><th>Data</th><th></th></tr></thead>
                  <tbody>
                    {filteredOrders.map((o: any) => (
                      <tr key={o.id}>
                        <td><span className="em">{o.products?.emoji ?? '📦'}</span> {o.products?.titulo ?? 'Produto'}</td>
                        <td style={{ color: 'var(--sub)' }}>{o.stores?.nome ?? '—'}</td>
                        <td>{money(o.total)}</td>
                        <td style={{ color: 'var(--or2)' }}>{money(o.taxa)}</td>
                        <td><Pill s={o.status} /></td>
                        <td style={{ color: 'var(--sub)' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>{(o.status === 'pago' || o.status === 'entregue') && <button className="adm-btn rp" disabled={busy === o.id} onClick={() => reembolsar(o.id)}>Reembolsar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="adm-empty">Nenhum pedido com esse status.</div>}
            </div>
          </>
        )}

        {tab === 'vendedores' && (() => {
          const Det = ({ l, v }: any) => (<div style={{ background: 'var(--soft)', borderRadius: 10, padding: '10px 12px' }}><div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>{l}</div><div style={{ fontFamily: 'Outfit', fontWeight: 800, marginTop: 2 }}>{v}</div></div>);
          const lista = (sellers || []).filter((s: any) => engFiltro === 'todos' || s.eng.tag === engFiltro);
          return (
          <>
            <h1 className="adm-h">Vendedores</h1>
            <p className="adm-sub">Clique num vendedor para ver os detalhes. Use o selo para saber quem precisa de atenção.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {['todos', 'Ativo', 'Travado', 'Parado', 'Novo'].map((f) => (
                <button key={f} className={`adm-btn ${engFiltro === f ? 'ap' : ''}`} onClick={() => setEngFiltro(f)}>{f === 'todos' ? 'Todos' : f}</button>
              ))}
            </div>
            <div className="adm-card" style={{ padding: 0 }}>
              {lista.length ? lista.map((s: any) => (
                <div key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div onClick={() => setExpSeller(expSeller === s.id ? null : s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                    <span style={{ fontSize: 18 }}>{s.eng.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontFamily: 'Outfit' }}>{s.nome}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{s.produtosTotal} produtos · {fmt(s.vendas)} vendas · {money(s.gmv)}</div>
                    </div>
                    <Pill s={s.eng.tone} />
                    <span className="muted" style={{ fontSize: 12 }}>{expSeller === s.id ? '▲' : '▼'}</span>
                  </div>
                  {expSeller === s.id && (
                    <div style={{ padding: '0 16px 18px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                        <Det l="Produtos" v={`${s.produtosAtivos} ativos / ${s.produtosTotal}`} />
                        <Det l="Vendas pagas" v={fmt(s.vendas)} />
                        <Det l="Faturamento" v={money(s.gmv)} />
                        <Det l="Comissão gerada" v={money(s.comissao)} />
                        <Det l="Ticket médio" v={money(s.ticket)} />
                        <Det l="Última venda" v={s.ultimaVenda ? new Date(s.ultimaVenda).toLocaleDateString('pt-BR') : '—'} />
                        <Det l="Último produto" v={s.ultimoProduto ? new Date(s.ultimoProduto).toLocaleDateString('pt-BR') : '—'} />
                        <Det l="Cadastrado" v={new Date(s.created_at).toLocaleDateString('pt-BR')} />
                        <Det l="Saldo a sacar" v={money(s.aSacar)} />
                        <Det l="Já sacado" v={money(s.sacado)} />
                        <Det l="Destaques pagos" v={fmt(s.destaques)} />
                        <Det l="Nota média" v={s.notaMedia ? s.notaMedia.toFixed(1) + ' ★' : '—'} />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <a className="adm-btn" href={`/loja/${s.slug}`} target="_blank" rel="noreferrer">Ver loja pública ›</a>
                      </div>
                    </div>
                  )}
                </div>
              )) : <div className="adm-empty" style={{ padding: 20 }}>Nenhum vendedor neste filtro.</div>}
            </div>
          </>
          );
        })()}

        {tab === 'produtos' && (
          <>
            <h1 className="adm-h">Produtos</h1>
            <p className="adm-sub">Catálogo completo da plataforma.</p>
            <div className="adm-card">
              {allProducts.length ? (
                <table className="adm-table">
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Preço</th><th>Vendas</th><th>Status</th></tr></thead>
                  <tbody>
                    {allProducts.map((p: any) => (
                      <tr key={p.id}>
                        <td><span className="em">{p.emoji}</span> {p.titulo}</td>
                        <td style={{ color: 'var(--sub)' }}>{p.stores?.nome ?? '—'}</td>
                        <td>{money(p.preco_promo ?? p.preco)}</td>
                        <td>{fmt(p.vendas)}</td>
                        <td><Pill s={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="adm-empty">Nenhum produto ainda.</div>}
            </div>
          </>
        )}

        {tab === 'saques' && (
          <>
            <h1 className="adm-h">Saques</h1>
            <p className="adm-sub">Repasses solicitados pelos vendedores. Faça o Pix e marque como pago.</p>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic">💸</div><b>{money(metrics.aRepassar)}</b><small>A repassar agora</small></div>
              <div className="adm-stat"><div className="ic">⏳</div><b>{fmt(metrics.saquesPendentes)}</b><small>Saques pendentes</small></div>
            </div>
            <div className="adm-card">
              {payoutList.length ? (
                <table className="adm-table">
                  <thead><tr><th>Vendedor</th><th>Valor</th><th>Chave Pix</th><th>Status</th><th>Data</th><th></th></tr></thead>
                  <tbody>
                    {payoutList.map((p: any) => (
                      <tr key={p.id}>
                        <td><b style={{ fontFamily: 'Outfit' }}>{p.stores?.nome ?? '—'}</b></td>
                        <td style={{ color: 'var(--or2)', fontFamily: 'Outfit', fontWeight: 800 }}>{money(p.valor)}</td>
                        <td style={{ color: 'var(--sub)' }}>{p.pix_tipo ? p.pix_tipo.toUpperCase() + ': ' : ''}{p.pix_key ?? '—'}</td>
                        <td><Pill s={p.status === 'solicitado' ? 'pendente' : p.status === 'pago' ? 'pago' : 'reprovado'} /></td>
                        <td style={{ color: 'var(--sub)' }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>
                          {p.status === 'solicitado' && (
                            <span style={{ display: 'flex', gap: 6 }}>
                              <button className="adm-btn ap" disabled={busy === p.id} onClick={() => moderarSaque(p.id, 'pagar')}>Marcar pago</button>
                              <button className="adm-btn rp" disabled={busy === p.id} onClick={() => moderarSaque(p.id, 'recusar')}>Recusar</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="adm-empty">Nenhum saque solicitado.</div>}
            </div>
          </>
        )}

        {tab === 'destaques' && (
          <>
            <h1 className="adm-h">Destaques</h1>
            <p className="adm-sub">Receita de divulgação (planos de destaque pagos pelos vendedores).</p>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic">💰</div><b>{money(metrics.receitaDivulgacao)}</b><small>Receita total de divulgação</small></div>
              <div className="adm-stat"><div className="ic">⭐</div><b>{fmt(metrics.destaquesAtivos)}</b><small>Destaques ativos agora</small></div>
            </div>
            <div className="adm-card">
              {boostList.length ? (
                <table className="adm-table">
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Plano</th><th>Valor</th><th>Status</th><th>Expira</th></tr></thead>
                  <tbody>
                    {boostList.map((b: any) => (
                      <tr key={b.id}>
                        <td><span className="em">{b.products?.emoji ?? '📦'}</span> {b.products?.titulo ?? '—'}</td>
                        <td style={{ color: 'var(--sub)' }}>{b.stores?.nome ?? '—'}</td>
                        <td>{b.dias} dias</td>
                        <td style={{ color: 'var(--or2)', fontFamily: 'Outfit', fontWeight: 800 }}>{money(b.valor)}</td>
                        <td><Pill s={b.status === 'pago' ? 'pago' : b.status === 'pendente' ? 'pendente' : 'reprovado'} /></td>
                        <td style={{ color: 'var(--sub)' }}>{b.expira_em ? new Date(b.expira_em).toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="adm-empty">Nenhum destaque vendido ainda.</div>}
            </div>
          </>
        )}

        {tab === 'crescimento' && (
          <>
            <h1 className="adm-h">Crescimento</h1>
            <p className="adm-sub">Quem mais vende e o que mais vende na plataforma.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
              <div className="adm-card">
                <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, marginBottom: 12 }}>🏪 Top vendedores (faturamento)</h3>
                {growth?.topVendedores?.length ? (
                  <table className="adm-table"><tbody>
                    {growth.topVendedores.map((v: any, i: number) => (
                      <tr key={i}><td>{i + 1}. {v.nome}</td><td style={{ textAlign: 'right', fontFamily: 'Outfit', fontWeight: 800, color: 'var(--or2)' }}>{money(v.total)}</td></tr>
                    ))}
                  </tbody></table>
                ) : <div className="adm-empty">Sem vendas ainda.</div>}
              </div>
              <div className="adm-card">
                <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, marginBottom: 12 }}>📦 Top produtos (vendas)</h3>
                {growth?.topProdutos?.length ? (
                  <table className="adm-table"><tbody>
                    {growth.topProdutos.map((p: any, i: number) => (
                      <tr key={p.id}><td><span className="em">{p.emoji}</span> {p.titulo}</td><td style={{ textAlign: 'right', fontFamily: 'Outfit', fontWeight: 800 }}>{fmt(p.vendas || 0)} vendas</td></tr>
                    ))}
                  </tbody></table>
                ) : <div className="adm-empty">Sem produtos ainda.</div>}
              </div>
            </div>
          </>
        )}

        {tab === 'config' && (
          <>
            <h1 className="adm-h">Configurações</h1>
            <p className="adm-sub">Ajuste a comissão, os preços de destaque e o e-mail de suporte — sem mexer no código.</p>
            <SettingsForm settings={settings} />
          </>
        )}
      </main>
    </div>
  );
}
