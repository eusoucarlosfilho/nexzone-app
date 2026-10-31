import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

// Destaque de produto NATIVO na faixa do topo da página inicial (products.destaque_ate).
// Só admins listados em ADMIN_USER_IDS (C1). Só produtos ativos aparecem no site, mas o destaque
// pode ser marcado antes (vale quando o produto voltar a ficar ativo, até a data).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIAS = new Set([0, 7, 15, 30, 60, 90]);
const SEM_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'produto inválido' }, { status: 400, headers: SEM_CACHE });
  const { data, error } = await createAdminClient().from('products').select('id, status, destaque_ate').eq('id', id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'produto não encontrado' }, { status: 404, headers: SEM_CACHE });
  return NextResponse.json({ id: data.id, status: data.status, destaque_ate: data.destaque_ate }, { headers: SEM_CACHE });
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || '');
  const dias = Number(body?.dias);
  if (!UUID.test(id)) return NextResponse.json({ error: 'produto inválido' }, { status: 400, headers: SEM_CACHE });
  if (!DIAS.has(dias)) return NextResponse.json({ error: 'prazo inválido' }, { status: 400, headers: SEM_CACHE });
  const destaque_ate = dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null;
  const { data, error } = await createAdminClient().from('products').update({ destaque_ate }).eq('id', id).select('id, status, destaque_ate').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'falha ao salvar' }, { status: 500, headers: SEM_CACHE });
  await registrarAcao({ adminId: a.userId, acao: 'produto_destaque', alvoTipo: 'produto', alvoId: id, detalhes: { dias } });
  return NextResponse.json({ ok: true, id: data.id, status: data.status, destaque_ate: data.destaque_ate }, { headers: SEM_CACHE });
}
