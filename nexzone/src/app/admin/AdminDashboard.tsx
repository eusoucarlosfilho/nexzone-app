'use client';
import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import SettingsForm from './SettingsForm';
import TorpedosForm from './TorpedosForm';
import PromoForm from './PromoForm';
import OrderChat from '@/components/OrderChat';
import AdminNotes from './AdminNotes';
import AudienceTab from './AudienceTab';
import ProvaSocialForm from './ProvaSocialForm';
import SupportTab from './SupportTab';
import SuporteConfig from './SuporteConfig';
import { ehJogos } from '@/lib/categorias';
import Icon from '@/components/Icon';
import ProductThumb from '@/components/ProductThumb';

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
  pausado: ['#8A8AA0', 'Pausado'],
};

export default function AdminDashboard({ adminEmail, users, metrics, daily, orders, products, stores, payouts, boosts, settings, growth, sellers, complaints, alerts }: any) {
  const [tab, setTab] = useState('cockpit');
  // Link "Abrir no Admin" dos e-mails do suporte: /admin?suporte=CB-AAAA-000001
  const [suporteProtocolo, setSuporteProtocolo] = useState<string | null>(null);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('suporte');
      if (p) { setSuporteProtocolo(p.trim().toUpperCase()); setTab('suporte'); }
    } catch {}
  }, []);

  // Controle dos "badges" (números) do menu. Ao clicar numa aba, o número
  // atual é marcado como "visto" e some — só reaparece se o número aumentar
  // (ex.: chegou uma nova reclamação/loja pendente). Persiste no navegador.
  const [seenBadges, setSeenBadges] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const s = localStorage.getItem('cb_admin_seen_badges');
      if (s) setSeenBadges(JSON.parse(s) || {});
    } catch {}
  }, []);
  function irPara(id: string, badge: number) {
    setTab(id);
    if (badge > 0) {
      setSeenBadges((prev) => {
        const next = { ...prev, [id]: badge };
        try { localStorage.setItem('cb_admin_seen_badges', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }
  const [chatOrder, setChatOrder] = useState<string | null>(null);
  const [complaintList, setComplaintList] = useState<any[]>(complaints || []);
  const [recTab, setRecTab] = useState<'pendentes' | 'resolvidas'>('pendentes');
  async function pegarReclamacao(id: string) {
    setBusy(id);
    const r = await fetch('/api/admin/complaint-claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ complaintId: id }),
    });
    setBusy(null);
    if (r.ok) {
      setComplaintList((l) => l.map((c) => c.id === id ? { ...c, atendido_por: 'eu', atendente_email: adminEmail } : c));
      toast('Você pegou esta reclamação.', 'success');
    } else toast('Falha ao pegar.', 'error');
  }
  async function resolverReclamacao(id: string) {
    setBusy(id);
    const r = await fetch('/api/admin/complaint-resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ complaintId: id }),
    });
    setBusy(null);
    if (r.ok) {
      setComplaintList((l) => l.map((c) => c.id === id
        ? { ...c, status: 'resolvida', resolvido_por: 'eu', resolvedor_email: adminEmail, resolvida_em: new Date().toISOString() }
        : c));
      toast('Reclamação resolvida.', 'success');
    } else toast('Falha ao resolver.', 'error');
  }
  const recPendentes = complaintList.filter((c: any) => c.status === 'aberta');
  const recResolvidas = complaintList.filter((c: any) => c.status === 'resolvida');

  // ===== Painel de usuários =====
  const [userList, setUserList] = useState<any[]>(users || []);
  const [userQuery, setUserQuery] = useState('');
  const [userFiltro, setUserFiltro] = useState<'todos' | 'vendedores' | 'compradores' | 'flag'>('todos');
  const [expUser, setExpUser] = useState<string | null>(null);

  async function userAction(userId: string, action: string, texto?: string) {
    setBusy(userId + ':' + action);
    const r = await fetch('/api/admin/user-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ userId, action, texto }),
    });
    const d = await r.json();
    setBusy(null);
    if (!r.ok) { toast(d.error || 'Falha na ação', 'error'); return; }
    if (action === 'aviso') { toast('Aviso enviado ao usuário.', 'success'); return; }
    if (action === 'advertencia') { toast('Advertência registrada.', 'success'); return; }
    setUserList((l) => l.map((u) => u.id === userId ? { ...u, status: d.status } : u));
    toast(action === 'block' ? 'Usuário bloqueado.' : action === 'restrict' ? 'Usuário restrito.' : 'Status liberado.', 'success');
  }
  // "Vender como Comprei Barato" (ocultar o vendedor no site público) — por loja, só admin
  async function alternarVisibilidade(u: any) {
    const ligar = !u.seller?.ocultarVendedor;
    if (ligar && !confirm('Os produtos desta loja vão aparecer como vendidos pelo Comprei Barato. O nome da loja fica visível só no Admin.')) return;
    setBusy(u.id + ':visibilidade');
    try {
      const r = await fetch('/api/admin/store-visibility', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ store_id: u.seller.id, ocultar: ligar }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Falha ao alterar', 'error'); return; }
      setUserList((l) => l.map((x) => x.id === u.id ? { ...x, seller: { ...x.seller, ocultarVendedor: d.ocultar_vendedor === true } } : x));
      toast(d.ocultar_vendedor ? 'Loja vendendo como Comprei Barato.' : 'Loja voltou a aparecer com o próprio nome.', 'success');
    } catch {
      toast('Falha de conexão', 'error');
    } finally { setBusy(null); }
  }
  function avisar(userId: string, tipo: 'aviso' | 'advertencia') {
    const t = window.prompt(tipo === 'aviso' ? 'Mensagem do aviso para o usuário:' : 'Texto da advertência:');
    if (t && t.trim()) userAction(userId, tipo, t.trim());
  }
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('adm-theme');
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {}
  }, []);
  function toggleTheme() {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('adm-theme', next); } catch {}
      return next;
    });
  }
  const [queue, setQueue] = useState(products.filter((p: any) => p.status === 'em_revisao'));
  const [allProducts, setAllProducts] = useState(products);
  // Aba Produtos: busca, filtros e paginação (só visualização; não muda a moderação)
  const [prodQuery, setProdQuery] = useState('');
  const [prodStatus, setProdStatus] = useState('todos');
  const [prodCat, setProdCat] = useState('');
  const [prodPage, setProdPage] = useState(1);
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
    ['cockpit', 'cockpit', 'Dashboard', 0],
    ['audiencia', 'activity', 'Audiência', 0],
    ['aprovacao', 'check', 'Aprovação', queue.length],
    ['pedidos', 'receipt', 'Pedidos', 0],
    ['vendedores', 'store', 'Usuários', metrics.lojasPendentes],
    ['produtos', 'package', 'Produtos', 0],
    ['saques', 'money', 'Saques', metrics.saquesPendentes],
    ['destaques', 'star', 'Destaques', metrics.destaquesAtivos],
    ['crescimento', 'growth', 'Crescimento', 0],
    ['reclamacoes', 'shield', 'Reclamações', recPendentes.length],
    ['suporte', 'help', 'Suporte', metrics.suporteAbertos || 0],
    ['observacoes', 'chat', 'Observações', 0],
    ['torpedos', 'bell', 'Torpedos enviados', 0],
    ['promocoes', 'megaphone', 'Enviar promoção', 0],
    ['provasocial', 'shield', 'Prova social', 0],
    ['config', 'settings', 'Configurações', 0],
  ];

  const maxDay = Math.max(1, ...daily.map((d: any) => d.total));
  const filteredOrders = orderFilter === 'todos' ? orderList : orderList.filter((o: any) => o.status === orderFilter);

  const Pill = ({ s }: { s: string }) => {
    const [c, label] = STATUS[s] || ['#9E9EBA', s];
    return <span className="adm-pill" style={{ color: c, background: c + '22' }}>{label}</span>;
  };

  return (
    <div className={`adm ${theme}`}>
      <style>{`
        .adm{--bg:#0F0F1A;--panel:#181828;--panel2:#1E1E30;--bd:#22223A;--bd2:#26263A;--tx:#F4F4FA;--sub:#A9A9C2;--or:#FF7A14;--or2:#FF9A3C;--grad:linear-gradient(135deg,#FF6B00,#FF9A3C);min-height:100vh;background:var(--bg);color:var(--tx);font-family:'Nunito',sans-serif;display:flex;}
        .adm.light{--bg:#F7F4F0;--panel:#FFFFFF;--panel2:#F3EEE8;--bd:#EDE6DF;--bd2:#EDE6DF;--tx:#16162A;--sub:#5A5A72;}
        .adm.light .adm-stat,.adm.light .adm-card{box-shadow:0 1px 3px rgba(20,20,40,.05);}
        .adm *{box-sizing:border-box;}
        .adm-side{width:240px;background:var(--panel);overflow-y:auto;border-right:1px solid var(--bd2);padding:22px 14px;flex-shrink:0;display:flex;flex-direction:column;gap:4px;position:sticky;top:0;height:100vh;}
        .adm-logo{font-family:'Outfit';font-weight:900;font-size:22px;letter-spacing:-1px;padding:0 8px 18px;}
        .adm-logo span{color:var(--or2);}
        .adm-nav{display:flex;align-items:center;gap:11px;padding:10px 13px;min-height:44px;border-radius:12px;font-family:'Nunito';font-weight:800;font-size:14px;color:var(--sub);background:none;border:none;cursor:pointer;width:100%;text-align:left;transition:background .18s,color .18s,transform .18s var(--ease);}
        .adm-nav:hover{background:var(--panel2);color:var(--tx);transform:translateX(3px);}
        .adm-nav.on{background:#FF6B00;color:#16162A;box-shadow:0 8px 20px rgba(255,107,0,.25);}
        .adm-nav .bd{margin-left:auto;background:#FF5C5C;color:#fff;font-size:12px;font-weight:900;border-radius:50px;padding:1px 8px;animation:cb-pop .4s both;}.adm-nav.on .bd{background:#16162A;}
        .adm-foot{margin-top:auto;border-top:1px solid var(--bd2);padding-top:12px;}
        .adm-foot a{display:block;padding:9px 13px;font-size:13px;color:var(--sub);text-decoration:none;border-radius:9px;font-family:'Outfit';font-weight:600;}
        .adm-foot a:hover{background:var(--panel2);color:var(--tx);}
        .adm-main{flex:1;padding:28px 32px 60px;min-width:0;}.adm-main>*{animation:cb-up .45s var(--ease) both;}
        .adm-h{font-family:'Outfit';font-size:30px;font-weight:900;letter-spacing:-.9px;margin:0 0 4px;}
        .adm-sub{color:var(--sub);font-size:14px;margin:0 0 26px;}
        .adm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin-bottom:24px;}
        .adm-stat{background:var(--panel);border:1px solid var(--bd2);border-radius:20px;padding:20px;transition:transform .2s var(--ease),border-color .2s;animation:cb-up .5s var(--ease) both;}.adm-stat:hover{transform:translateY(-3px);border-color:#FF8A3D;}
        .adm-stat .ic{width:40px;height:40px;border-radius:11px;background:#FF7A1420;color:var(--or2);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;}
        .adm-stat b{font-family:'Outfit';font-size:27px;font-weight:900;display:block;letter-spacing:-.7px;}
        .adm-stat small{color:var(--sub);font-size:12px;font-weight:700;}
        .adm-card{background:var(--panel);border:1px solid var(--bd2);border-radius:20px;padding:22px;margin-bottom:20px;}
        .adm-ct{font-family:'Outfit';font-weight:800;font-size:18px;margin:0 0 16px;}
        .adm-bars{display:flex;align-items:flex-end;gap:10px;height:180px;}
        .adm-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:flex-end;height:100%;}
        .adm-bar .b{width:100%;max-width:38px;background:#3A2A55;border-radius:8px 8px 3px 3px;min-height:4px;transition:background .2s;transform-origin:bottom;animation:cb-grow .9s var(--ease) both;}.adm-bar:hover .b{background:#FF8A3D;}.adm.light .adm-bar .b{background:#FFCBA1;}.adm.light .adm-bar:hover .b{background:#FF6B00;}
        .adm-bar .l{font-size:11px;color:var(--sub);font-weight:700;}
        .adm-bar .v{font-size:11px;color:var(--tx);font-weight:800;font-family:'Outfit';}
        .adm-table{width:100%;border-collapse:collapse;font-size:13px;}
        .adm-table th{text-align:left;color:var(--sub);font-family:'Outfit';font-weight:700;font-size:11px;letter-spacing:.5px;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--bd2);}
        .adm-table td{padding:13px 12px;border-bottom:1px solid var(--bd);}.adm-table tbody tr{transition:background .15s;}.adm-table tbody tr:hover{background:var(--panel2);}
        .adm-table tr:last-child td{border-bottom:none;}
        .adm-table .em{font-size:18px;}
        .adm-pill{font-size:12px;font-weight:900;padding:4px 10px;border-radius:50px;white-space:nowrap;}
        .adm-row{display:flex;align-items:center;gap:13px;padding:14px 0;border-bottom:1px solid var(--bd);}
        .adm-row:last-child{border-bottom:none;}
        .adm-row .em{width:42px;height:42px;border-radius:11px;background:var(--panel2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
        .adm-row .info{flex:1;min-width:0;}
        .adm-row .info b{font-family:'Outfit';font-size:14px;display:block;}
        .adm-row .info span{font-size:12px;color:var(--sub);}
        .adm-btn{font-family:'Outfit';font-weight:800;font-size:14px;padding:9px 16px;min-height:40px;border-radius:11px;border:none;cursor:pointer;transition:transform .15s,filter .15s;}.adm-btn:hover{transform:translateY(-2px);filter:brightness(1.08);}
        .adm-btn.ap{background:#3DDC97;color:#0F0F1A;}
        .adm-btn.rp{background:none;border:1px solid var(--bd2);color:var(--sub);}
        .adm-btn:disabled{opacity:.5;}
        .adm-filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;}
        .adm-fb{font-weight:800;font-size:13px;padding:8px 15px;min-height:40px;border-radius:50px;background:var(--panel2);color:var(--sub);border:1.5px solid var(--bd2);cursor:pointer;transition:all .15s;}.adm-fb:hover{color:var(--tx);border-color:#FF8A3D;}
        .adm-fb.on{background:var(--tx);color:var(--bg);border-color:var(--tx);}
        .adm-empty{text-align:center;color:var(--sub);padding:40px;font-size:14px;}
        .adm-soon{display:inline-block;font-size:10px;font-weight:800;color:var(--sub);background:var(--panel2);border:1px solid var(--bd2);border-radius:50px;padding:2px 9px;margin-left:8px;}
        @media(max-width:820px){
          .adm{flex-direction:column;}
          /* celular: menu vira uma faixa fixa no topo, com rolagem lateral */
          .adm-side{width:100%;height:auto;position:sticky;top:0;z-index:50;flex-direction:row;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;padding:10px 12px;border-right:none;border-bottom:1px solid var(--bd2);scrollbar-width:none;-webkit-overflow-scrolling:touch;}
          .adm-side::-webkit-scrollbar{display:none;}
          .adm-logo,.adm-who{display:none;}
          .adm-nav{flex:none;width:auto;height:40px;min-height:40px;padding:0 13px;white-space:nowrap;font-size:13px;gap:8px;border-radius:50px;}
          .adm-nav:hover{transform:none;}
          .adm-nav.on{box-shadow:0 4px 12px rgba(255,107,0,.25);}
          .adm-nav .bd{margin-left:4px;}
          .adm-foot{display:flex;flex:none;align-items:center;gap:6px;margin:0;padding:0 0 0 6px;border-top:none;border-left:1px solid var(--bd2);}
          .adm-foot a,.adm-foot form{flex:none;white-space:nowrap;}
          .adm-foot a{padding:0 12px;line-height:40px;}
          .adm-main{padding:18px 14px 50px;}
          .adm-h{font-size:24px;}
        }
      `}</style>

      <aside className="adm-side">
        <div className="adm-logo">Comprei <span>Barato</span></div>
        {adminEmail && (
          <div className="adm-who" style={{ fontSize: 11, color: 'var(--sub)', padding: '0 6px 12px', wordBreak: 'break-all', lineHeight: 1.4 }}>
            Logado como<br /><strong style={{ color: 'var(--tx)' }}>{adminEmail}</strong>
          </div>
        )}
        {NAV.map(([id, ic, label, badge]: any) => (
          <button key={id} className={`adm-nav ${tab === id ? 'on' : ''}`} onClick={() => irPara(id, badge)}>
            <Icon name={ic} /> {label} {badge > (seenBadges[id] || 0) && <span className="bd">{badge}</span>}
          </button>
        ))}
        <div className="adm-foot">
          <button className="adm-nav" onClick={toggleTheme} style={{ marginBottom: 2 }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} /> {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
          <a href="/">← Voltar ao site</a>
          <form action="/auth/signout" method="post"><button className="adm-nav" style={{ color: '#E23B3B' }}><Icon name="logout" size={16} /> Sair</button></form>
        </div>
      </aside>

      <main className="adm-main">
        {tab === 'cockpit' && (
          <>
            <h1 className="adm-h">Dashboard</h1>
            <p className="adm-sub">Visão geral do Comprei Barato em tempo real.</p>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic"><Icon name="money" size={20} /></div><b>{money(metrics.gmv)}</b><small>GMV (volume vendido)</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="growth" size={20} /></div><b>{money(metrics.receita)}</b><small>Sua receita (3%)</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="receipt" size={20} /></div><b>{fmt(metrics.pedidosPagos)}</b><small>Vendas pagas</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="target" size={20} /></div><b>{money(metrics.ticket)}</b><small>Ticket médio</small></div>
            </div>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic"><Icon name="store" size={20} /></div><b>{fmt(metrics.totalLojas)}</b><small>Vendedores</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="package" size={20} /></div><b>{fmt(metrics.totalProdutosAtivos)}</b><small>Produtos ativos</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="users" size={20} /></div><b>{fmt(metrics.buyersCount)}</b><small>Compradores</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="clock" size={20} /></div><b>{fmt(metrics.filaProdutos)}</b><small>Aguardando aprovação</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="star" size={20} /></div><b>{money(metrics.receitaDivulgacao)}</b><small>Receita de divulgação</small></div>
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
                        <td><ProductThumb capa_url={o.products?.capa_url} categoria={o.products?.categoria} titulo={o.products?.titulo} tamanho={28} raio={7} icone={18} style={{ marginRight: 6 }} /> {o.products?.titulo ?? 'Produto'}</td>
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

        {tab === 'audiencia' && <AudienceTab />}

        {tab === 'aprovacao' && (
          <>
            <h1 className="adm-h">Fila de Aprovação</h1>
            <p className="adm-sub">Curadoria = a defesa da plataforma. Aprove só o que mantém a confiança.</p>
            <div className="adm-card">
              {queue.length ? queue.map((p: any) => (
                <div className="adm-row" key={p.id}>
                  <ProductThumb className="em" capa_url={p.capa_url} categoria={p.categoria} titulo={p.titulo} tamanho={42} raio={11} icone={22} />
                  <div className="info"><b>{p.titulo}{ehJogos(p.categoria) && <span title="Categoria Jogos & Games: confira se não é conta compartilhada, 'método', moeda/item de terceiros, key aleatória ou assinatura revendida." style={{ marginLeft: 8, verticalAlign: 1, fontSize: 10.5, fontWeight: 900, fontFamily: 'Outfit', color: '#fff', background: '#7C3AED', borderRadius: 50, padding: '2px 9px', display: 'inline-block' }}>Revisar com atenção</span>}</b><span>{p.stores?.nome ?? '—'} · {p.categoria} · {money(p.preco_promo ?? p.preco)}</span>
                    {Array.isArray(p.imagens) && p.imagens.length > 0 ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {p.imagens.map((u: string, i: number) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" title={i === 0 ? 'Capa — abrir em nova aba' : `Foto ${i + 1} — abrir em nova aba`}
                            style={{ position: 'relative', width: 64, height: 48, borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${i === 0 ? '#FF6B00' : 'var(--bd2)'}`, flexShrink: 0 }}>
                            <img src={u} alt={`Foto ${i + 1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </a>
                        ))}
                      </div>
                    ) : <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--sub)' }}>Sem fotos</span>}
                  </div>
                  <button className="adm-btn ap" disabled={busy === p.id} onClick={() => moderar(p.id, 'aprovar')}>Aprovar</button>
                  <button className="adm-btn rp" disabled={busy === p.id} onClick={() => moderar(p.id, 'reprovar')}>Reprovar</button>
                </div>
              )) : <div className="adm-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="checkCircle" size={18} /> Fila zerada. Nenhum produto aguardando.</div>}
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
                        <td><ProductThumb capa_url={o.products?.capa_url} categoria={o.products?.categoria} titulo={o.products?.titulo} tamanho={28} raio={7} icone={18} style={{ marginRight: 6 }} /> {o.products?.titulo ?? 'Produto'}</td>
                        <td style={{ color: 'var(--sub)' }}>{o.stores?.nome ?? '—'}</td>
                        <td>{money(o.total)}</td>
                        <td style={{ color: 'var(--or2)' }}>{money(o.taxa)}</td>
                        <td><Pill s={o.status} /></td>
                        <td style={{ color: 'var(--sub)' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="adm-btn rp" onClick={() => setChatOrder(o.id)}>Conversa</button>
                          {(o.status === 'pago' || o.status === 'entregue') && <button className="adm-btn rp" disabled={busy === o.id} onClick={() => reembolsar(o.id)}>Reembolsar</button>}
                        </td>
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
          const roleLabel = (r: string) => r === 'admin' ? 'Admin' : r === 'vendedor' ? 'Vendedor' : r === 'ambos' ? 'Cliente + Vendedor' : 'Cliente';
          const badge = (txt: string, bg: string, col: string) => (<span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Outfit', background: bg, color: col, borderRadius: 50, padding: '2px 9px' }}>{txt}</span>);
          const q = userQuery.trim().toLowerCase();
          const lista = (userList || []).filter((u: any) => {
            if (userFiltro === 'vendedores' && !u.seller) return false;
            if (userFiltro === 'compradores' && u.seller) return false;
            if (userFiltro === 'flag' && !(u.status === 'bloqueado' || u.status === 'restrito' || u.reclamacoesAbertas > 0)) return false;
            if (q) { if (!`${u.nome} ${u.email} ${u.id}`.toLowerCase().includes(q)) return false; }
            return true;
          });
          return (
          <>
            <h1 className="adm-h">Usuários</h1>
            <p className="adm-sub">Todos os usuários da plataforma (clientes e vendedores). Clique para ver detalhes e ações.</p>
            <input
              value={userQuery} onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Buscar por e-mail, nome ou ID…"
              style={{ width: '100%', maxWidth: 420, height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 14px', fontSize: 14, marginBottom: 12, background: '#fff' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[['todos', 'Todos'], ['vendedores', 'Vendedores'], ['compradores', 'Clientes'], ['flag', 'Precisam de atenção']].map(([f, label]) => (
                <button key={f} className={`adm-btn ${userFiltro === f ? 'ap' : ''}`} onClick={() => setUserFiltro(f as any)}>{label}</button>
              ))}
            </div>
            <div className="adm-card" style={{ padding: 0 }}>
              {lista.length ? lista.map((u: any) => (
                <div key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div onClick={() => setExpUser(expUser === u.id ? null : u.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontFamily: 'Outfit' }}>{u.nome}</b>
                      <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{u.email}</div>
                    </div>
                    {u.role === 'admin' && badge('Admin', '#EAE6FF', '#5B3FC4')}
                    {u.seller && badge('Vendedor', '#E7F5EC', '#1FA463')}
                    {u.seller?.ocultarVendedor && badge('Vendendo como Comprei Barato', '#FF6B00', '#fff')}
                    {u.status === 'restrito' && badge('Restrito', '#FFF0E0', '#B5650A')}
                    {u.status === 'bloqueado' && badge('Bloqueado', '#FDE7E7', '#C73A3A')}
                    {u.reclamacoesAbertas > 0 && badge(`${u.reclamacoesAbertas} reclamação`, '#FDE7E7', '#C73A3A')}
                    <span className="muted" style={{ fontSize: 12, display: 'inline-flex' }}><Icon name="chevronDown" size={16} style={{ transform: expUser === u.id ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} /></span>
                  </div>
                  {expUser === u.id && (
                    <div style={{ padding: '0 16px 18px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                        <Det l="Tipo" v={roleLabel(u.role)} />
                        <Det l="CB Points" v={fmt(u.cb_points)} />
                        <Det l="Cadastrado" v={new Date(u.created_at).toLocaleDateString('pt-BR')} />
                        {u.seller && <Det l="Produtos" v={`${u.seller.produtosAtivos} ativos / ${u.seller.produtosTotal}`} />}
                        {u.seller && <Det l="Vendas pagas" v={fmt(u.seller.vendas)} />}
                        {u.seller && <Det l="Faturamento" v={money(u.seller.gmv)} />}
                        {u.seller && <Det l="Saldo a sacar" v={money(u.seller.aSacar)} />}
                        {u.seller && <Det l="Nota média" v={u.seller.notaMedia ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{u.seller.notaMedia.toFixed(1)} <Icon name="star" size={13} /></span> : '—'} />}
                        {u.reclamacoesAbertas > 0 && <Det l="Reclamações abertas" v={fmt(u.reclamacoesAbertas)} />}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 10, wordBreak: 'break-all' }}>ID: {u.id}</div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                        {u.seller && !u.seller.ocultarVendedor && <a className="adm-btn" href={`/loja/${u.seller.slug}`} target="_blank" rel="noreferrer">Ver loja pública ›</a>}
                        {u.seller && (
                          <button className="adm-btn" disabled={busy === u.id + ':visibilidade'} onClick={() => alternarVisibilidade(u)}
                            title="Só o admin vê esta opção. Pagamento e repasse continuam indo para a loja."
                            style={u.seller.ocultarVendedor ? { background: '#FF6B00', color: '#fff' } : undefined}>
                            {u.seller.ocultarVendedor ? 'Vendendo como Comprei Barato' : 'Mostrar como vendedor'}
                          </button>
                        )}
                        {u.reclamacoesAbertas > 0 && <button className="adm-btn" onClick={() => setTab('reclamacoes')}>Ver reclamações</button>}
                        <button className="adm-btn" disabled={busy === u.id + ':aviso'} onClick={() => avisar(u.id, 'aviso')}>Mandar aviso</button>
                        <button className="adm-btn" disabled={busy === u.id + ':advertencia'} onClick={() => avisar(u.id, 'advertencia')}>Advertência</button>
                        {u.status === 'restrito'
                          ? <button className="adm-btn" disabled={busy === u.id + ':unrestrict'} onClick={() => userAction(u.id, 'unrestrict')}>Liberar restrição</button>
                          : <button className="adm-btn" disabled={busy === u.id + ':restrict'} onClick={() => { if (confirm('Restringir esta conta? A pessoa poderá comprar, mas não vender nem sacar.')) userAction(u.id, 'restrict'); }}>Restringir</button>}
                        {u.status === 'bloqueado'
                          ? <button className="adm-btn ap" disabled={busy === u.id + ':unblock'} onClick={() => userAction(u.id, 'unblock')}>Desbloquear</button>
                          : <button className="adm-btn" style={{ color: '#C73A3A', borderColor: '#E79A9A' }} disabled={busy === u.id + ':block'} onClick={() => { if (confirm('Bloquear esta conta? A pessoa não conseguirá mais acessar o site.')) userAction(u.id, 'block'); }}>Bloquear</button>}
                      </div>
                    </div>
                  )}
                </div>
              )) : <div className="adm-empty" style={{ padding: 20 }}>Nenhum usuário neste filtro.</div>}
            </div>
          </>
          );
        })()}

        {tab === 'produtos' && (
          <>
            <h1 className="adm-h">Produtos</h1>
            <p className="adm-sub">Catálogo completo da plataforma. A aprovação continua na aba Aprovação.</p>
            {(() => {
              const POR = 50;
              const contagem = (st: string) => allProducts.filter((p: any) => st === 'todos' || p.status === st).length;
              const cats = Array.from(new Set(allProducts.map((p: any) => p.categoria).filter(Boolean))).sort() as string[];
              const t = prodQuery.trim().toLowerCase();
              const lista = allProducts.filter((p: any) =>
                (prodStatus === 'todos' || p.status === prodStatus)
                && (!prodCat || p.categoria === prodCat)
                && (!t || String(p.titulo || '').toLowerCase().includes(t) || String(p.stores?.nome || '').toLowerCase().includes(t)));
              const paginas = Math.max(1, Math.ceil(lista.length / POR));
              const pg = Math.min(prodPage, paginas);
              const vis = lista.slice((pg - 1) * POR, pg * POR);
              return (
                <>
                  <div className="adm-filters">
                    {['todos', 'em_revisao', 'ativo', 'pausado', 'reprovado'].map((f) => (
                      <button key={f} className={`adm-fb ${prodStatus === f ? 'on' : ''}`} aria-pressed={prodStatus === f} onClick={() => { setProdStatus(f); setProdPage(1); }}>
                        {f === 'todos' ? 'Todos' : (STATUS[f]?.[1] ?? f)} · {fmt(contagem(f))}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <input value={prodQuery} onChange={(e) => { setProdQuery(e.target.value); setProdPage(1); }} placeholder="Buscar por produto ou loja…" aria-label="Buscar por produto ou loja"
                      style={{ flex: '1 1 260px', maxWidth: 420, height: 42, borderRadius: 10, border: '1px solid var(--bd2)', padding: '0 14px', fontSize: 14, background: 'var(--panel2)', color: 'var(--tx)' }} />
                    <select value={prodCat} onChange={(e) => { setProdCat(e.target.value); setProdPage(1); }} aria-label="Filtrar por categoria"
                      style={{ height: 42, borderRadius: 10, border: '1px solid var(--bd2)', padding: '0 12px', fontSize: 14, background: 'var(--panel2)', color: 'var(--tx)' }}>
                      <option value="">Todas as categorias</option>
                      {cats.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <p className="adm-sub" style={{ marginTop: 0 }} aria-live="polite">{fmt(lista.length)} produto{lista.length === 1 ? '' : 's'}</p>
            <div className="adm-card" style={{ overflowX: 'auto' }}>
              {vis.length ? (
                <table className="adm-table">
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Categoria</th><th>Preço</th><th>Vendas</th><th>Cadastro</th><th>Status</th></tr></thead>
                  <tbody>
                    {vis.map((p: any) => (
                      <tr key={p.id}>
                        <td><ProductThumb capa_url={p?.capa_url} categoria={p?.categoria} titulo={p?.titulo} tamanho={28} raio={7} icone={18} style={{ marginRight: 6 }} /> {p.titulo}</td>
                        <td style={{ color: 'var(--sub)' }}>{p.stores?.nome ?? '—'}</td>
                        <td style={{ color: 'var(--sub)' }}>{p.categoria ?? '—'}</td>
                        <td>{money(p.preco_promo ?? p.preco)}</td>
                        <td>{fmt(p.vendas)}</td>
                        <td style={{ color: 'var(--sub)', whiteSpace: 'nowrap' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                        <td><Pill s={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="adm-empty">{allProducts.length ? 'Nenhum produto com esses filtros.' : 'Nenhum produto ainda.'}</div>}
            </div>
                  {paginas > 1 && (
                    <div className="adm-filters" style={{ justifyContent: 'center', marginTop: 14 }}>
                      <button className="adm-fb" disabled={pg <= 1} onClick={() => setProdPage(pg - 1)}>‹ Anterior</button>
                      <span className="adm-fb on" aria-current="page">{pg} de {paginas}</span>
                      <button className="adm-fb" disabled={pg >= paginas} onClick={() => setProdPage(pg + 1)}>Próxima ›</button>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {tab === 'saques' && (
          <>
            <h1 className="adm-h">Saques</h1>
            <p className="adm-sub">Repasses solicitados pelos vendedores. Faça o Pix e marque como pago.</p>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic"><Icon name="money" size={20} /></div><b>{money(metrics.aRepassar)}</b><small>A repassar agora</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="clock" size={20} /></div><b>{fmt(metrics.saquesPendentes)}</b><small>Saques pendentes</small></div>
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
              <div className="adm-stat"><div className="ic"><Icon name="money" size={20} /></div><b>{money(metrics.receitaDivulgacao)}</b><small>Receita total de divulgação</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="star" size={20} /></div><b>{fmt(metrics.destaquesAtivos)}</b><small>Destaques ativos agora</small></div>
            </div>
            <div className="adm-card">
              {boostList.length ? (
                <table className="adm-table">
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Plano</th><th>Valor</th><th>Status</th><th>Expira</th></tr></thead>
                  <tbody>
                    {boostList.map((b: any) => (
                      <tr key={b.id}>
                        <td><ProductThumb capa_url={b.products?.capa_url} categoria={b.products?.categoria} titulo={b.products?.titulo} tamanho={28} raio={7} icone={18} style={{ marginRight: 6 }} /> {b.products?.titulo ?? '—'}</td>
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
                <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="store" size={18} /> Top vendedores (faturamento)</h3>
                {growth?.topVendedores?.length ? (
                  <table className="adm-table"><tbody>
                    {growth.topVendedores.map((v: any, i: number) => (
                      <tr key={i}><td>{i + 1}. {v.nome}</td><td style={{ textAlign: 'right', fontFamily: 'Outfit', fontWeight: 800, color: 'var(--or2)' }}>{money(v.total)}</td></tr>
                    ))}
                  </tbody></table>
                ) : <div className="adm-empty">Sem vendas ainda.</div>}
              </div>
              <div className="adm-card">
                <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="package" size={18} /> Top produtos (vendas)</h3>
                {growth?.topProdutos?.length ? (
                  <table className="adm-table"><tbody>
                    {growth.topProdutos.map((p: any, i: number) => (
                      <tr key={p.id}><td><ProductThumb capa_url={p?.capa_url} categoria={p?.categoria} titulo={p?.titulo} tamanho={28} raio={7} icone={18} style={{ marginRight: 6 }} /> {p.titulo}</td><td style={{ textAlign: 'right', fontFamily: 'Outfit', fontWeight: 800 }}>{fmt(p.vendas || 0)} vendas</td></tr>
                    ))}
                  </tbody></table>
                ) : <div className="adm-empty">Sem produtos ainda.</div>}
              </div>
            </div>
          </>
        )}

        {tab === 'reclamacoes' && (() => {
          const lista = recTab === 'pendentes' ? recPendentes : recResolvidas;
          const Card = ({ c }: any) => {
            const o: any = c.orders || {};
            const resolvida = c.status === 'resolvida';
            return (
              <div key={c.id} className="adm-card" style={{ borderLeft: `3px solid ${resolvida ? '#1FA463' : '#E23B3B'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <ProductThumb capa_url={o.products?.capa_url} categoria={o.products?.categoria} titulo={o.products?.titulo} tamanho={42} raio={11} icone={20} style={{ background: 'var(--panel2)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontFamily: 'Outfit', fontSize: 14 }}>{o.products?.titulo ?? 'Produto'}</strong>
                    <div style={{ color: 'var(--sub)', fontSize: 12 }}>{o.stores?.nome ?? '—'} · {o.comprador_email ?? 'Cliente'} · {money(o.total ?? 0)} · {new Date(c.created_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
                <div style={{ background: 'var(--panel2)', borderRadius: 10, padding: 12, fontSize: 13.5, color: 'var(--tx)', whiteSpace: 'pre-wrap' }}>{c.texto}</div>

                {/* Quem está atendendo / quem resolveu */}
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--sub)' }}>
                  {resolvida
                    ? <><Icon name="checkCircle" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Resolvida por <strong style={{ color: 'var(--tx)' }}>{c.resolvedor_email || c.atendente_email || 'admin'}</strong>{c.resolvida_em ? ` · ${new Date(c.resolvida_em).toLocaleDateString('pt-BR')}` : ''}</>
                    : c.atendente_email
                      ? <><Icon name="user" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Em atendimento por <strong style={{ color: 'var(--tx)' }}>{c.atendente_email}</strong></>
                      : <><Icon name="hourglass" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Ninguém pegou ainda</>}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {o.id && <button className="adm-btn rp" onClick={() => setChatOrder(o.id)}>Abrir conversa</button>}
                  {!resolvida && !c.atendente_email && (
                    <button className="adm-btn" disabled={busy === c.id} onClick={() => pegarReclamacao(c.id)}>{busy === c.id ? '…' : 'Pegar para atender'}</button>
                  )}
                  {!resolvida && (
                    <button className="adm-btn ap" disabled={busy === c.id} onClick={() => resolverReclamacao(c.id)}>{busy === c.id ? '…' : 'Marcar como resolvida'}</button>
                  )}
                </div>
              </div>
            );
          };
          return (
          <>
            <h1 className="adm-h">Reclamações</h1>
            <p className="adm-sub">Enquanto a reclamação está pendente, o saldo da venda fica retido. Pegue para atender, converse pela conversa do pedido e marque como resolvida.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button className={`adm-btn ${recTab === 'pendentes' ? 'ap' : ''}`} onClick={() => setRecTab('pendentes')}>Pendentes ({recPendentes.length})</button>
              <button className={`adm-btn ${recTab === 'resolvidas' ? 'ap' : ''}`} onClick={() => setRecTab('resolvidas')}>Resolvidas ({recResolvidas.length})</button>
            </div>
            {lista.length === 0 ? (
              <div className="adm-card"><p style={{ color: 'var(--sub)', textAlign: 'center', padding: 20 }}>{recTab === 'pendentes' ? 'Nenhuma reclamação pendente.' : 'Nenhuma reclamação resolvida ainda.'}</p></div>
            ) : (
              lista.map((c: any) => <Card key={c.id} c={c} />)
            )}
          </>
          );
        })()}

        {tab === 'observacoes' && <AdminNotes adminEmail={adminEmail} />}

        {tab === 'torpedos' && (
          <>
            <h1 className="adm-h">Torpedos enviados</h1>
            <p className="adm-sub">Avisos automáticos para o vendedor quando ele demora a responder o cliente no chat. Configure o tempo e os canais (e-mail/SMS).</p>
            <div style={{ marginBottom: 22 }}>
              <TorpedosForm settings={settings} />
            </div>
            <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 16, margin: '8px 0 12px' }}>Histórico de envios</h2>
            {(!alerts || alerts.length === 0) ? (
              <div className="adm-card"><p style={{ color: 'var(--sub)', textAlign: 'center', padding: 18 }}>Nenhum aviso enviado ainda.</p></div>
            ) : (
              <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
                {alerts.map((a: any, i: number) => {
                  const o: any = a.orders || {};
                  const cor = a.status === 'enviado' ? 'var(--green)' : a.status === 'falha' ? '#E23B3B' : '#C98A00';
                  const rotulo = a.status === 'enviado' ? 'Enviado' : a.status === 'falha' ? 'Falha' : 'Pendente config';
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'var(--panel2)', color: 'var(--sub)' }}>{a.canal}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 13.5 }}>{o.products?.titulo ?? 'Pedido'} <span style={{ color: 'var(--sub)', fontWeight: 500 }}>· {o.stores?.nome ?? '—'}</span></div>
                        <div style={{ color: 'var(--sub)', fontSize: 12 }}>{a.destino || 'sem destino'} · {a.detalhe} · {new Date(a.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <span style={{ color: cor, fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{rotulo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'promocoes' && (
          <>
            <h1 className="adm-h">Enviar promoção</h1>
            <p className="adm-sub">Mande uma promoção por e-mail só para quem aceitou receber. Envie um teste para você antes.</p>
            <PromoForm />
          </>
        )}

        {tab === 'provasocial' && (
          <>
            <h1 className="adm-h">Prova social</h1>
            <p className="adm-sub">Escolha o que a página inicial mostra. Sempre com os dados reais da plataforma.</p>
            <ProvaSocialForm settings={settings} />
          </>
        )}

        {tab === 'suporte' && (
          <SupportTab protocoloInicial={suporteProtocolo} onVerPedidos={() => irPara('pedidos', 0)} />
        )}

        {tab === 'config' && (
          <>
            <h1 className="adm-h">Configurações</h1>
            <p className="adm-sub">Ajuste a comissão, os preços de destaque e o e-mail de suporte — sem mexer no código.</p>
            <SettingsForm settings={settings} />
            <SuporteConfig inicial={settings.suporte} />
          </>
        )}
      </main>

      {chatOrder && (
        <div onClick={() => setChatOrder(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontFamily: 'Outfit', color: '#fff', fontSize: 16 }}>Conversa do pedido (suporte)</strong>
              <button onClick={() => setChatOrder(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 26, lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>
            <OrderChat orderId={chatOrder} theme="dark" moderator />
          </div>
        </div>
      )}
    </div>
  );
}
