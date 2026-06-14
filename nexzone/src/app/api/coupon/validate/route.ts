import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { codigo, productId } = await req.json();
  const code = String(codigo || '').trim().toUpperCase();
  if (!code) return NextResponse.json({ error: 'informe o cupom' }, { status: 400 });

  const admin = createAdminClient();
  const { data: product } = await admin.from('products').select('id, store_id, preco, preco_promo').eq('id', productId).single();
  if (!product) return NextResponse.json({ error: 'produto inválido' }, { status: 404 });

  const { data: cup } = await admin.from('coupons')
    .select('*').eq('store_id', product.store_id).eq('codigo', code).maybeSingle();
  if (!cup || !cup.ativo) return NextResponse.json({ error: 'Cupom inválido.' }, { status: 404 });
  if (cup.expira_em && new Date(cup.expira_em) < new Date()) return NextResponse.json({ error: 'Cupom expirado.' }, { status: 400 });
  if (cup.max_usos != null && cup.usos >= cup.max_usos) return NextResponse.json({ error: 'Cupom esgotado.' }, { status: 400 });
  if (cup.product_id && cup.product_id !== productId) return NextResponse.json({ error: 'Cupom não vale para este produto.' }, { status: 400 });

  const preco = Number(product.preco_promo ?? product.preco);
  const desconto = cup.tipo === 'percent' ? +(preco * (Number(cup.valor) / 100)).toFixed(2) : Math.min(Number(cup.valor), preco);
  const final = Math.max(0, +(preco - desconto).toFixed(2));
  return NextResponse.json({ ok: true, codigo: code, tipo: cup.tipo, valor: Number(cup.valor), desconto, final });
}
