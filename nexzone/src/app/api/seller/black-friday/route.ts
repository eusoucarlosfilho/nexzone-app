import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CAMPANHA_BF, faseBF, validarPrecoBF, precoEfetivo } from '@/lib/crescimento';
import { cfgBF } from '@/lib/crescimento-servidor';

export const dynamic = 'force-dynamic';

async function lojaDoUsuario() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  return store ? (store as any).id as string : null;
}

// POST { productId, preco } → inscreve (ou muda o preço) na Black Friday · DELETE { productId } → tira
export async function POST(req: Request) {
  const storeId = await lojaDoUsuario();
  if (!storeId) return NextResponse.json({ error: 'Entre com a conta da loja.' }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  const cfg = await cfgBF(admin);
  if (faseBF(cfg) === 'depois') return NextResponse.json({ error: 'A Black November já terminou.' }, { status: 409 });
  const { data: p } = await admin.from('products').select('id, store_id, status, preco, preco_promo').eq('id', String(b.productId || '')).maybeSingle();
  if (!p || (p as any).store_id !== storeId) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
  if ((p as any).status !== 'ativo') return NextResponse.json({ error: 'Só produtos ativos podem participar.' }, { status: 400 });
  const { data: ja } = await admin.from('campanha_produtos').select('id, aplicado_em, preco_ref').eq('campanha', CAMPANHA_BF).eq('product_id', (p as any).id).maybeSingle();
  if ((ja as any)?.aplicado_em) return NextResponse.json({ error: 'A oferta já está no ar. Para mudar, fale com o suporte.' }, { status: 409 });
  // preço de referência = o de hoje na 1ª inscrição (não muda depois: evita subir o preço para fingir desconto)
  const precoHoje = (ja as any)?.preco_ref ? Number((ja as any).preco_ref) : precoEfetivo(p as any);
  const preco = Math.round(Number(String(b.preco ?? '').replace(',', '.')) * 100) / 100;
  const v = validarPrecoBF(precoHoje, preco, cfg);
  if (!v.ok) return NextResponse.json({ error: v.erro, maximo: v.maximo }, { status: 400 });
  const linha = { campanha: CAMPANHA_BF, product_id: (p as any).id, store_id: storeId, preco_campanha: preco, preco_ref: precoHoje };
  const { error } = await admin.from('campanha_produtos').upsert(linha, { onConflict: 'campanha,product_id' });
  if (error) return NextResponse.json({ error: /campanha_produtos/.test(error.message || '') ? 'A Black Friday ainda não está ativa (falta o SQL 30).' : 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true, preco, precoRef: precoHoje });
}

export async function DELETE(req: Request) {
  const storeId = await lojaDoUsuario();
  if (!storeId) return NextResponse.json({ error: 'Entre com a conta da loja.' }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  const { data: ja } = await admin.from('campanha_produtos').select('id, store_id, aplicado_em').eq('campanha', CAMPANHA_BF).eq('product_id', String(b.productId || '')).maybeSingle();
  if (!ja || (ja as any).store_id !== storeId) return NextResponse.json({ ok: true });
  if ((ja as any).aplicado_em) return NextResponse.json({ error: 'A oferta já está no ar e não pode sair agora.' }, { status: 409 });
  await admin.from('campanha_produtos').delete().eq('id', (ja as any).id);
  return NextResponse.json({ ok: true });
}
