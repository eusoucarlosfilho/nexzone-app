import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { verificarEscalonamento } from '@/lib/escalonamento';

// Descobre o papel do usuário em relação ao pedido e devolve dados do pedido.
async function autorizar(orderId: string, userId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders')
    .select('id, comprador, store_id, status, conteudo_liberado, products(titulo, emoji), stores(nome)')
    .eq('id', orderId).maybeSingle();
  if (!order) return { erro: 'pedido não encontrado' as const };

  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  const isAdmin = prof?.role === 'admin';

  let papel: 'comprador' | 'vendedor' | 'admin' | null = null;
  if ((order as any).comprador === userId) papel = 'comprador';
  else {
    const { data: store } = await admin.from('stores').select('id').eq('id', (order as any).store_id).eq('owner', userId).maybeSingle();
    if (store) papel = 'vendedor';
    else if (isAdmin) papel = 'admin';
  }
  if (!papel) return { erro: 'sem acesso' as const };
  return { order, papel, admin };
}

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const orderId = new URL(req.url).searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'sem orderId' }, { status: 400 });

  const auth = await autorizar(orderId, user.id);
  if ('erro' in auth) return NextResponse.json({ error: auth.erro }, { status: auth.erro === 'sem acesso' ? 403 : 404 });
  const { order, papel, admin } = auth;

  // Mensagem de sistema automática (uma vez) quando o pedido já foi pago
  const pago = ['pago', 'entregue'].includes((order as any).status);
  const { data: existentes } = await admin.from('order_messages').select('id').eq('order_id', orderId).limit(1);
  if (pago && (!existentes || existentes.length === 0)) {
    const prod: any = (order as any).products;
    await admin.from('order_messages').insert({
      order_id: orderId, remetente: null, papel: 'sistema',
      texto: `Pagamento confirmado para "${prod?.titulo ?? 'o produto'}". O vendedor já foi avisado da sua compra e é notificado a cada mensagem que você envia aqui. A partir de agora vocês podem conversar por aqui — o vendedor entrega o produto e tira as dúvidas nesta conversa.`,
    });
  }

  const { data: msgs } = await admin.from('order_messages')
    .select('id, papel, texto, remetente, created_at')
    .eq('order_id', orderId).order('created_at', { ascending: true });

  // Verifica (sem travar a resposta) se o vendedor passou do prazo sem responder
  verificarEscalonamento(admin, orderId).catch(() => {});

  const lista = (msgs ?? []).map((m: any) => ({
    id: m.id, papel: m.papel, texto: m.texto, created_at: m.created_at,
    mine: m.remetente === user.id,
  }));

  return NextResponse.json({
    role: papel,
    status: (order as any).status,
    conteudo: (order as any).conteudo_liberado ?? null,
    produto: { titulo: (order as any).products?.titulo ?? 'Produto', emoji: (order as any).products?.emoji ?? '📦' },
    loja: (order as any).stores?.nome ?? 'Loja',
    messages: lista,
  });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { orderId, texto } = await req.json();
  if (!orderId || !texto || !String(texto).trim()) return NextResponse.json({ error: 'mensagem vazia' }, { status: 400 });

  const auth = await autorizar(orderId, user.id);
  if ('erro' in auth) return NextResponse.json({ error: auth.erro }, { status: auth.erro === 'sem acesso' ? 403 : 404 });
  const { papel, admin } = auth;

  const { data: msg, error } = await admin.from('order_messages').insert({
    order_id: orderId, remetente: user.id, papel, texto: String(texto).trim().slice(0, 2000),
  }).select('id, papel, texto, created_at').single();
  if (error || !msg) return NextResponse.json({ error: 'falha ao enviar' }, { status: 500 });

  return NextResponse.json({ message: { ...msg, mine: true } });
}
