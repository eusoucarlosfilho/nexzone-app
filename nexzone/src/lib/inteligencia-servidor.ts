// Carregamento das linhas da Inteligência Comercial e da divulgação do vendedor. SÓ SERVIDOR (service role).
// Chamar só depois de checar quem pede (adminSeguro no admin; dono da loja no vendedor).
// Tetos de leitura evitam consultas pesadas: quando atingidos, o painel avisa ("números cortados").
import { createAdminClient } from '@/lib/supabase/server';
import { funilAtivo } from '@/lib/track-servidor';
import type { EventoBI, LojaBI, PageviewBI, PedidoBI, ProdutoBI, SessaoBI } from './inteligencia';

const PAG = 1000;
export const TETOS_BI = { sessoes: 60000, pageviews: 200000, eventos: 120000, pedidos: 50000 };

async function ler<T>(montar: (de: number, ate: number) => any, teto: number): Promise<{ linhas: T[]; erro: boolean; cortado: boolean }> {
  const linhas: T[] = [];
  for (let de = 0; de < teto; de += PAG) {
    const ate = Math.min(de + PAG, teto) - 1;
    const { data, error } = await montar(de, ate);
    if (error) return { linhas, erro: true, cortado: false };
    if (!data) break;
    linhas.push(...(data as T[]));
    if (data.length < ate - de + 1) return { linhas, erro: false, cortado: false };
  }
  return { linhas, erro: false, cortado: linhas.length >= teto };
}

const COLS_S = 'id, visitor_id, started_at, landing_path, referrer';
const COLS_UTM = ', utm_source, utm_medium, utm_campaign, utm_content';

export async function sessoesBI(de: number, ate: number, filtro?: (q: any) => any) {
  const admin = createAdminClient();
  const a = new Date(de).toISOString(), b = new Date(ate).toISOString();
  const base = (cols: string) => (x: number, y: number) => {
    let q = admin.from('site_sessions').select(cols).gte('started_at', a).lt('started_at', b);
    if (filtro) q = filtro(q);
    return q.order('started_at', { ascending: false }).order('id').range(x, y);
  };
  let r = await ler<SessaoBI>(base(COLS_S + COLS_UTM), TETOS_BI.sessoes);
  if (r.erro && !filtro) r = await ler<SessaoBI>(base(COLS_S), TETOS_BI.sessoes); // sem as colunas UTM (SQL V3 05)
  return r;
}

export async function pedidosBI(de: number, ate: number, filtro?: (q: any) => any) {
  const admin = createAdminClient();
  const a = new Date(de).toISOString(), b = new Date(ate).toISOString();
  const montar = (cols: string) => (x: number, y: number) => {
    let q = admin.from('orders').select(cols).gte('created_at', a).lt('created_at', b);
    if (filtro) q = filtro(q);
    return q.order('created_at', { ascending: false }).order('id').range(x, y);
  };
  let r = await ler<PedidoBI>(montar('id, status, total, created_at, product_id, store_id, origem'), TETOS_BI.pedidos);
  if (r.erro) { // sem a coluna origem (SQL 15)
    const r2 = await ler<any>(montar('id, status, total, created_at, product_id, store_id'), TETOS_BI.pedidos);
    r = { ...r2, linhas: r2.linhas.map((o: any) => ({ ...o, origem: null })) };
  }
  return r;
}

/** Tudo o que o painel do admin precisa para o período [de, ate). */
export async function carregarInteligencia(de: number, ate: number) {
  const admin = createAdminClient();
  const a = new Date(de).toISOString(), b = new Date(ate).toISOString();
  const eventosOn = await funilAtivo();
  const [ses, pv, ev, ped] = await Promise.all([
    sessoesBI(de, ate),
    ler<PageviewBI>((x, y) => admin.from('site_pageviews').select('session_id, path, created_at').gte('created_at', a).lt('created_at', b).order('created_at', { ascending: false }).order('id').range(x, y), TETOS_BI.pageviews),
    eventosOn
      ? ler<EventoBI>((x, y) => admin.from('site_events').select('session_id, nome, props, path, created_at').in('nome', ['compra_clique', 'oferta_dia_clique']).gte('created_at', a).lt('created_at', b).order('created_at', { ascending: false }).order('id').range(x, y), TETOS_BI.eventos)
      : Promise.resolve(null),
    pedidosBI(de, ate),
  ]);

  // produtos e lojas citados (visitas e vendas) + contagem de produtos ativos por loja
  const ids = new Set<string>();
  for (const p of pv.linhas) { const m = /^\/(?:produto|checkout)\/([0-9a-f-]{36})/i.exec(p.path); if (m) ids.add(m[1].toLowerCase()); }
  for (const o of ped.linhas) if (o.product_id) ids.add(o.product_id);
  const produtos: ProdutoBI[] = [];
  const lista = Array.from(ids);
  for (let i = 0; i < lista.length; i += 150) {
    const { data } = await admin.from('products').select('id, titulo, store_id, categoria, status').in('id', lista.slice(i, i + 150));
    produtos.push(...((data ?? []) as any[]));
  }
  const ativos = await ler<ProdutoBI>((x, y) => admin.from('products').select('id, titulo, store_id, categoria, status').eq('status', 'ativo').order('id').range(x, y), 20000);
  const vistos = new Set(produtos.map((p) => p.id));
  for (const p of ativos.linhas) if (!vistos.has(p.id)) produtos.push(p);
  const { data: lojas } = await admin.from('stores').select('id, nome, slug').limit(5000);

  const cortes: string[] = [];
  if (ses.cortado) cortes.push(`sessões (teto ${TETOS_BI.sessoes})`);
  if (pv.cortado) cortes.push(`visualizações (teto ${TETOS_BI.pageviews})`);
  if (ev?.cortado) cortes.push(`eventos (teto ${TETOS_BI.eventos})`);
  if (ped.cortado) cortes.push(`pedidos (teto ${TETOS_BI.pedidos})`);

  return {
    de, ate, sessoes: ses.linhas, pageviews: pv.linhas, eventos: ev && !ev.erro ? ev.linhas : null, pedidos: ped.linhas,
    produtos, lojas: ((lojas ?? []) as LojaBI[]), cortes,
  };
}
