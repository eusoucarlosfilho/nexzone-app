import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verificarEscalonamento } from '@/lib/escalonamento';
import { notificarMensagem } from '@/lib/notificacoes';
import { vendedorPublico } from '@/lib/vendedorPublico';
import { autorizarPedido, registrarVisto, confirmarAnexoChat, entregasEfetivas, estadoDoChat, cartoesDeProduto, avisarAdminsRetida } from '@/lib/conversas-servidor';
import { AVISO_SEGURANCA, AVISO_RETIDA, TEXTO_RETIDA, pareceContatoExterno, produtosNaMensagem } from '@/lib/conversas';

const COLS_29 = 'id, papel, texto, remetente, created_at, anexo_path, anexo_nome, anexo_tipo, anexo_tamanho, alerta, retido_texto';
const COLS_25 = 'id, papel, texto, remetente, created_at, anexo_path, anexo_nome, anexo_tipo, anexo_tamanho, alerta';
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

  let nivel = 29;
  let r: any = await admin.from('order_messages').select(COLS_29).eq('order_id', orderId).order('created_at', { ascending: true });
  if (r.error) { nivel = 25; r = await admin.from('order_messages').select(COLS_25).eq('order_id', orderId).order('created_at', { ascending: true }); }
  if (r.error) { nivel = 0; r = await admin.from('order_messages').select(COLS_ANTIGAS).eq('order_id', orderId).order('created_at', { ascending: true }); }
  const msgs = (r.data ?? []) as any[];

  // Registra até quando ESTA pessoa viu a conversa (só para a etiqueta "Nova mensagem" do próprio painel).
  // A confirmação de leitura NÃO é mostrada para a outra parte: cada um vê só "Enviado".
  if (papel !== 'admin') await registrarVisto(admin, orderId, user.id);

  verificarEscalonamento(admin, orderId).catch(() => {});

  // Mensagem retida (contato externo): só quem enviou e o admin veem o texto; a outra parte vê o aviso
  const lista = msgs.map((m) => {
    const mine = m.remetente === user.id;
    const retida = !!m.retido_texto;
    const podeVer = !retida || mine || papel === 'admin';
    const texto = retida && podeVer ? m.retido_texto : m.texto;
    return {
      id: m.id, papel: m.papel, texto, created_at: m.created_at, mine,
      ...(retida ? { retida: true } : {}),
      ...(m.anexo_path && podeVer ? { anexo: { url: `/api/chat/anexo?id=${encodeURIComponent(m.id)}`, nome: m.anexo_nome || 'anexo', tipo: m.anexo_tipo || '', tamanho: Number(m.anexo_tamanho) || 0 } } : {}),
      ...(papel === 'admin' && m.alerta ? { alerta: m.alerta } : {}),
    };
  });

  // Cartões dos produtos citados por link (vendedor indicando outro produto)
  const ids = Array.from(new Set(lista.flatMap((m) => (m.papel === 'sistema' ? [] : produtosNaMensagem(m.texto)))));
  const [ent, estado, produtos] = await Promise.all([
    // Situação da entrega só para o painel do vendedor/admin (o comprador vê na página do pedido)
    papel === 'comprador' ? Promise.resolve(null) : entregasEfetivas(admin, [{ id: order.id, status: order.status, product_id: order.product_id, conteudo_liberado: order.conteudo_liberado, tipo_anuncio: order.products?.tipo_anuncio }]),
    estadoDoChat(admin, order),
    cartoesDeProduto(admin, ids),
  ]);

  return NextResponse.json({
    role: papel,
    status: order.status,
    conteudo: order.conteudo_liberado ?? null,
    produto: { titulo: order.products?.titulo ?? 'Produto', emoji: order.products?.emoji ?? '📦' },
    loja: papel === 'comprador' ? vendedorPublico(order.stores).nome : (order.stores?.nome ?? 'Loja'),
    oficial: papel === 'comprador' && vendedorPublico(order.stores).oficial,
    entregue: ent ? !!ent.entregue[order.id] : null,
    chat: { fechado: estado.fechado && papel !== 'admin', fechaEm: estado.fechaEm },
    recursos: { anexos: nivel >= 25, produtos: papel === 'vendedor' },
    produtos,
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
  const { papel, admin, order } = auth;

  // Conversa encerrada (fim da garantia ou venda reembolsada): só o admin ainda escreve
  if (papel !== 'admin') {
    const est = await estadoDoChat(admin, order);
    if (est.fechado) return NextResponse.json({ error: 'Esta conversa foi encerrada. O histórico continua salvo aqui. Se precisar, fale com o suporte.' }, { status: 409 });
  }

  let anexo: { path: string; nome: string; tipo: string; tamanho: number } | null = null;
  if (b.anexo) {
    const c = await confirmarAnexoChat(admin, orderId, b.anexo.path, b.anexo.nome);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    anexo = c;
    if (!texto) texto = `📎 ${c.nome}`;
  }

  // Contato externo (WhatsApp, zap, wpp, ctt, contato, telefone, redes…): a mensagem fica RETIDA.
  // A outra parte vê só o aviso; o admin é avisado para analisar e pode liberar.
  const reter = papel !== 'admin' && pareceContatoExterno(texto);

  const linha: any = { order_id: orderId, remetente: user.id, papel, texto };
  if (anexo) Object.assign(linha, { anexo_path: anexo.path, anexo_nome: anexo.nome, anexo_tipo: anexo.tipo, anexo_tamanho: anexo.tamanho });
  if (reter) Object.assign(linha, { texto: TEXTO_RETIDA, retido_texto: texto, alerta: 'retida' });
  let ins = await admin.from('order_messages').insert(linha).select('id, papel, texto, created_at').single();
  if (ins.error && reter) {
    // Sem o SQL 29 não dá para reter: não envia e explica (nunca deixa o contato passar)
    return NextResponse.json({ error: 'Por segurança, não é permitido trocar WhatsApp, telefone, e-mail ou redes sociais aqui. Combine tudo pela conversa.' }, { status: 400 });
  }
  if (ins.error || !ins.data) return NextResponse.json({ error: anexo ? 'Falta ativar os anexos (SQL 25).' : 'falha ao enviar' }, { status: 500 });
  const msg: any = ins.data;

  if (reter) {
    await admin.from('order_messages').insert({ order_id: orderId, remetente: null, papel: 'sistema', texto: AVISO_RETIDA });
    await avisarAdminsRetida(admin, orderId, order.products?.titulo || 'um pedido', papel);
  } else {
    await notificarMensagem(admin, { orderId, papel, remetenteId: user.id, texto: msg.texto });
  }

  return NextResponse.json({
    message: { ...msg, texto, mine: true, ...(reter ? { retida: true } : {}), ...(anexo ? { anexo: { url: `/api/chat/anexo?id=${encodeURIComponent(msg.id)}`, nome: anexo.nome, tipo: anexo.tipo, tamanho: anexo.tamanho } } : {}) },
    aviso: reter ? 'Sua mensagem foi retida: trocar WhatsApp, telefone, e-mail ou redes sociais é proibido. O suporte foi avisado e vai analisar.' : null,
  });
}
