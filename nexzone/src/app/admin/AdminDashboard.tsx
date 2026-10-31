'use client';
import { useState, useEffect, Fragment } from 'react';
import { toast } from '@/lib/toast';
import SettingsForm from './SettingsForm';
import TorpedosForm from './TorpedosForm';
import WhatsAppPainel from './WhatsAppPainel';
import WhatsAppLog from './WhatsAppLog';
import PromoForm from './PromoForm';
import OrderChat from '@/components/OrderChat';
import AudienceTab from './AudienceTab';
import InteligenciaComercial from './InteligenciaComercial';
import OfertasDiaAdmin from './OfertasDiaAdmin';
import IndicacoesAdmin from './IndicacoesAdmin';
import ProvaSocialForm from './ProvaSocialForm';
import SupportTab from './SupportTab';
import SuporteConfig from './SuporteConfig';
import UsersPanel from './v3/UsersPanel';
import GrowthPanel from './v3/GrowthPanel';
import { ehJogos } from '@/lib/categorias';
import { TIPOS_ANUNCIO } from '@/lib/taxas';
import { mensagemRecuperacao, linkWhatsapp, foneLegivel } from '@/lib/recuperacaoVenda';
import Icon from '@/components/Icon';
import ProductThumb from '@/components/ProductThumb';
import ProdutoGerenciar from './ProdutoGerenciar';
import { FormMotivo } from './ModeracaoAnuncio';
import { rotuloItem } from '@/lib/moderacao';
import AlteracoesAnuncio from './AlteracoesAnuncio';
import AvisosSino from './AvisosSino';
import PainelVendas from './PainelVendas';
import Reembolsos from './Reembolsos';
import Verificacoes from './Verificacoes';
import ProdutoresInteressados from './ProdutoresInteressados';
import SeoGoogle from './SeoGoogle';
import TaxasPlanos from './TaxasPlanos';
import DadosEmpresa from './DadosEmpresa';
import CampanhasConfig from './CampanhasConfig';
import CrescimentoAdmin from './CrescimentoAdmin';
import FinanceiroPainel from './FinanceiroPainel';
import RecuperacaoVendas from './RecuperacaoVendas';
import { registrarContatoRecuperacao } from '@/lib/recuperacaoCliente';
import { chaveRecuperacao } from '@/lib/filaRecuperacao';
import CarrinhosAbandonados from '@/components/CarrinhosAbandonados';
import AtivarCelular from '@/components/AtivarCelular';
import CaixaEmail, { type PedidoEmail } from './CaixaEmail';
import CampanhasAdmin from './CampanhasAdmin';
import { PRESETS, intervalo, dentro, hojeYMD, type Preset } from '@/lib/periodo';
import { escreverEmail, EVENTO_ESCREVER } from '@/lib/escreverEmail';
import PainelAprovacaoAuto, { AnaliseResumo, itensSugeridos } from './AprovacaoInteligente';
import RegistroAdmin from './RegistroAdmin';

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

// ---------- Crescimento: páginas com sub-abas ----------
const SUBS: Record<string, [string, string][]> = {
  inteligencia: [['vendas', 'Vendas e funil'], ['audiencia', 'Audiência e sessões'], ['ativacao', 'Cadastros e ativação']],
  campanhas: [['calendario', 'Calendário e banners'], ['black', 'Black November'], ['vitrine', 'Vitrine da home'], ['promocoes', 'Promoções de taxa']],
  recompensas: [['indicacoes', 'Indicações'], ['cashback', 'Cashback em CB Points']],
  comunicacao: [['email', 'E-mail promocional'], ['sino', 'Avisos no sino'], ['canais', 'Canais de ofertas']],
};
const ABA_ANTIGA: Record<string, [string, string]> = {
  audiencia: ['inteligencia', 'audiencia'], crescimento: ['campanhas', 'black'], ofertasdia: ['campanhas', 'vitrine'],
  provasocial: ['campanhas', 'vitrine'], indicacoes: ['recompensas', 'indicacoes'], promocoes: ['comunicacao', 'email'], avisos: ['comunicacao', 'sino'],
};
function SubAbas({ valor, opcoes, onChange }: { valor: string; opcoes: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="adm-subabas" role="tablist">
      {opcoes.map(([id, rot]) => (
        <button key={id} type="button" role="tab" aria-selected={valor === id} className={valor === id ? 'on' : ''} onClick={() => onChange(id)}>{rot}</button>
      ))}
    </div>
  );
}

