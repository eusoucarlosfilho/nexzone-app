// Carregamento das linhas de audiência para Admin > Audiência / Crescimento (servidor, service role).
// Só chamar depois de adminSeguro(). Tetos de leitura evitam consultas pesadas; quando atingidos, o painel avisa.
import { createAdminClient } from '@/lib/supabase/server';
import { carregarBase } from './usuarios-servidor';
import { funilAtivo } from '@/lib/track-servidor';
import { chaveCategoria, type Dados, type Evento, type Pageview, type Sessao } from './audiencia-v3';

const PAG = 1000;
export const TETOS = { sessoes: 60000, pageviews: 200000, eventos: 120000 };

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

const COLS_SESSAO = 'id, visitor_id, started_at, last_seen, device, landing_path, current_path, region, city, country, referrer, user_id, pageviews';
const COLS_UTM = ', utm_source, utm_medium, utm_campaign, utm_content, canal';

export async function sessoesDesde(desde: Date, teto = TETOS.sessoes) {
  const admin = createAdminClient();
  const iso = desde.toISOString();
  let temUtm = true;
  let r = await ler<Sessao>((de, ate) => admin.from('site_sessions').select(COLS_SESSAO + COLS_UTM).gte('started_at', iso).order('started_at', { ascending: false }).order('id').range(de, ate), teto);
  if (r.erro) {
    temUtm = false;
    r = await ler<Sessao>((de, ate) => admin.from('site_sessions').select(COLS_SESSAO).gte('started_at', iso).order('started_at', { ascending: false }).order('id').range(de, ate), teto);
  }
  return { ...r, temUtm };
}

/** Mapa chave de página → categoria, para produtos (/produto/<id>) e ofertas (/oferta/<slug>). */
export async function categoriasDe(paths: string[]): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const ids = new Set<string>(); const slugs = new Set<string>();
  paths.forEach((p) => { const k = chaveCategoria(p); if (!k) return; if (k.startsWith('o:')) slugs.add(k.slice(2)); else ids.add(k); });
  const out: Record<string, string> = {};
  const lista = Array.from(ids).slice(0, 3000);
  for (let i = 0; i < lista.length; i += 150) {
    const { data } = await admin.from('products').select('id, categoria').in('id', lista.slice(i, i + 150));
    ((data as any[]) || []).forEach((p) => { if (p.categoria) out[p.id] = p.categoria; });
  }
  const sl = Array.from(slugs).slice(0, 3000);
  for (let i = 0; i < sl.length; i += 150) {
    const { data, error } = await admin.from('partner_offers').select('slug, category').in('slug', sl.slice(i, i + 150));
    if (error) break;
    ((data as any[]) || []).forEach((o) => { if (o.category) out['o:' + o.slug] = o.category; });
  }
  return out;
}

export async function carregarDados(de: Date, ate: Date, anteriorDe: Date): Promise<Dados> {
  const admin = createAdminClient();
  const desde = anteriorDe.toISOString();
  const [sess, pv, ev, ext, base, ligado] = await Promise.all([
    sessoesDesde(anteriorDe),
    ler<Pageview>((a, b) => admin.from('site_pageviews').select('session_id, path, created_at').gte('created_at', desde).order('created_at', { ascending: false }).order('id').range(a, b), TETOS.pageviews),
    ler<Evento>((a, b) => admin.from('site_events').select('session_id, nome, props, device, created_at').gte('created_at', desde).order('created_at', { ascending: false }).order('id').range(a, b), TETOS.eventos),
    ler<{ created_at: string }>((a, b) => admin.from('partner_offer_clicks').select('created_at').gte('created_at', desde).order('id').range(a, b), 100000),
    carregarBase(),
    funilAtivo(),
  ]);
  const paths = [...pv.linhas.map((p) => p.path), ...sess.linhas.map((s) => s.current_path || s.landing_path || '')];
  const categoriaDoProduto = await categoriasDe(paths);
  return {
    de, ate, anteriorDe,
    sessoes: sess.linhas,
    pageviews: pv.erro ? [] : pv.linhas,
    // Funil desligado ou tabela ausente = indisponível (null), nunca zero.
    eventos: ev.erro || !ligado ? null : ev.linhas,
    cliquesExternos: ext.erro ? null : ext.linhas,
    usuarios: base.linhas,
    categoriaDoProduto,
    temUtm: sess.temUtm,
    cortes: { sessoes: sess.cortado, pageviews: pv.cortado, eventos: ev.cortado },
  };
}

/** Publicações de produtos: data real (SQL V3 03) ou aproximação pela criação de produtos hoje ativos. */
export async function publicacoesDesde(desde: Date) {
  const admin = createAdminClient();
  const iso = desde.toISOString();
  // Com a coluna: data real quando houver; produtos ativos sem data (publicados antes do SQL 03) usam a criação, marcada como aproximada.
  const r = await ler<any>((a, b) => admin.from('products').select('store_id, status, created_at, publicado_em').or(`publicado_em.gte."${iso}",and(publicado_em.is.null,status.eq.ativo,created_at.gte."${iso}")`).order('id').range(a, b), 100000);
  if (!r.erro) return r.linhas.map((p) => p.publicado_em
    ? { store_id: p.store_id, quando: p.publicado_em, aproximado: false }
    : { store_id: p.store_id, quando: p.created_at, aproximado: true });
  const r2 = await ler<any>((a, b) => admin.from('products').select('store_id, created_at').eq('status', 'ativo').gte('created_at', iso).order('id').range(a, b), 100000);
  return r2.linhas.map((p) => ({ store_id: p.store_id, quando: p.created_at, aproximado: true }));
}
