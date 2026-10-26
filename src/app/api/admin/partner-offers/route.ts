import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { validarOferta } from '@/lib/ofertas/validar';
import { PLATAFORMAS, STATUS_OFERTA } from '@/lib/ofertas/tipos';

export const dynamic = 'force-dynamic';
const SEM_CACHE = { 'Cache-Control': 'no-store' };
const POR_PAGINA = 25;

// Lista de ofertas para o admin (todas as situações). Exige adminSeguro (C1).
export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const sp = req.nextUrl.searchParams;
  const db = createAdminClient();
  let q = db.from('partner_offers').select('*', { count: 'exact' });
  const status = sp.get('status');
  if (status && (STATUS_OFERTA as string[]).includes(status)) q = q.eq('status', status);
  const plat = sp.get('plataforma');
  if (plat && (PLATAFORMAS as string[]).includes(plat)) q = q.eq('external_platform', plat);
  const cat = sp.get('categoria');
  if (cat) q = q.eq('category', cat.slice(0, 80));
  const termo = (sp.get('q') || '').replace(/[%_,()]/g, ' ').trim().slice(0, 80);
  if (termo) q = q.ilike('title', `%${termo}%`);
  if (sp.get('verificar') === '1') q = q.or(`last_verified_at.is.null,last_verified_at.lt.${new Date(Date.now() - 30 * 86400000).toISOString()}`);
  const pagina = Math.max(1, Math.floor(Number(sp.get('page')) || 1));
  const de = (pagina - 1) * POR_PAGINA;
  const { data, count, error } = await q
    .order('featured', { ascending: false }).order('priority', { ascending: false }).order('created_at', { ascending: false })
    .range(de, de + POR_PAGINA - 1);
  if (error) return NextResponse.json({ error: 'Tabela de ofertas indisponível (script 01 não aplicado?).', codigo: 'tabela_indisponivel' }, { status: 503, headers: SEM_CACHE });
  return NextResponse.json({ ofertas: data ?? [], total: count ?? 0, pagina, porPagina: POR_PAGINA }, { headers: SEM_CACHE });
}

// Cadastrar oferta (entra como rascunho, salvo se o admin escolher outro status).
export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const r = validarOferta(body, { statusPadrao: 'rascunho' });
  if (!r.ok) return NextResponse.json({ error: 'Corrija os campos destacados.', erros: r.erros }, { status: 400 });
  const db = createAdminClient();
  const { data: dup } = await db.from('partner_offers').select('id').eq('external_product_url', r.dados.external_product_url).limit(1);
  if (dup && dup.length) return NextResponse.json({ error: 'Já existe uma oferta com este link do produto.', codigo: 'duplicada' }, { status: 409 });
  const { data, error } = await db.from('partner_offers')
    .insert({ ...r.dados, last_verified_at: new Date().toISOString(), created_by: a.userId })
    .select('id, slug').single();
  if (error) {
    const dupSlug = (error as any).code === '23505';
    return NextResponse.json({ error: dupSlug ? 'Já existe uma oferta com este nome (slug). Mude o nome ou o slug.' : 'Não foi possível salvar.', codigo: dupSlug ? 'slug_duplicado' : 'erro' }, { status: dupSlug ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, oferta: data }, { status: 201, headers: SEM_CACHE });
}
