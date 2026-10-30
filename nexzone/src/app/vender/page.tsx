import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AtivarCelular from '@/components/AtivarCelular';
import { calcBalance } from '@/lib/balance';
import Icon from '@/components/Icon';
import ProductThumb from '@/components/ProductThumb';
import JourneyChip from '@/components/JourneyChip';
import { computeJourney } from '@/lib/journey';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import PainelLoja from './PainelLoja';
import CartaoFundador from '@/components/CartaoFundador';
import { fundadorDaLoja, vagasFundador, lerCfgCampanhas } from '@/lib/campanhas-servidor';
import { createAdminClient as adminFundador } from '@/lib/supabase/server';
import type { VendaDash } from '@/lib/dashboardVendas';

// Pedidos da loja (paginado). Tenta com a forma de pagamento (SQL 17); se a coluna não existir, segue sem ela.
async function pedidosDaLoja(supabase: any, storeId: string): Promise<{ linhas: any[]; temForma: boolean }> {
  const tentativas = [
    { cols: 'id, total, valor_vendedor, status, created_at, entregue_em, product_id, comprador, forma_pagamento', forma: true },
    { cols: 'id, total, valor_vendedor, status, created_at, entregue_em, product_id, comprador', forma: false },
    { cols: 'id, total, valor_vendedor, status, created_at, product_id', forma: false },
  ];
  for (const t of tentativas) {
    const linhas: any[] = [];
    let falhou = false;
    for (let de = 0; de < 100000; de += 1000) {
      const { data, error } = await supabase.from('orders').select(t.cols).eq('store_id', storeId).order('created_at', { ascending: false }).range(de, de + 999);
      if (error) { falhou = true; break; }
      linhas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    if (!falhou) return { linhas, temForma: t.forma };
  }
  return { linhas: [], temForma: false };
}

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
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Bem-vindo ao Comprei Barato</h1>
        <p className="muted" style={{ marginTop: 6 }}>Você ainda não tem produtos. Cadastre o primeiro e sua loja é criada automaticamente.</p>
        <Link href="/vender/produtos/novo" className="btn btn-pri" style={{ marginTop: 18, display: 'inline-block' }}>Cadastrar meu primeiro produto</Link>
      </div>
    );
  }

  const { linhas: all, temForma } = await pedidosDaLoja(supabase, store.id);
  const entregues = all.filter((o) => o.status === 'entregue' || o.status === 'pago');
  // Catálogo do vendedor (só os próprios produtos; números reais)
  const { data: prodRows } = await supabase.from('products').select('id, titulo, categoria, capa_url, status, destaque_ate').eq('store_id', store.id);
  const prodMap: Record<string, any> = Object.fromEntries(((prodRows ?? []) as any[]).map((p) => [p.id, p]));
  const n2 = (x: any) => Math.round((Number(x) || 0) * 100) / 100;
  const vendasDash: VendaDash[] = all.map((o) => ({
    i: String(o.id), s: o.status, v: n2(o.total), r: n2(o.valor_vendedor), t: n2(Number(o.total) - Number(o.valor_vendedor)),
    c: o.created_at, p: o.entregue_em ?? null, l: store.id, d: o.product_id ?? '', u: o.comprador ?? String(o.id),
    f: o.forma_pagamento === 'pix' || o.forma_pagamento === 'cartao' ? o.forma_pagamento : null,
  }));
  const nomesProdutos: Record<string, string> = Object.fromEntries(((prodRows ?? []) as any[]).map((p) => [p.id, p.titulo]));
  const bal = await calcBalance(supabase, store.id);
  // Lojista Fundador (SQL 28)
  const campCfg = await lerCfgCampanhas();
  const [fundador, vagasF] = await Promise.all([fundadorDaLoja(adminFundador(), store.id, campCfg).catch(() => null), campCfg.fundadorAtivo ? vagasFundador(adminFundador(), campCfg).catch(() => null) : Promise.resolve(null)]);

  const now = new Date();
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const mesPassadoIni = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const fatMes = entregues.filter((o) => new Date(o.created_at).getTime() >= mesIni).reduce((s, o) => s + Number(o.valor_vendedor), 0);
  const fatMesPassado = entregues.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= mesPassadoIni && t < mesIni; }).reduce((s, o) => s + Number(o.valor_vendedor), 0);

  // meta do mês
  const meta = Math.max(1000, Math.ceil((fatMesPassado * 1.2 || 1000) / 100) * 100);
  const progresso = Math.min(100, meta ? (fatMes / meta) * 100 : 0);

  const recentes = entregues.slice(0, 5).map((o) => ({ ...o, products: prodMap[o.product_id] ?? null }));
  // Pedidos pagos que ainda aguardam a entrega manual do vendedor (status 'pago')
  const aEntregar = all.filter((o) => o.status === 'pago').length;

  const prods = (prodRows ?? []) as { status: string; destaque_ate: string | null }[];
  const agora = Date.now();
  const cat = {
    total: prods.length,
    ativos: prods.filter((p) => p.status === 'ativo').length,
    revisao: prods.filter((p) => p.status === 'em_revisao').length,
    destaque: prods.filter((p) => p.destaque_ate && new Date(p.destaque_ate).getTime() > agora).length,
  };

  // jornada de faturamento (bruto = soma de total dos pedidos pagos)
  const fatBruto = entregues.reduce((s, o) => s + Number(o.total), 0);
  const jornada = computeJourney(fatBruto, entregues.length);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, letterSpacing: '-.6px' }}>Olá, {store.nome}</h1>
          <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Aqui está o pulso da sua loja. <StatusBadge tipo="loja" status={(store as any).status} /></p>
          <div style={{ marginTop: 12 }}>
            <JourneyChip atual={jornada.atual} proximo={jornada.proximo} progresso={jornada.progresso} falta={jornada.falta} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Link href="/vender/produtos/novo" className="btn btn-pri btn-sm">+ Cadastrar produto</Link>
            <Link href="/vender/produtos" className="btn btn-ghost btn-sm"><Icon name="package" size={16} /> Gerenciar produtos</Link>
          </div>
        </div>
        <Link href="/vender/recebimentos" className="card" style={{ padding: '14px 20px', textDecoration: 'none', color: 'inherit', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>SALDO DISPONÍVEL</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 900, color: 'var(--green)' }}>{money(bal.disponivel)}</div>
        </Link>
      </div>

      {aEntregar > 0 && (
        <Link href="/vender/conversas" className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', borderLeft: '3px solid var(--orange)' }}>
          <Icon name="package" size={20} color="var(--orange-ink)" />
          <span style={{ flex: 1 }}><strong style={{ fontFamily: 'Outfit' }}>{aEntregar} pedido{aEntregar === 1 ? '' : 's'} pago{aEntregar === 1 ? '' : 's'} aguardando entrega</strong>
            <span className="muted" style={{ display: 'block', fontSize: 13 }}>Entregue pela conversa do pedido.</span></span>
          <Icon name="chevronRight" size={18} color="var(--sub)" />
        </Link>
      )}

      <AtivarCelular compacto />
      {fundador && <CartaoFundador f={fundador} vagas={vagasF && vagasF.sql28 ? vagasF : null} />}
      <PainelLoja vendas={vendasDash} produtos={nomesProdutos} temForma={temForma} />

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <strong style={{ fontFamily: 'Outfit' }}>Vendas recentes</strong>
          <Link href="/vender/vendas" style={{ fontSize: 13, fontWeight: 800, color: 'var(--orange-ink)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todas <Icon name="arrowRight" size={14} /></Link>
        </div>
        {recentes.length ? recentes.map((o, i) => (
          <div className="li" key={i}>
            <ProductThumb className="em" capa_url={o.products?.capa_url} categoria={o.products?.categoria} titulo={o.products?.titulo} tamanho={46} raio={14} icone={22} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontFamily: 'Outfit', fontSize: 14 }}>{o.products?.titulo ?? 'Produto'}</strong>
              <div className="muted">{new Date(o.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <strong style={{ fontFamily: 'Outfit', color: 'var(--green)' }}>+ {money(o.valor_vendedor)}</strong>
          </div>
        )) : <p className="muted" style={{ fontSize: 13 }}>Nenhuma venda ainda. Divulgue seus produtos e elas aparecem aqui.</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontFamily: 'Outfit', fontSize: 17 }}>Seu catálogo</strong>
        <Link href="/vender/produtos" style={{ fontSize: 13, fontWeight: 800, color: 'var(--orange-ink)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todos <Icon name="arrowRight" size={14} /></Link>
      </div>
      <div className="ui-stats" style={{ marginTop: 10 }}>
        <StatCard label="Produtos cadastrados" value={cat.total} icon="package" href="/vender/produtos" />
        <StatCard label="Ativos" value={cat.ativos} icon="checkCircle" href="/vender/produtos" />
        <StatCard label="Em revisão" value={cat.revisao} icon="hourglass" href="/vender/produtos" />
        <StatCard label="Com destaque ativo" value={cat.destaque} icon="star" href="/vender/produtos" />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <strong style={{ fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="target" size={18} /> Meta do mês</strong>
          <span className="muted" style={{ fontSize: 13 }}>{money(fatMes)} de {money(meta)}</span>
        </div>
        <div className="sd-meta"><div className="fill" style={{ width: `${progresso}%` }} /></div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {progresso >= 100 ? 'Meta batida! Você está voando.' : `Faltam ${money(meta - fatMes)} para bater sua meta do mês.`}
        </p>
      </div>

    </div>
  );
}
