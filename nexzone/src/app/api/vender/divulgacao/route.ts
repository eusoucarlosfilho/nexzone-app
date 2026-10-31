import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { metricasDivulgacao } from '@/lib/inteligencia';
import { pedidosBI, sessoesBI } from '@/lib/inteligencia-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Vendedor › Divulgar meus produtos: métricas dos links rastreáveis DA PRÓPRIA loja.
// A loja vem da sessão do usuário (owner = ele). Nenhum parâmetro do navegador escolhe loja.
// Cliques = sessões abertas pelo link · visitantes = navegadores únicos · compras = pedidos pagos de produtos
// DESTA loja cuja visita (ou origem gravada no pedido) veio do link desta loja.
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const { data: loja } = await supabase.from('stores').select('id, slug').eq('owner', user.id).maybeSingle();
  if (!loja) return NextResponse.json({ error: 'Você ainda não tem loja.' }, { status: 404 });
  const dias = [7, 30, 90].includes(Number(req.nextUrl.searchParams.get('dias'))) ? Number(req.nextUrl.searchParams.get('dias')) : 30;
  const ate = Date.now(), de = ate - dias * 86400000;
  const slug = String((loja as any).slug || '').toLowerCase();

  const admin = createAdminClient();
  const { data: prods } = await admin.from('products').select('id, titulo, status').eq('store_id', (loja as any).id).limit(2000);
  const ids = new Set(((prods ?? []) as any[]).map((p) => p.id));
  const [ses, ped] = await Promise.all([
    slug ? sessoesBI(de, ate, (q: any) => q.eq('utm_source', 'vendedor').eq('utm_content', slug)) : Promise.resolve({ linhas: [], erro: false, cortado: false }),
    pedidosBI(de, ate, (q: any) => q.eq('store_id', (loja as any).id)),
  ]);
  const m = metricasDivulgacao(slug, ses.linhas, ped.linhas, ids);

  // produtos da loja mais acessados no período (todas as origens), para o ranking
  const views = new Map<string, number>();
  const lista = Array.from(ids);
  for (let i = 0; i < lista.length && i < 600; i += 100) {
    const caminhos = lista.slice(i, i + 100).map((id) => `/produto/${id}`);
    const { data } = await admin.from('site_pageviews').select('path').in('path', caminhos).gte('created_at', new Date(de).toISOString()).limit(20000);
    for (const r of (data ?? []) as any[]) { const id = String(r.path).split('/')[2]; views.set(id, (views.get(id) || 0) + 1); }
  }
  const titulo = new Map(((prods ?? []) as any[]).map((p) => [p.id, p.titulo]));
  const ranking = Array.from(views.entries()).map(([id, n]) => ({ id, titulo: titulo.get(id) || 'Produto', visitas: n, viaLinks: m.produtos.find((x) => x.id === id)?.cliques || 0 }))
    .sort((a, b) => b.visitas - a.visitas).slice(0, 10);

  return NextResponse.json({ dias, ...m, produtos: undefined, ranking, cortado: ses.cortado }, { headers: { 'Cache-Control': 'private, no-store' } });
}
