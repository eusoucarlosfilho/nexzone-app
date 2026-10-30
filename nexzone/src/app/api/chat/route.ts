import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verificarEscalonamento } from '@/lib/escalonamento';
import { notificarMensagem } from '@/lib/notificacoes';
import { vendedorPublico } from '@/lib/vendedorPublico';
import { autorizarPedido, registrarVisto, vistoDe, confirmarAnexoChat, entregasEfetivas } from '@/lib/conversas-servidor';
import { AVISO_SEGURANCA, foiLida, pareceContatoExterno } from '@/lib/conversas';

const COLS_NOVAS = 'id, papel, texto, remetente, created_at, anexo_path, anexo_nome, anexo_tipo, anexo_tamanho, alerta';
const COLS_ANTIGAS = 'id, papel, texto, remetente, created_at';

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const orderId = new URL(req.url).searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'sem orderId' }, { status: 400 });

  const auth = await autorizarPedido(orderId, user.id);
  if ('erro' in auth) return NextResponse.json({ error: auth.erro }, { status: auth.erro === 'sem acesso' ? 403 : 404 });
  const { order, papel, admin, dono } = auth;

  // Mensagens automáticas (uma vez) quando o pedido já foi pago
  const pago = ['pago', 'entregue'].includes(order.status);
  const { data: existentes } = await admin.from('order_messages').select('id').eq('order_id', orderId).limit(1);
  if (pago && (!existentes || existentes.length === 0)) {
    const prod: any = order.products;
    await admin.from('order_messages').insert([
      { order_id: orderId, remetente: null, papel: 'sistema', texto: `Pagamento confirmado para "${prod?.titulo ?? 'o produto'}". O vendedor já foi avisado e é notificado a cada mensagem que você envia aqui. É por esta conversa que ele entrega o produto e tira as dúvidas.` },
      { order_id: orderId, remetente: null, papel: 'sistema', texto: `🔒 ${AVISO_SEGURANCA}` },
    ]);
    // Mensagem pós-compra do vendedor (padrão da loja ou do anúncio), em nome dele. NÃO marca o pedido como entregue.
    const pos = String(order.conteudo_liberado ?? '').trim();
    if (pos) {
      try { await admin.from('order_messages').insert({ order_id: orderId, remetente: dono, papel: 'vendedor', texto: pos.slice(0, 2000) }); } catch { /* segue */ }
    }
  }

  let novas = true;
  let r = await admin.from('order_messages').select(COLS_NOVAS).eq('order_id', orderId).order('created_at', { ascending: true });
  if (r.error) { novas = false; r = await admin.from('order_messages').select(COLS_ANTIGAS).eq('order_id', orderId).order('created_at', { ascending: true }) as any; }
  const msgs = (r.data ?? []) as any[];

  // "Lido": registra que esta pessoa viu e lê até quando a OUTRA parte viu (o admin olhando não conta)
  if (papel !== 'admin') await registrarVisto(admin, orderId, user.id);
  const outro = papel === 'comprador' ? dono : papel === 'vendedor' ? order.comprador : null;
  const vistoOutro = novas ? await vistoDe(admin, orderId, outro) : null;

  verificarEscalonamento(admin, orderId).catch(() => {});

  const lista = msgs.map((m) => {
    const mine = m.remetente === user.id;
    return {
      id: m.id, papel: m.papel, texto: m.texto, created_at: m.created_at, mine,
      ...(mine && novas && papel !== 'admin' ? { lido: foiLida(m.created_at, vistoOutro) } : {}),
      ...(m.anexo_path ? { anexo: { url: `/api/chat/anexo?id=${encodeURIComponent(m.id)}`, nome: m.anexo_nome || 'anexo', tipo: m.anexo_tipo || '', tamanho: Number(m.anexo_tamanho) || 0 } } : {}),
      ...(papel === 'admin' && m.alerta ? { alerta: m.alerta } : {}),
    };
  });

  // Situação da entrega só para o painel do vendedor/admin (o comprador vê na página do pedido)
  const ent = papel === 'comprador' ? null : await entregasEfetivas(admin, [{ id: order.id, status: order.status, product_id: order.product_id, conteudo_liberado: order.conteudo_liberado, tipo_anuncio: order.products?.tipo_anuncio }]);

  return NextResponse.json({
    role: papel,
    status: order.status,
    conteudo: order.conteudo_liberado ?? null,
    produto: { titulo: order.products?.titulo ?? 'Produto', emoji: order.products?.emoji ?? '📦' },
    loja: papel === 'comprador' ? vendedorPublico(order.stores).nome : (order.stores?.nome ?? 'Loja'),
    oficial: papel === 'comprador' && vendedorPublico(order.stores).oficial,
    entregue: ent ? !!ent.entregue[order.id] : null,
    recursos: { lido: novas, anexos: novas },
    messages: lista,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b.orderId || '');
  let texto = String(b.texto ?? '').trim().slice(0, 2000);
  if (!orderId || (!texto && !b.anexo)) return NextResponse.json({ error: 'mensagem vazia' }, { status: 400 });

  const auth = await autorizarPedido(orderId, user.id);
  if ('erro' in auth) return NextResponse.json({ error: auth.erro }, { status: auth.erro === 'sem acesso' ? 403 : 404 });
  const { papel, admin } = auth;

  let anexo: { path: string; nome: string; tipo: string; tamanho: number } | null = null;
  if (b.anexo) {
    const c = await confirmarAnexoChat(admin, orderId, b.anexo.path, b.anexo.nome);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    anexo = c;
    if (!texto) texto = `📎 ${c.nome}`;
  }

  // Contato externo: não bloqueia (entrega de conta usa e-mail e números), mas marca para o admin e avisa quem enviou
  const alerta = papel !== 'admin' && pareceContatoExterno(texto) ? 'contato_externo' : null;

  const linha: any = { order_id: orderId, remetente: user.id, papel, texto };
  if (anexo) Object.assign(linha, { anexo_path: anexo.path, anexo_nome: anexo.nome, anexo_tipo: anexo.tipo, anexo_tamanho: anexo.tamanho });
  if (alerta) linha.alerta = alerta;
  let ins = await admin.from('order_messages').insert(linha).select('id, papel, texto, created_at').single();
  if (ins.error && alerta && !anexo) { delete linha.alerta; ins = await admin.from('order_messages').insert(linha).select('id, papel, texto, created_at').single(); } // sem SQL 25
  if (ins.error || !ins.data) return NextResponse.json({ error: anexo ? 'Falta ativar os anexos (SQL 25).' : 'falha ao enviar' }, { status: 500 });
  const msg: any = ins.data;

  await notificarMensagem(admin, { orderId, papel, remetenteId: user.id, texto: msg.texto });

  return NextResponse.json({
    message: { ...msg, mine: true, lido: false, ...(anexo ? { anexo: { url: `/api/chat/anexo?id=${encodeURIComponent(msg.id)}`, nome: anexo.nome, tipo: anexo.tipo, tamanho: anexo.tamanho } } : {}) },
    aviso: alerta ? 'Atenção: trocar telefone, WhatsApp ou redes sociais é proibido e pode suspender a conta. A mensagem foi enviada e registrada para a equipe de segurança.' : null,
  });
}
