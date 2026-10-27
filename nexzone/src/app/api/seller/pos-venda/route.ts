import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { carregarPosVenda, numerosPosVenda, semSql19 } from '@/lib/posVenda-servidor';
import { validarPosVenda } from '@/lib/posVenda';

export const dynamic = 'force-dynamic';

// Construtor do checkout → "Depois da compra": oferta extra (upsell/downsell) e recuperação de carrinho.
async function dono(productId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { erro: NextResponse.json({ error: 'produto inválido' }, { status: 400 }) };
  const admin = createAdminClient();
  const { data: p } = await admin.from('products').select('id, store_id, stores(owner)').eq('id', productId).maybeSingle();
  if (!p || (p as any).stores?.owner !== user.id) return { erro: NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 }) };
  return { admin, storeId: (p as any).store_id as string };
}

export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get('productId') || '';
  const d = await dono(productId);
  if (d.erro) return d.erro;
  const { sql19, cfg } = await carregarPosVenda(d.admin, productId);
  if (!sql19) return NextResponse.json({ sql19: false }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ sql19: true, cfg, numeros: await numerosPosVenda(d.admin, productId) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {}
  const productId = String(b.productId || '');
  const d = await dono(productId);
  if (d.erro) return d.erro;
  const { data: outros } = await d.admin.from('products').select('id').eq('store_id', d.storeId).eq('status', 'ativo').neq('id', productId).limit(500);
  const v = validarPosVenda(b, productId, new Set(((outros ?? []) as any[]).map((x) => String(x.id).toLowerCase())));
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  const { error } = await d.admin.from('produto_pos_venda').upsert({ ...v.linha, atualizado_em: new Date().toISOString() });
  if (error) {
    if (semSql19(error)) return NextResponse.json({ error: 'Rode o SQL 19 no Supabase para ativar.' }, { status: 503 });
    console.error('[seller/pos-venda]', error.message);
    return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  const { cfg } = await carregarPosVenda(d.admin, productId);
  return NextResponse.json({ ok: true, cfg });
}
