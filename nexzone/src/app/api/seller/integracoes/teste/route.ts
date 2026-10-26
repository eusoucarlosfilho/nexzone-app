import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { decifrar } from '@/lib/whatsapp/config';
import { testarPostback } from '@/lib/eventosVenda-servidor';

// Sprint 2 — "Enviar teste" do postback (dados fictícios, assinado com o segredo salvo).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { productId } = await req.json().catch(() => ({}));
  if (!UUID.test(String(productId || ''))) return NextResponse.json({ error: 'produto inválido' }, { status: 400 });
  const { data: p } = await supabase.from('products').select('id, titulo, stores!inner(owner)').eq('id', productId).maybeSingle();
  if (!p || (p as any).stores?.owner !== user.id) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });

  const admin = createAdminClient();
  const { data: i } = await admin.from('produto_integracoes').select('postback_url, postback_segredo').eq('product_id', productId).maybeSingle();
  if (!i?.postback_url || !i?.postback_segredo) return NextResponse.json({ error: 'Salve o link do postback primeiro.' }, { status: 400 });
  const r = await testarPostback(admin, productId, (p as any).titulo, i.postback_url, decifrar(i.postback_segredo));
  return NextResponse.json({ ok: r.ok, status: r.status ?? null, resposta: (r.resposta || '').slice(0, 200) }, { status: 200 });
}
