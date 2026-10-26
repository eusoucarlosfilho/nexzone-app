import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { lerTudo } from '@/lib/audiencia-servidor';

export const dynamic = 'force-dynamic';

// Desempenho das ofertas de parceiros nos últimos 30 dias (só agregados).
// Visualizações: páginas /oferta/<slug> registradas pelo rastreador existente (site_pageviews).
// Cliques de saída: partner_offer_clicks (script 02). Sem a tabela, os cliques aparecem como indisponíveis.
// CLIQUE NÃO É VENDA: nenhuma receita ou comissão é calculada aqui.
const TETO = 20000;

export async function GET() {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const db = createAdminClient();
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: ofertas, error } = await db.from('partner_offers').select('id, slug, title, category, external_platform, status').limit(5000);
  if (error) return NextResponse.json({ error: 'Tabela de ofertas indisponível.', codigo: 'tabela_indisponivel' }, { status: 503 });
  const porSlug = new Map((ofertas ?? []).map((o: any) => [o.slug, o]));

  const views = await lerTudo<{ path: string }>((de, ate) => db.from('site_pageviews').select('path')
    .like('path', '/oferta/%').gte('created_at', desde).range(de, ate), TETO);
  const vPorId = new Map<string, number>();
  for (const v of views.linhas) {
    const slug = v.path.replace(/^\/oferta\//, '').split(/[/?#]/)[0];
    const o: any = porSlug.get(slug);
    if (o) vPorId.set(o.id, (vPorId.get(o.id) || 0) + 1);
  }

  let cliquesDisponivel = true;
  const cPorId = new Map<string, number>();
  const teste = await db.from('partner_offer_clicks').select('offer_id', { head: true, count: 'exact' }).limit(1);
  if (teste.error) cliquesDisponivel = false;
  else {
    const cliques = await lerTudo<{ offer_id: string }>((de, ate) => db.from('partner_offer_clicks').select('offer_id').gte('created_at', desde).range(de, ate), TETO);
    for (const c of cliques.linhas) cPorId.set(c.offer_id, (cPorId.get(c.offer_id) || 0) + 1);
  }

  const linhas = (ofertas ?? []).map((o: any) => {
    const v = vPorId.get(o.id) || 0;
    const c = cliquesDisponivel ? cPorId.get(o.id) || 0 : null;
    return { id: o.id, titulo: o.title, categoria: o.category, plataforma: o.external_platform, status: o.status, visualizacoes: v, cliques: c, taxaSaida: c !== null && v >= 10 ? Math.round((c / v) * 100) : null };
  }).sort((x, y) => y.visualizacoes - x.visualizacoes || (y.cliques ?? 0) - (x.cliques ?? 0));

  const somar = (campo: 'categoria' | 'plataforma') => {
    const m = new Map<string, { visualizacoes: number; cliques: number }>();
    for (const l of linhas) {
      const e = m.get(l[campo]) || { visualizacoes: 0, cliques: 0 };
      e.visualizacoes += l.visualizacoes; e.cliques += l.cliques ?? 0;
      m.set(l[campo], e);
    }
    return Array.from(m.entries()).map(([nome, e]) => ({ nome, ...e })).sort((x, y) => y.visualizacoes - x.visualizacoes);
  };

  return NextResponse.json({
    periodoDias: 30,
    cliquesDisponivel,
    totais: { visualizacoes: views.linhas.length, cliques: cliquesDisponivel ? Array.from(cPorId.values()).reduce((s, n) => s + n, 0) : null },
    ofertas: linhas.slice(0, 100),
    porCategoria: somar('categoria'),
    porPlataforma: somar('plataforma'),
    cortado: views.cortado,
    aviso: 'Cliques de saída não são vendas confirmadas. Vendas e comissões só podem ser conferidas no painel da plataforma parceira.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
