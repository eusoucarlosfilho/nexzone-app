import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { autorizarPedido } from '@/lib/conversas-servidor';

export const dynamic = 'force-dynamic';

// Vendedor: lista os produtos ATIVOS da própria loja para indicar ao cliente no chat, do MAIS vendido ao menos vendido. GET ?orderId=
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const orderId = new URL(req.url).searchParams.get('orderId') || '';
  const auth = await autorizarPedido(orderId, user.id);
  if ('erro' in auth || auth.papel !== 'vendedor') return NextResponse.json({ error: 'sem acesso' }, { status: 403 });
  const { data } = await auth.admin.from('products').select('id, titulo, preco, preco_promo, capa_url, vendas').eq('store_id', auth.order.store_id).eq('status', 'ativo').order('vendas', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(500);
  const produtos = ((data ?? []) as any[]).map((p) => {
    const promo = p.preco_promo != null && Number(p.preco_promo) < Number(p.preco);
    return { id: p.id, titulo: p.titulo, preco: Number(promo ? p.preco_promo : p.preco), precoDe: promo ? Number(p.preco) : null, capa_url: p.capa_url ?? null, vendas: Number(p.vendas) || 0 };
  });
  return NextResponse.json({ produtos }, { headers: { 'Cache-Control': 'private, no-store' } });
}