export default function AdminDashboard({ painel, adminEmail, users, metrics, daily, orders, products, stores, payouts, boosts, settings, growth, sellers, complaints, alerts, carrinhos = [] }: any) {
  const [tab, setTab] = useState('cockpit');
  // Sub-abas das páginas de Crescimento (lembradas por página enquanto o painel está aberto)
  const [subs, setSubs] = useState<Record<string, string>>({});
  const subDe = (t: string) => subs[t] || SUBS[t]?.[0]?.[0] || '';
  const mudarSub = (t: string, v: string) => setSubs((m) => ({ ...m, [t]: v }));
  // Endereços antigos (?aba=…, atalhos e favoritos) caem na página e sub-aba novas
  useEffect(() => {
    const destino = ABA_ANTIGA[tab];
    if (destino) { setSubs((m) => ({ ...m, [destino[0]]: destino[1] })); setTab(destino[0]); }
  }, [tab]);
  // celular e tablet: o menu lateral fica escondido e abre pelo botão Menu
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => { setMenuAberto(false); }, [tab]);
  useEffect(() => { if (!menuAberto) return; const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAberto(false); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [menuAberto]);
  // Link "Abrir no Admin" dos e-mails do suporte: /admin?suporte=CB-AAAA-000001
  const [suporteProtocolo, setSuporteProtocolo] = useState<string | null>(null);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('suporte');
      if (p) { setSuporteProtocolo(p.trim().toUpperCase()); setTab('suporte'); }
      const aba = new URLSearchParams(window.location.search).get('aba');
      if (aba && /^[a-z]{3,20}$/.test(aba)) setTab(aba);
      // aviso de mensagem retida: abre a conversa direto (?chat=<pedido>)
      const chat = new URLSearchParams(window.location.search).get('chat');
      if (chat && /^[0-9a-f-]{36}$/i.test(chat)) setChatOrder(chat);
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
  const [usuariosClassico, setUsuariosClassico] = useState(false);

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
  // fila: os de maior risco primeiro (análise automática, SQL 35); sem análise, ordem de chegada
  const [queue, setQueue] = useState(products.filter((p: any) => p.status === 'em_revisao').sort((a: any, b: any) => (Number(b.analise?.score) || 0) - (Number(a.analise?.score) || 0)));
  const [allProducts, setAllProducts] = useState(products);
  // Aba Produtos: busca, filtros e paginação (só visualização; não muda a moderação)
  const [prodQuery, setProdQuery] = useState('');
  const [prodStatus, setProdStatus] = useState('todos');
  const [prodCat, setProdCat] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const [prodAberto, setProdAberto] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState('todos');
  // Período dos pedidos (horário de Brasília): hoje, ontem, mês, um dia, um mês, de… até…
  const [periodo, setPeriodo] = useState<Preset>('tudo');
  const [perV, setPerV] = useState<{ dia: string; mes: string; de: string; ate: string }>(() => ({ dia: hojeYMD(), mes: hojeYMD().slice(0, 7), de: '', ate: hojeYMD() }));
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

  // Fila: "Pedir correção" com checklist (SQL 14). Sem o SQL 14, cai no "Reprovar" antigo.
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  async function pedirCorrecao(id: string, itens: string[], texto: string) {
    setBusy(id);
    try {
      const r = await fetch('/api/admin/moderacao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, acao: 'correcao', itens, texto }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setQueue((q: any[]) => q.filter((p) => p.id !== id));
        setAllProducts((ps: any[]) => ps.map((p) => p.id === id ? { ...p, status: d.status } : p));
        setCorrigindo(null);
        toast('Correção pedida. O vendedor foi avisado.', 'success');
      } else if (/SQL 14/.test(String(d.error || ''))) {
        setBusy(null); await moderar(id, 'reprovar'); setCorrigindo(null);
        toast('Reprovado. Rode o SQL 14 para enviar a lista do que corrigir.', 'error');
      } else toast(d.error || 'Falha ao pedir correção.', 'error');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(null); }
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

  // Cliente diz que pagou e o pedido segue pendente: consulta o Pix direto na MisticPay e libera se caiu
  async function conferirPix(id?: string) {
    setBusy(id || 'todos');
    try {
      const r = await fetch('/api/admin/order-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(id ? { id, action: 'conferir' } : { action: 'conferir_todos' }),
      });
      const d = await r.json().catch(() => ({}));
      if (id) {
        if (d.resultado === 'liberado') setOrderList((l: any[]) => l.map((o) => o.id === id ? { ...o, status: 'entregue' } : o));
        toast(d.mensagem || d.error || 'Falha ao conferir.', d.resultado === 'liberado' ? 'success' : r.ok ? 'info' : 'error');
      } else {
        const lib: string[] = d.liberados || [];
        if (lib.length) setOrderList((l: any[]) => l.map((o) => lib.includes(o.id) ? { ...o, status: 'entregue' } : o));
        toast(r.ok ? `${d.conferidos || 0} Pix conferidos na MisticPay · ${lib.length} liberados${d.erros ? ` · ${d.erros} sem resposta` : ''}.` : (d.error || 'Falha ao conferir.'), lib.length ? 'success' : 'info');
      }
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

  const [reembolsosAbertos, setReembolsosAbertos] = useState<number>(Number(metrics.reembolsosAbertos) || 0);
  // Botões "E-mail" do painel: abrem a aba E-mail já escrevendo (lib/escreverEmail.ts)
  const [pedidoEmail, setPedidoEmail] = useState<PedidoEmail | null>(null);
  useEffect(() => {
    (window as any).__cbCaixaNoPainel = true;
    const abrir = (e: Event) => { const d = (e as CustomEvent).detail || {}; setPedidoEmail({ para: d.para, assunto: d.assunto, texto: d.texto, nonce: Date.now() }); setTab('email'); };
    window.addEventListener(EVENTO_ESCREVER, abrir);
    return () => { (window as any).__cbCaixaNoPainel = false; window.removeEventListener(EVENTO_ESCREVER, abrir); };
  }, []);
  // e-mails não lidos da caixa @compreibarato.com.br (badge do menu; confere a cada minuto)
  const [emailsNovos, setEmailsNovos] = useState(0);
  useEffect(() => {
    let vivo = true;
    const ver = () => fetch('/api/admin/email?contagem=1', { credentials: 'include', cache: 'no-store' }).then((r) => r.json()).then((j) => { if (vivo) setEmailsNovos(Number(j?.naoLidos) || 0); }).catch(() => {});
    ver();
    const t = setInterval(() => { if (document.visibilityState === 'visible') ver(); }, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  const [verificacoesPendentes, setVerificacoesPendentes] = useState<number>(Number(metrics.verificacoesPendentes) || 0);
  const [produtoresNovos, setProdutoresNovos] = useState<number>(Number(metrics.produtoresNovos) || 0);
  // Menu em grupos: o dia a dia em cima, crescimento no meio, ajustes embaixo
  const GRUPOS: [string, any[]][] = [
    ['Dia a dia', [
      ['cockpit', 'cockpit', 'Dashboard', 0],
      ['aprovacao', 'check', 'Aprovação', queue.length],
      ['pedidos', 'receipt', 'Pedidos', 0],
      ['email', 'mail', 'E-mail', emailsNovos],
      ['reclamacoes', 'alert', 'Reclamações', recPendentes.length],
      ['reembolsos', 'undo', 'Reembolsos', reembolsosAbertos],
      ['suporte', 'help', 'Suporte', metrics.suporteAbertos || 0],
    ]],
    ['Lojistas e dinheiro', [
      ['produtores', 'rocket', 'Novos lojistas', produtoresNovos],
      ['vendedores', 'store', 'Usuários', metrics.lojasPendentes],
      ['produtos', 'package', 'Produtos', 0],
      ['verificacoes', 'key', 'Verificações', verificacoesPendentes],
      ['saques', 'money', 'Saques', metrics.saquesPendentes],
      ['financeiro', 'wallet', 'Financeiro', 0],
    ]],
    // Crescimento reorganizado (11 → 6): cada item abre uma página com sub-abas; nenhuma função saiu.
    ['Crescimento', [
      ['inteligencia', 'trending', 'Inteligência', 0],
      ['campanhas', 'sparkles', 'Campanhas', 0],
      ['recompensas', 'gift', 'Recompensas', 0],
      ['comunicacao', 'megaphone', 'Comunicação', 0],
      ['seo', 'search', 'SEO e Google', 0],
    ]],
    ['Ajustes', [
      ['registro', 'clock', 'Registro (quem fez)', 0],
      ['torpedos', 'phone', 'WhatsApp e torpedos', 0],
      ['config', 'settings', 'Configurações', 0],
    ]],
  ];
  const NAV = GRUPOS.flatMap(([, itens]) => itens);

  const faixaPeriodo = intervalo(periodo, perV);
  const pedidosNoPeriodo = orderList.filter((o: any) => dentro(o.created_at, faixaPeriodo));
  const filteredOrders = orderFilter === 'todos' ? pedidosNoPeriodo : pedidosNoPeriodo.filter((o: any) => o.status === orderFilter);
  const carrinhosNoPeriodo = (carrinhos || []).filter((c: any) => dentro(c.quando, faixaPeriodo));
  const qtdStatus = (st: string) => pedidosNoPeriodo.filter((o: any) => o.status === st).length;
  // Resumo do período (o que já é dinheiro: pago + entregue)
  const resumoPeriodo = (() => {
    const vendidos = pedidosNoPeriodo.filter((o: any) => o.status === 'pago' || o.status === 'entregue');
    const pend = pedidosNoPeriodo.filter((o: any) => o.status === 'pendente');
    return {
      vendas: vendidos.length, vendido: vendidos.reduce((t: number, o: any) => t + Number(o.total || 0), 0), taxa: vendidos.reduce((t: number, o: any) => t + Number(o.taxa || 0), 0),
      pendentes: pend.length, pendente: pend.reduce((t: number, o: any) => t + Number(o.total || 0), 0), reembolsados: qtdStatus('reembolsado'),
    };
  })();

  const Pill = ({ s }: { s: string }) => {
    const [c, label] = STATUS[s] || ['#9E9EBA', s];
    return <span className="adm-pill" style={{ color: c, background: c + '22' }}>{label}</span>;
  };

  return (
    <div className={`adm ${theme}`}>
      <style dangerouslySetInnerHTML={{ __html: `
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
        .adm-grupo{display:flex;flex-direction:column;gap:2px;margin-bottom:10px;}
        .adm-gt{font-size:10.5px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--sub);opacity:.75;padding:6px 13px 4px;}
        .adm-foot{margin-top:auto;border-top:1px solid var(--bd2);padding-top:12px;}
        .adm-foot a{display:block;padding:9px 13px;font-size:13px;color:var(--sub);text-decoration:none;border-radius:9px;font-family:'Outfit';font-weight:600;}
        .adm-foot a:hover{background:var(--panel2);color:var(--tx);}
        .adm-main{flex:1;padding:28px 32px 60px;min-width:0;}.adm-main>*{animation:cb-up .45s var(--ease) both;}
        .adm-h{font-family:'Outfit';font-size:30px;font-weight:900;letter-spacing:-.9px;margin:0 0 4px;}
        .adm-sub{color:var(--sub);font-size:14px;margin:0 0 26px;}
        .adm-subabas{display:flex;gap:6px;flex-wrap:wrap;margin:-8px 0 20px;padding-bottom:12px;border-bottom:1px solid var(--bd2);}
        .adm-subabas button{border:1px solid var(--bd2);background:var(--panel);color:var(--sub);border-radius:999px;padding:7px 14px;font:800 13px 'Nunito',sans-serif;cursor:pointer;}
        .adm-subabas button:hover{color:var(--tx);}
        .adm-subabas button.on{background:var(--grad);color:#fff;border-color:transparent;}
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
        .adm-periodo{margin-bottom:14px;display:flex;flex-direction:column;gap:12px;}
        .adm-per-l{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .adm-per-l b{display:inline-flex;align-items:center;gap:6px;font-family:'Outfit';font-size:14px;}
        .adm-per-l select,.adm-per-l input{height:38px;border:1px solid var(--bd2);border-radius:10px;padding:0 10px;background:var(--panel2);color:var(--tx);font-family:inherit;font-size:13.5px;font-weight:700;}
        .adm-per-l span{color:var(--sub);font-size:13px;}
        .adm-per-rap{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap;}
        .adm-per-rap button{border:1px solid var(--bd2);background:none;color:var(--sub);border-radius:50px;padding:6px 12px;font-weight:800;font-size:12.5px;cursor:pointer;}
        .adm-per-rap button.on{background:var(--tx);color:var(--bg);border-color:var(--tx);}
        .adm-per-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;}
        .adm-per-res span{background:var(--panel2);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;}
        .adm-per-res small{color:var(--sub);font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;}
        .adm-per-res b{font-family:'Outfit';font-size:17px;}
        @media(max-width:700px){.adm-per-rap{margin-left:0;}}
        .adm-fb{font-weight:800;font-size:13px;padding:8px 15px;min-height:40px;border-radius:50px;background:var(--panel2);color:var(--sub);border:1.5px solid var(--bd2);cursor:pointer;transition:all .15s;}.adm-fb:hover{color:var(--tx);border-color:#FF8A3D;}
        .adm-fb.on{background:var(--tx);color:var(--bg);border-color:var(--tx);}
        .adm-empty{text-align:center;color:var(--sub);padding:40px;font-size:14px;}
        .adm-soon{display:inline-block;font-size:10px;font-weight:800;color:var(--sub);background:var(--panel2);border:1px solid var(--bd2);border-radius:50px;padding:2px 9px;margin-left:8px;}
        .adm-top,.adm-veu,.adm-x{display:none;}
        @media(max-width:1100px){
          /* celular e tablet: menu escondido, abre como gaveta pelo botão Menu */
          .adm{flex-direction:column;}
          .adm-top{display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:60;background:var(--panel);border-bottom:1px solid var(--bd2);padding:10px 14px;}
          .adm-top .adm-menu{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);font-family:'Outfit';font-weight:800;font-size:14px;cursor:pointer;}
          .adm-top b{font-family:'Outfit';font-weight:800;font-size:15px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .adm-top a{color:var(--sub);font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;}
          .adm-side{position:fixed;left:0;top:0;bottom:0;z-index:80;width:280px;max-width:86vw;height:100vh;transform:translateX(-105%);transition:transform .25s var(--ease);box-shadow:0 0 40px rgba(0,0,0,.35);}
          .adm-side.aberto{transform:translateX(0);}
          .adm-veu{display:block;position:fixed;inset:0;z-index:70;background:rgba(10,10,20,.55);}
          .adm-x{display:flex;position:absolute;top:14px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:var(--panel2);color:var(--tx);align-items:center;justify-content:center;cursor:pointer;}
          .adm-nav:hover{transform:none;}
          .adm-main{padding:18px 14px 50px;}
          .adm-h{font-size:24px;}
          /* tabelas largas rolam para o lado dentro do card, sem cortar colunas */
          .adm-card:has(.adm-table){overflow-x:auto;-webkit-overflow-scrolling:touch;}
          .adm-table{min-width:680px;}
          .adm-table td:not(:first-child),.adm-table th{white-space:nowrap;}
          .adm-table td:first-child{min-width:190px;}
        }
        .adm-fila{align-items:flex-start;}
        .adm-fila-b{display:flex;gap:8px;flex-shrink:0;align-items:center;}
        @media(max-width:700px){
          /* listas do admin no celular: texto ocupa a largura toda e os botões descem para uma linha própria */
          .adm-row{flex-wrap:wrap;}
          .adm-row .info{flex:1 1 calc(100% - 60px);min-width:0;}
          .adm-row .info b{overflow-wrap:anywhere;}
          .adm-row>.adm-btn{flex:1 1 auto;}
          .adm-fila-b{width:100%;flex-wrap:wrap;}
          .adm-fila-b>*{flex:1 1 30%;justify-content:center;text-align:center;}
          .adm-card:has(.adm-table)::before{content:'Arraste para o lado para ver todas as colunas →';display:block;position:sticky;left:0;font-size:11.5px;color:var(--sub);margin-bottom:8px;}
        }
      ` }} />

      <header className="adm-top">
        <button type="button" className="adm-menu" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}><Icon name="menu" size={18} /> Menu</button>
        <b>{(NAV.find(([id]: any) => id === tab) as any)?.[2] ?? 'Admin'}</b>
        <a href="/">Ver site</a>
      </header>
      {menuAberto && <div className="adm-veu" onClick={() => setMenuAberto(false)} aria-hidden="true" />}
      <aside className={`adm-side ${menuAberto ? 'aberto' : ''}`}>
        <button type="button" className="adm-x" onClick={() => setMenuAberto(false)} aria-label="Fechar menu"><Icon name="x" size={18} /></button>
        <div className="adm-logo">Comprei <span>Barato</span></div>
        {adminEmail && (
          <div className="adm-who" style={{ fontSize: 11, color: 'var(--sub)', padding: '0 6px 12px', wordBreak: 'break-all', lineHeight: 1.4 }}>
            Logado como<br /><strong style={{ color: 'var(--tx)' }}>{adminEmail}</strong>
          </div>
        )}
        {GRUPOS.map(([titulo, itens]) => (
          <div key={titulo} className="adm-grupo">
            <div className="adm-gt">{titulo}</div>
            {itens.map(([id, ic, label, badge]: any) => (
              <button key={id} className={`adm-nav ${tab === id ? 'on' : ''}`} onClick={() => irPara(id, badge)}>
                <Icon name={ic} /> {label} {(id === 'email' ? badge > 0 : badge > (seenBadges[id] || 0)) && <span className="bd">{badge}</span>}
              </button>
            ))}
            {titulo === 'Crescimento' && (
              <a className="adm-nav" href="/admin/ofertas-parceiras" style={{ textDecoration: 'none' }}><Icon name="link" /> Ofertas parceiras</a>
            )}
            {titulo === 'Ajustes' && (
              <a className="adm-nav" href="/notificacoes?aba=preferencias" style={{ textDecoration: 'none' }}><Icon name="bell" /> Minhas notificações</a>
            )}
          </div>
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
        <AtivarCelular compacto />
        {tab === 'cockpit' && (
          <>
            <h1 className="adm-h">Dashboard</h1>
            <p className="adm-sub">Vendas do Comprei Barato por período. Padrão: últimos 30 dias.</p>
            {painel ? <PainelVendas {...painel} /> : (
              <div className="adm-stats">
                <div className="adm-stat"><div className="ic"><Icon name="money" size={20} /></div><b>{money(metrics.gmv)}</b><small>GMV (volume vendido)</small></div>
                <div className="adm-stat"><div className="ic"><Icon name="growth" size={20} /></div><b>{money(metrics.receita)}</b><small>Sua receita</small></div>
              </div>
            )}
            <h3 className="adm-ct" style={{ marginTop: 6 }}>Operação agora</h3>
            <div className="adm-stats">
              <div className="adm-stat"><div className="ic"><Icon name="money" size={20} /></div><b>{money(metrics.gmv)}</b><small>Faturamento desde o início</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="store" size={20} /></div><b>{fmt(metrics.totalLojas)}</b><small>Vendedores</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="package" size={20} /></div><b>{fmt(metrics.totalProdutosAtivos)}</b><small>Produtos ativos</small></div>
              <div className="adm-stat"><div className="ic"><Icon name="users" size={20} /></div><b>{fmt(metrics.buyersCount)}</b><small>Compradores</small></div>
              <div className="adm-stat" style={{ cursor: 'pointer' }} onClick={() => irPara('aprovacao', queue.length)}><div className="ic"><Icon name="clock" size={20} /></div><b>{fmt(metrics.filaProdutos)}</b><small>Aguardando aprovação</small></div>
              <div className="adm-stat" style={{ cursor: 'pointer' }} onClick={() => irPara('saques', metrics.saquesPendentes)}><div className="ic"><Icon name="wallet" size={20} /></div><b>{money(metrics.aRepassar)}</b><small>Saques pedidos ({fmt(metrics.saquesPendentes)})</small></div>
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
                        <td><span style={{ display: 'block', fontWeight: 800 }}>{o.cliente?.nome || '—'}</span><small style={{ color: 'var(--sub)' }}>{o.comprador_email || ''}{o.cliente?.whatsapp ? ` · ${foneLegivel(o.cliente.whatsapp)}` : ''}</small></td>
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

        {tab === 'inteligencia' && (
          <>
            <h1 className="adm-h">Inteligência</h1>
            <SubAbas valor={subDe('inteligencia')} onChange={(v) => mudarSub('inteligencia', v)} opcoes={SUBS.inteligencia} />
            {subDe('inteligencia') === 'vendas' && <InteligenciaComercial />}
            {subDe('inteligencia') === 'audiencia' && <AudienceTab />}
            {subDe('inteligencia') === 'ativacao' && <GrowthPanel />}
          </>
        )}
        {tab === 'campanhas' && (
          <>
            <h1 className="adm-h">Campanhas</h1>
            <SubAbas valor={subDe('campanhas')} onChange={(v) => mudarSub('campanhas', v)} opcoes={SUBS.campanhas} />
            {subDe('campanhas') === 'calendario' && <><p className="adm-sub">Faixa no topo do site e slides do carrossel da home, com data para entrar e sair do ar, e o calendário das próximas datas com campanha sugerida.</p><CampanhasAdmin /></>}
            {subDe('campanhas') === 'black' && <CrescimentoAdmin parte="black" />}
            {subDe('campanhas') === 'vitrine' && <>
              <p className="adm-sub">Tudo o que a página inicial destaca: a vitrine OFERTAS DO DIA (que também vira a oferta da página /oferta-do-dia e do Telegram) e a prova social.</p>
              <OfertasDiaAdmin />
              <CrescimentoAdmin parte="oferta" />
              <h3 className="adm-ct" style={{ marginTop: 22 }}>Prova social</h3>
              <ProvaSocialForm settings={settings} />
            </>}
            {subDe('campanhas') === 'promocoes' && <CampanhasConfig parte="promocoes" />}
          </>
        )}
        {tab === 'recompensas' && (
          <>
            <h1 className="adm-h">Recompensas</h1>
            <SubAbas valor={subDe('recompensas')} onChange={(v) => mudarSub('recompensas', v)} opcoes={SUBS.recompensas} />
            {subDe('recompensas') === 'indicacoes' && <IndicacoesAdmin />}
            {subDe('recompensas') === 'cashback' && <CampanhasConfig parte="cashback" />}
          </>
        )}
        {tab === 'comunicacao' && (
          <>
            <h1 className="adm-h">Comunicação</h1>
            <SubAbas valor={subDe('comunicacao')} onChange={(v) => mudarSub('comunicacao', v)} opcoes={SUBS.comunicacao} />
            {subDe('comunicacao') === 'email' && <><p className="adm-sub">Mande uma promoção por e-mail só para quem aceitou receber. Envie um teste para você antes.</p><PromoForm /></>}
            {subDe('comunicacao') === 'sino' && <><p className="adm-sub">Mande uma notificação que aparece no sino do site e na página Notificações de cada usuário.</p><AvisosSino /></>}
            {subDe('comunicacao') === 'canais' && <><p className="adm-sub">Canal do WhatsApp e canal do Telegram onde a oferta do dia é publicada. Promoções por WhatsApp individual ficam em Ajustes › WhatsApp e torpedos.</p><CrescimentoAdmin parte="canais" /></>}
          </>
        )}

        {tab === 'aprovacao' && (
          <>
            <h1 className="adm-h">Fila de Aprovação</h1>
            <p className="adm-sub">Curadoria = a defesa da plataforma. A análise automática marca o que parece desvio (outro site, contato, pagamento por fora, produto proibido) e os de maior risco vêm primeiro.</p>
            <PainelAprovacaoAuto />
            <div className="adm-card">
              {queue.length ? queue.map((p: any) => (
                <div className="adm-row adm-fila" key={p.id}>
                  <ProductThumb className="em" capa_url={p.capa_url} categoria={p.categoria} titulo={p.titulo} tamanho={42} raio={11} icone={22} />
                  <div className="info"><b>{p.titulo}{ehJogos(p.categoria) && <span title="Categoria Jogos & Games: confira se não é conta compartilhada, 'método', moeda/item de terceiros, key aleatória ou assinatura revendida." style={{ marginLeft: 8, verticalAlign: 1, fontSize: 10.5, fontWeight: 900, fontFamily: 'Outfit', color: '#fff', background: '#7C3AED', borderRadius: 50, padding: '2px 9px', display: 'inline-block', whiteSpace: 'nowrap' }}>Revisar com atenção</span>}</b><span>{p.stores?.nome ?? '—'} · {p.categoria}{p.tipo_anuncio ? ` · ${TIPOS_ANUNCIO.find((t) => t.id === p.tipo_anuncio)?.nome ?? p.tipo_anuncio}` : ''}{p.jogo ? ` · ${p.jogo}` : ''} · {money(p.preco_promo ?? p.preco)}</span>
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
                    {p.moderacaoPendente?.estado === 'correcao' && (
                      <div style={{ marginTop: 10, border: '1px solid #FFB020', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>
                        <b style={{ color: '#FFB020' }}>Correção que você pediu</b> — confira se o vendedor resolveu:
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{(p.moderacaoPendente.itens || []).map((i: string) => <li key={i}>{rotuloItem(i)}</li>)}</ul>
                        {p.moderacaoPendente.texto && <div style={{ marginTop: 4, color: 'var(--sub)', whiteSpace: 'pre-wrap' }}>“{p.moderacaoPendente.texto}”</div>}
                      </div>
                    )}
                    <AnaliseResumo a={p.analise} id={p.id} onNova={(an) => setQueue((q: any[]) => q.map((x) => (x.id === p.id ? { ...x, analise: an } : x)))} />
                    <AlteracoesAnuncio r={p.alteracoes} />
                    {corrigindo === p.id && (
                      <FormMotivo acao="correcao" busy={busy === p.id} inicial={itensSugeridos(p.analise)} onCancelar={() => setCorrigindo(null)} onEnviar={(itens, texto) => pedirCorrecao(p.id, itens, texto)} />
                    )}
                  </div>
                  <div className="adm-fila-b">
                  <a className="adm-btn rp" href={`/produto/${p.id}?previa=1`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} title="Abre a página do anúncio como o comprador vai ver (só admin)">Ver anúncio ↗</a>
                  <button className="adm-btn ap" disabled={busy === p.id} onClick={() => moderar(p.id, 'aprovar')}>Aprovar</button>
                  <button className="adm-btn rp" disabled={busy === p.id} onClick={() => setCorrigindo(corrigindo === p.id ? null : p.id)}>Pedir correção</button>
                  </div>
                </div>
              )) : <div className="adm-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="checkCircle" size={18} /> Fila zerada. Nenhum produto aguardando.</div>}
            </div>
          </>
        )}

        {tab === 'pedidos' && (
          <>
            <h1 className="adm-h">Pedidos</h1>
            <p className="adm-sub">Todos os pedidos da plataforma.</p>
            <RecuperacaoVendas />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 10px' }}>
              <button className="adm-btn rp" disabled={busy === 'todos'} onClick={() => conferirPix()}>{busy === 'todos' ? 'Conferindo na MisticPay…' : 'Conferir Pix pendentes na MisticPay'}</button>
              <small style={{ color: 'var(--sub)' }}>Libera quem pagou e ficou &quot;Aguardando pagamento&quot; (aviso do gateway perdido). Últimos 7 dias. A rotina de 1 em 1 minuto já faz isso sozinha nas últimas 48 h.</small>
            </div>
            <div className="adm-card adm-periodo">
              <div className="adm-per-l">
                <b><Icon name="calendar" size={15} /> Período</b>
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Preset)} aria-label="Período">
                  {PRESETS.map(([id, r]) => <option key={id} value={id}>{r}</option>)}
                </select>
                {periodo === 'dia' && <input type="date" value={perV.dia} max={hojeYMD()} onChange={(e) => setPerV({ ...perV, dia: e.target.value })} aria-label="Dia" />}
                {periodo === 'mes_escolhido' && <input type="month" value={perV.mes} onChange={(e) => setPerV({ ...perV, mes: e.target.value })} aria-label="Mês" />}
                {periodo === 'periodo' && <><input type="date" value={perV.de} onChange={(e) => setPerV({ ...perV, de: e.target.value })} aria-label="De" /><span>até</span><input type="date" value={perV.ate} onChange={(e) => setPerV({ ...perV, ate: e.target.value })} aria-label="Até" /></>}
                <div className="adm-per-rap">
                  {(['hoje', 'ontem', '7d', 'mes'] as Preset[]).map((p) => <button key={p} type="button" className={periodo === p ? 'on' : ''} onClick={() => setPeriodo(p)}>{PRESETS.find((x) => x[0] === p)?.[1]}</button>)}
                </div>
              </div>
              <div className="adm-per-res">
                <span><small>Vendas</small><b>{fmt(resumoPeriodo.vendas)}</b></span>
                <span><small>Vendido</small><b>{money(resumoPeriodo.vendido)}</b></span>
                <span><small>Taxa da plataforma</small><b style={{ color: 'var(--or2)' }}>{money(resumoPeriodo.taxa)}</b></span>
                <span><small>Aguardando pagamento</small><b>{fmt(resumoPeriodo.pendentes)} · {money(resumoPeriodo.pendente)}</b></span>
                <span><small>Reembolsados</small><b>{fmt(resumoPeriodo.reembolsados)}</b></span>
              </div>
            </div>
            <div className="adm-filters">
              {['todos', 'pendente', 'abandonou', 'pago', 'entregue', 'reembolsado'].map((f) => (
                <button key={f} className={`adm-fb ${orderFilter === f ? 'on' : ''}`} onClick={() => setOrderFilter(f)}>
                  {f === 'todos' ? `Todos (${pedidosNoPeriodo.length})` : f === 'abandonou' ? `Abandonou o checkout${carrinhosNoPeriodo.length ? ` (${carrinhosNoPeriodo.length})` : ''}` : `${STATUS[f]?.[1] ?? f}${qtdStatus(f) ? ` (${qtdStatus(f)})` : ''}`}
                </button>
              ))}
            </div>
            {orderFilter === 'abandonou' ? <div className="adm-card"><CarrinhosAbandonados itens={carrinhosNoPeriodo} tema="admin" mostrarLoja registrar /></div> : (
            <div className="adm-card">
              {filteredOrders.length ? (
                <table className="adm-table">
                  <thead><tr><th>Produto</th><th>Cliente</th><th>Vendedor</th><th>Valor</th><th>Taxa</th><th>Status</th><th>Data</th><th></th></tr></thead>
                  <tbody>
                    {filteredOrders.map((o: any) => (
                      <tr key={o.id}>
                        <td><ProductThumb capa_url={o.products?.capa_url} categoria={o.products?.categoria} titulo={o.products?.titulo} tamanho={28} raio={7} icone={18} style={{ marginRight: 6 }} /> {o.products?.titulo ?? 'Produto'}</td>
                        <td><span style={{ display: 'block', fontWeight: 800 }}>{o.cliente?.nome || '—'}</span><small style={{ color: 'var(--sub)' }}>{o.comprador_email || ''}{o.cliente?.whatsapp ? ` · ${foneLegivel(o.cliente.whatsapp)}` : ''}</small></td>
                        <td style={{ color: 'var(--sub)' }}>{o.stores?.nome ?? '—'}</td>
                        <td>{money(o.total)}</td>
                        <td style={{ color: 'var(--or2)' }}>{money(o.taxa)}</td>
                        <td><Pill s={o.status} /></td>
                        <td style={{ color: 'var(--sub)' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}<small style={{ display: 'block' }}>{new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          {o.status === 'pendente' && (() => {
                            const msg = mensagemRecuperacao({ nome: o.cliente?.nome, produto: o.products?.titulo || 'o produto', loja: o.stores?.nome, link: `https://www.compreibarato.com.br/checkout/${o.product_id}` });
                            const wa = o.cliente?.avisos ? linkWhatsapp(o.cliente?.whatsapp, msg) : null;
                            const chave = chaveRecuperacao(o.comprador_email, o.comprador, o.product_id);
                            return wa ? <a className="adm-btn ap" href={wa} target="_blank" rel="noreferrer" onClick={() => registrarContatoRecuperacao(chave, 'whatsapp')} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>WhatsApp</a>
                              : o.comprador_email ? <button type="button" className="adm-btn rp" onClick={() => { registrarContatoRecuperacao(chave, 'email'); escreverEmail(o.comprador_email, 'pix_pendente', { nome: o.cliente?.nome, produto: o.products?.titulo, link: `https://www.compreibarato.com.br/checkout/${o.product_id}?email=${encodeURIComponent(o.comprador_email)}&utm_source=recuperacao&utm_medium=email` }); }}>E-mail</button> : null;
                          })()}
                          {o.status === 'pendente' && <button className="adm-btn rp" disabled={busy === o.id} onClick={() => conferirPix(o.id)}>{busy === o.id ? 'Conferindo…' : 'Conferir Pix'}</button>}
                          <button className="adm-btn rp" onClick={() => setChatOrder(o.id)}>Conversa</button>
                          {(o.status === 'pago' || o.status === 'entregue') && <button className="adm-btn rp" disabled={busy === o.id} onClick={() => reembolsar(o.id)}>Reembolsar</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="adm-empty">Nenhum pedido com esse status.</div>}
            </div>
            )}
          </>
        )}

        {tab === 'vendedores' && !usuariosClassico && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -8 }}>
              <button className="adm-btn rp" onClick={() => setUsuariosClassico(true)}>Lista clássica (financeiro por vendedor)</button>
            </div>
            <UsersPanel onVerReclamacoes={() => setTab('reclamacoes')} />
          </>
        )}

        {tab === 'vendedores' && usuariosClassico && (() => {
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
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="adm-btn rp" onClick={() => setUsuariosClassico(false)}>‹ Voltar ao painel de inteligência</button>
            </div>
            <h1 className="adm-h">Usuários · lista clássica</h1>
            <p className="adm-sub">Visão anterior, com faturamento por vendedor. Os valores seguem o status do pedido; o número oficial de dinheiro está em Financeiro.</p>
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
                        {u.email && u.email !== '—' && <button className="adm-btn" onClick={() => escreverEmail(u.email, u.seller ? ((u.seller.produtosTotal || 0) > 0 ? 'boas_vindas_vendedor' : 'lojista_sem_anuncio') : 'cliente', { nome: u.nome, loja: u.seller?.nome })}><Icon name="mail" size={14} /> {u.seller ? 'E-mail de boas-vindas' : 'Enviar e-mail'}</button>}
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
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Categoria</th><th>Preço</th><th>Vendas</th><th>Cadastro</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {vis.map((p: any) => (
                      <Fragment key={p.id}>
                      <tr>
                        <td><ProductThumb capa_url={p?.capa_url} categoria={p?.categoria} titulo={p?.titulo} tamanho={28} raio={7} icone={18} style={{ marginRight: 6 }} /> {p.titulo}</td>
                        <td style={{ color: 'var(--sub)' }}>{p.stores?.nome ?? '—'}</td>
                        <td style={{ color: 'var(--sub)' }}>{p.categoria ?? '—'}</td>
                        <td>{money(p.preco_promo ?? p.preco)}</td>
                        <td>{fmt(p.vendas)}</td>
                        <td style={{ color: 'var(--sub)', whiteSpace: 'nowrap' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                        <td><Pill s={p.status} /></td>
                        <td><button type="button" className="adm-btn rp" style={{ whiteSpace: 'nowrap' }} aria-expanded={prodAberto === p.id}
                          onClick={() => setProdAberto(prodAberto === p.id ? null : p.id)}>{prodAberto === p.id ? 'Fechar' : 'Gerenciar'}</button></td>
                      </tr>
                      {prodAberto === p.id && (
                        <tr><td colSpan={8} style={{ padding: '4px 8px 16px' }}>
                          <ProdutoGerenciar id={p.id}
                            onStatus={(st) => { setAllProducts((ps: any[]) => ps.map((x) => x.id === p.id ? { ...x, status: st } : x)); if (st !== 'em_revisao') setQueue((q: any[]) => q.filter((x) => x.id !== p.id)); }}
                            onLoja={(storeId, oculto) => setUserList((l) => l.map((x) => x.seller?.id === storeId ? { ...x, seller: { ...x.seller, ocultarVendedor: oculto } } : x))} />
                        </td></tr>
                      )}
                      </Fragment>
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


        {tab === 'torpedos' && (
          <>
            <h1 className="adm-h">WhatsApp e torpedos</h1>
            <p className="adm-sub">Avisos automáticos para o vendedor quando ele demora a responder o cliente no chat. Configure o tempo e os canais (e-mail/SMS/WhatsApp).</p>
            <div style={{ marginBottom: 22 }}>
              <TorpedosForm settings={settings} />
            </div>
            <WhatsAppPainel />
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

        {tab === 'torpedos' && <WhatsAppLog />}

        {tab === 'email' && <CaixaEmail onNaoLidos={setEmailsNovos} pedido={pedidoEmail} />}

        {tab === 'reembolsos' && (
          <>
            <h1 className="adm-h">Reembolsos</h1>
            <p className="adm-sub">Pedidos de reembolso feitos pelos compradores dentro da garantia. Enquanto estão em análise, o saldo da venda fica retido.</p>
            <Reembolsos onContagem={setReembolsosAbertos} />
          </>
        )}

        {tab === 'verificacoes' && (
          <>
            <h1 className="adm-h">Verificações de produtores</h1>
            <p className="adm-sub">Confira se o nome e o documento batem com a selfie. Só depois de aprovado o produtor consegue sacar; as vendas continuam normais.</p>
            <Verificacoes onContagem={setVerificacoesPendentes} />
          </>
        )}

        {tab === 'seo' && (
          <>
            <h1 className="adm-h">SEO e Google</h1>
            <p className="adm-sub">Como o site e cada anúncio aparecem nas buscas. O que é automático já está rodando; o passo a passo abaixo é o que só vocês podem fazer (uma vez).</p>
            <SeoGoogle />
          </>
        )}

        {tab === 'produtores' && (
          <>
            <h1 className="adm-h">Novos lojistas</h1>
            <p className="adm-sub">Quem criou a loja pela página /produtores. Mande as mensagens prontas (1 → 2 → 3) pelo WhatsApp do seu celular: fica registrado quem chamou, e quem manda a 1ª assume o lojista — assim você e o César não chamam a mesma pessoa.</p>
            <ProdutoresInteressados onContagem={setProdutoresNovos} />
          </>
        )}

        {tab === 'registro' && (
          <>
            <h1 className="adm-h">Registro (quem fez)</h1>
            <p className="adm-sub">Tudo que cada admin fez: aprovações, mensagens, mudança de status dos lojistas, saques, reembolsos e configurações. Ninguém consegue editar nem apagar um registro.</p>
            <RegistroAdmin />
          </>
        )}




        {tab === 'suporte' && (
          <SupportTab protocoloInicial={suporteProtocolo} onVerPedidos={() => irPara('pedidos', 0)} />
        )}

        {tab === 'financeiro' && (
          <>
            <h1 className="adm-h">Financeiro</h1>
            <p className="adm-sub">Quanto a plataforma fatura (só o que é dela), quanto custa e quanto sobra. O dinheiro dos vendedores aparece separado.</p>
            <FinanceiroPainel />
          </>
        )}

        {tab === 'config' && (
          <>
            <h1 className="adm-h">Configurações</h1>
            <p className="adm-sub">Planos do vendedor, taxa de serviço do comprador, prazos de liberação e o resto da operação — sem mexer no código.</p>
            <TaxasPlanos />
            <DadosEmpresa />
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
