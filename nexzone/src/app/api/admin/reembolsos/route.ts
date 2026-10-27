import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { adminSeguro } from '@/lib/ofertas/adminSeguro';
import { marcarReembolsado } from '@/lib/reembolso-servidor';
import { semSql18 } from '@/lib/curso-servidor';

export const dynamic = 'force-dynamic';

// Admin → Reembolsos.
//   GET  ?status=aberto|todos  → lista com o pedido, a forma de pagamento e o código no gateway
//   POST { id, acao: 'aprovar' | 'recusar', resposta? }
// "Aprovar" registra que o dinheiro foi devolvido: o admin devolve no painel do gateway (Pix na MisticPay,
// cartão na Stripe) e confirma aqui. O site marca o pedido como reembolsado e tira o saldo do vendedor.
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}

export async function GET(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const status = new URL(req.url).searchParams.get('status') === 'todos' ? null : 'aberto';
  let q = admin.from('reembolso_pedidos').select('id, order_id, motivo, detalhe, status, resposta, created_at, decidido_em').order('id', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ sql18: !semSql18(error), itens: [] });
  const ids = Array.from(new Set(((data ?? []) as any[]).map((r) => r.order_id)));
  const reforcado = (await adminSeguro()).ok;
  const pedidos: Record<string, any> = {};
  if (ids.length) {
    const { data: os } = await admin.from('orders').select('*, products(titulo), stores(nome)').in('id', ids);
    for (const o of (os ?? []) as any[]) {
      pedidos[o.id] = {
        total: Number(o.total), status: o.status, pago_em: o.entregue_em || o.created_at, forma: o.forma_pagamento ?? null,
        gateway_ref: reforcado ? o.gateway_ref : null, comprador_email: reforcado ? o.comprador_email : null,
        produto: o.products?.titulo ?? 'Produto', loja: o.stores?.nome ?? '—',
      };
    }
  }
  const { count } = await admin.from('reembolso_pedidos').select('id', { count: 'exact', head: true }).eq('status', 'aberto');
  return NextResponse.json({ sql18: true, abertos: count ?? 0, itens: ((data ?? []) as any[]).map((r) => ({ ...r, pedido: pedidos[r.order_id] ?? null })) });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const id = Math.floor(Number(b.id));
  if (!(id > 0) || !['aprovar', 'recusar'].includes(b.acao)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const resposta = String(b.resposta ?? '').trim().slice(0, 2000);
  if (b.acao === 'recusar' && resposta.length < 10) return NextResponse.json({ error: 'Explique ao cliente o motivo da recusa.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: r } = await admin.from('reembolso_pedidos').select('id, order_id, status').eq('id', id).maybeSingle();
  if (!r) return NextResponse.json({ error: 'Pedido de reembolso não encontrado.' }, { status: 404 });
  if ((r as any).status !== 'aberto') return NextResponse.json({ error: 'Este pedido já foi decidido.' }, { status: 409 });

  if (b.acao === 'aprovar') {
    const m = await marcarReembolsado(admin, (r as any).order_id);
    if (!m.ok) return NextResponse.json({ error: m.erro }, { status: 400 });
  }
  const { data: upd, error } = await admin.from('reembolso_pedidos').update({
    status: b.acao === 'aprovar' ? 'aprovado' : 'recusado', resposta: resposta || null, decidido_por: a.user!.id, decidido_em: new Date().toISOString(),
  }).eq('id', id).eq('status', 'aberto').select('id');
  if (error || !upd?.length) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });

  await admin.from('order_messages').insert({
    order_id: (r as any).order_id, remetente: null, papel: 'sistema',
    texto: b.acao === 'aprovar'
      ? `Reembolso aprovado pela equipe. O valor volta pela mesma forma de pagamento (Pix: na hora; cartão: até 2 faturas).${resposta ? `\n\n${resposta}` : ''}`
      : `Reembolso não aprovado pela equipe.\n\n${resposta}`,
  });
  return NextResponse.json({ ok: true });
}
