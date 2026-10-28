import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { calcularSeo } from '@/lib/seo';
import { CATEGORIAS } from '@/lib/categorias';
import { SITE, PAGINAS_FIXAS, tituloDoProduto, descricaoDoProduto, limparPerfis } from '@/lib/seoSite';
import { lerSeoConfigAgora, limparCacheSeo, avisarBuscadores, limparVerificacao, INDEXNOW_CHAVE } from '@/lib/seo-servidor';

export const dynamic = 'force-dynamic';

// Admin → SEO e Google.
//   GET  → configuração + nota de SEO de cada anúncio ativo (pior primeiro) + prévia no Google
//   POST { acao: 'config', google?, bing?, perfis? } | { acao: 'indexnow' } (avisa os buscadores de todas as páginas)
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}

async function produtosAtivos(admin: any) {
  const out: any[] = [];
  for (let de = 0; de < 20000; de += 1000) {
    const { data, error } = await admin.from('products')
      .select('id, titulo, descricao, categoria, preco, preco_promo, tipo_entrega, garantia_dias, capa_url, imagens, vendas, created_at, stores(nome, slug)')
      .eq('status', 'ativo').order('created_at', { ascending: false }).range(de, de + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function GET() {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const [config, prods] = await Promise.all([lerSeoConfigAgora(), produtosAtivos(admin)]);
  const itens = prods.map((p) => {
    const seo = calcularSeo({ titulo: p.titulo, descricao: p.descricao, categoria: p.categoria, preco: p.preco, precoPromo: p.preco_promo, temCapa: !!p.capa_url, tipoEntrega: p.tipo_entrega, garantiaDias: p.garantia_dias });
    const preco = Number(p.preco_promo && Number(p.preco_promo) > 0 && Number(p.preco_promo) < Number(p.preco) ? p.preco_promo : p.preco) || null;
    return {
      id: p.id, titulo: p.titulo, loja: p.stores?.nome ?? '—', vendas: p.vendas || 0, criado: p.created_at,
      score: seo.score, nivel: seo.nivel, pendencias: seo.checks.filter((c) => !c.ok).map((c) => ({ label: c.label, dica: c.dica })),
      fotos: (p.capa_url ? 1 : 0) + (Array.isArray(p.imagens) ? p.imagens.length : 0),
      google: { titulo: tituloDoProduto(p.titulo, p.categoria), descricao: descricaoDoProduto(p.descricao, p.titulo, preco), url: `${SITE}/produto/${p.id}` },
    };
  }).sort((x, y) => x.score - y.score || y.vendas - x.vendas);
  const media = itens.length ? Math.round(itens.reduce((s, i) => s + i.score, 0) / itens.length) : 0;
  const lojas = await admin.from('stores').select('slug', { count: 'exact', head: true }).neq('status', 'suspenso').eq('ocultar_vendedor', false).not('slug', 'is', null);
  return NextResponse.json({
    site: SITE,
    config,
    indexnow: { chave: INDEXNOW_CHAVE, arquivo: `${SITE}/${INDEXNOW_CHAVE}.txt` },
    mapa: { produtos: itens.length, categorias: CATEGORIAS.length, fixas: PAGINAS_FIXAS.length, lojas: lojas.count ?? 0 },
    media,
    faixas: { excelente: itens.filter((i) => i.score >= 85).length, bom: itens.filter((i) => i.score >= 70 && i.score < 85).length, regular: itens.filter((i) => i.score >= 40 && i.score < 70).length, fraco: itens.filter((i) => i.score < 40).length },
    itens,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const admin = createAdminClient();

  if (b.acao === 'config') {
    const linhas: { key: string; value: any }[] = [];
    if (b.google != null) linhas.push({ key: 'seo_google', value: limparVerificacao(b.google) });
    if (b.bing != null) linhas.push({ key: 'seo_bing', value: limparVerificacao(b.bing) });
    if (b.perfis != null) linhas.push({ key: 'seo_perfis', value: limparPerfis(b.perfis) });
    for (const l of linhas) {
      const { error } = await admin.from('settings').upsert({ key: l.key, value: l.value, updated_at: new Date().toISOString() });
      if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
    }
    limparCacheSeo();
    return NextResponse.json({ ok: true, config: await lerSeoConfigAgora() });
  }

  if (b.acao === 'indexnow') {
    const prods = await produtosAtivos(admin);
    const { data: lojas } = await admin.from('stores').select('slug').neq('status', 'suspenso').eq('ocultar_vendedor', false).not('slug', 'is', null).limit(5000);
    const urls = [
      ...PAGINAS_FIXAS.map((f) => `${SITE}${f.caminho}`),
      ...CATEGORIAS.map((c) => `${SITE}/categoria/${c.slug}`),
      ...prods.map((p) => `${SITE}/produto/${p.id}`),
      ...((lojas ?? []) as any[]).map((l) => `${SITE}/loja/${encodeURIComponent(l.slug)}`),
    ];
    const r = await avisarBuscadores(urls);
    if (!r.ok) return NextResponse.json({ error: `Os buscadores não aceitaram agora${r.status ? ` (código ${r.status})` : ''}. Confira se o site já está no ar com o arquivo da chave e tente de novo.` }, { status: 502 });
    return NextResponse.json({ ok: true, enviados: r.enviados });
  }

  return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
}
