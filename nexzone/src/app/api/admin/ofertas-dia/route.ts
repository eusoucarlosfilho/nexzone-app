import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { lerCfgOfertasDia, salvarCfgOfertasDia } from '@/lib/ofertasDia-servidor';
import { desempenhoOfertas } from '@/lib/ofertasDia';
import { pedidosBI } from '@/lib/inteligencia-servidor';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const semCache = { headers: { 'Cache-Control': 'no-store' } };

// Admin › Ofertas do dia
//   GET                 → configuração + dados dos produtos escolhidos + desempenho (?dias=1|7|30)
//   GET ?busca=texto    → até 12 anúncios ATIVOS pelo título (para escolher)
//   POST {cfg}          → salva (registro de auditoria)
export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const admin = createAdminClient();
  const sp = req.nextUrl.searchParams;
  const busca = String(sp.get('busca') || '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 60);
  if (busca) {
    const uuid = /^[0-9a-f-]{36}$/i.test(busca);
    let q = admin.from('products').select('id, titulo, preco, preco_promo, capa_url, stores(nome)').eq('status', 'ativo').limit(12);
    q = uuid ? q.eq('id', busca.toLowerCase()) : q.ilike('titulo', `%${busca}%`);
    const { data } = await q;
    return NextResponse.json({ itens: data ?? [] }, semCache);
  }
  const cfg = await lerCfgOfertasDia(admin);
  const ids = cfg.itens.map((i) => i.id);
  const { data: prods } = ids.length ? await admin.from('products').select('id, titulo, preco, preco_promo, status, capa_url, stores(nome)').in('id', ids) : { data: [] as any[] };

  const dias = [1, 7, 30].includes(Number(sp.get('dias'))) ? Number(sp.get('dias')) : 7;
  const ate = Date.now(), de = ate - dias * 86400000;
  const { data: evs } = await admin.from('site_events').select('session_id, nome, props, created_at')
    .in('nome', ['oferta_dia_vista', 'oferta_dia_clique']).gte('created_at', new Date(de).toISOString()).limit(50000);
  const ped = ids.length ? await pedidosBI(de, ate, (q: any) => q.in('product_id', ids)) : { linhas: [] };
  const desempenho = desempenhoOfertas(ids, (evs ?? []) as any[], ped.linhas as any[]);
  return NextResponse.json({ cfg, produtos: prods ?? [], desempenho, dias, eventosSemTabela: !evs }, semCache);
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const admin = createAdminClient();
  const cfg = await salvarCfgOfertasDia(admin, b.cfg);
  await registrarAcao({ adminId: a.userId, acao: 'ofertas_dia_salvas', alvoTipo: 'config', alvoId: 'ofertas_dia', alvoNome: 'Ofertas do dia', detalhes: { ativo: cfg.ativo, itens: cfg.itens.length } });
  return NextResponse.json({ ok: true, cfg });
}
