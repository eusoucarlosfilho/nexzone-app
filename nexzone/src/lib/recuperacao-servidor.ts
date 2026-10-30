// ============================================================
// Recuperação de vendas — pedidos e carrinhos ANTIGOS (botão no admin e no painel do vendedor). SÓ SERVIDOR.
// Sem escopo = plataforma inteira (Sala de comando). Com escopo = só a loja do vendedor.
// Os lembretes automáticos (X minutos e 24 h) ficam em eventosVenda-servidor (Pix) e posVenda-servidor (carrinho).
// Regras: um lembrete por pedido/carrinho, só quem aceitou avisos no WhatsApp, quem já comprou não é incomodado,
// poucos por vez e com intervalo (protege o número conectado de bloqueio).
// ============================================================
import { avisarWhatsApp, link } from './whatsapp/enviar';
import { sendEmail, layoutEmail, emailDoUsuario, moneyBR, esc, SITE_URL } from './email';
import { linkRecuperacao } from './posVenda';
import { carregarPosVenda } from './posVenda-servidor';
import { montarFila, chaveRecuperacao, type ItemFila, type Canal } from './filaRecuperacao';
import { contatosDosCompradores } from './clientesPedidos';

/** Limita a busca a uma loja (painel do vendedor). storeId filtra os pedidos; productIds, os carrinhos. */
export type Escopo = { storeId?: string; productIds?: string[] };

const DIA = 86400000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function jaComprou(admin: any, comprador: string | null, email: string | null, productId: string) {
  let q = admin.from('orders').select('id', { count: 'exact', head: true }).eq('product_id', productId).in('status', ['pago', 'entregue']);
  q = comprador ? q.eq('comprador', comprador) : q.eq('comprador_email', email);
  const { count } = await q;
  return (count ?? 0) > 0;
}

/** Pedidos com Pix não pago de 2 h a N dias atrás que ainda não receberam lembrete de 24 h nem o "retro". */
export async function pedidosAntigos(admin: any, dias = 7, escopo: Escopo = {}) {
  const agora = Date.now();
  let q = admin.from('orders')
    .select('id, comprador, comprador_email, product_id, total, created_at, products(titulo)')
    .eq('status', 'pendente').not('pix_code', 'is', null)
    .gte('created_at', new Date(agora - dias * DIA).toISOString())
    .lte('created_at', new Date(agora - 2 * 3600000).toISOString())
    .order('created_at', { ascending: false }).limit(500);
  if (escopo.storeId) q = q.eq('store_id', escopo.storeId);
  const { data, error } = await q;
  if (error) return [];
  const lista = (data ?? []) as any[];
  if (!lista.length) return [];
  const { data: ja } = await admin.from('lembretes_pix').select('order_id').in('order_id', lista.map((o) => o.id)).in('etapa', ['24h', 'retro']);
  const feitos = new Set(((ja ?? []) as any[]).map((r) => r.order_id));
  // um lembrete por pessoa + produto (quem gerou 3 Pix do mesmo produto recebe 1 mensagem)
  const vistos = new Set<string>();
  return lista.filter((o) => {
    if (feitos.has(o.id)) return false;
    const k = `${o.comprador || o.comprador_email}:${o.product_id}`;
    if (vistos.has(k)) return false;
    vistos.add(k); return true;
  });
}

/** Carrinhos (se identificou e não gerou Pix) de 2 h a N dias atrás sem o lembrete de 24 h. */
export async function carrinhosAntigos(admin: any, dias = 7, escopo: Escopo = {}) {
  if (escopo.productIds && !escopo.productIds.length) return [];
  const agora = Date.now();
  let q = admin.from('carrinhos_abandonados')
    .select('id, product_id, user_id, email, nome, atualizado_em, products(titulo, status)')
    .is('convertido_em', null).is('lembrete_24h', null)
    .gte('atualizado_em', new Date(agora - dias * DIA).toISOString())
    .lte('atualizado_em', new Date(agora - 2 * 3600000).toISOString())
    .order('atualizado_em', { ascending: false }).limit(500);
  if (escopo.productIds) q = q.in('product_id', escopo.productIds);
  const { data, error } = await q;
  if (error) return [];
  return ((data ?? []) as any[]).filter((c) => c.products?.status === 'ativo');
}

/** Envia para os antigos, no máximo `limite` por vez, com intervalo entre um e outro. */
export async function recuperarAntigos(admin: any, { dias = 7, limite = 12, intervaloMs = 2000, escopo = {} as Escopo } = {}) {
  let enviados = 0, pulados = 0;
  // Não manda para quem desistiu nem para quem alguém já chamou à mão nas últimas 24 h (SQL 26)
  const pausados = await chavesPausadas(admin, 24);
  const inicio = Date.now();
  const noPrazo = () => Date.now() - inicio < 45000; // a função da Vercel tem 60 s

  for (const o of await pedidosAntigos(admin, dias, escopo)) {
    if (enviados >= limite || !noPrazo()) break;
    if (pausados.has(chaveRecuperacao(o.comprador_email, o.comprador, o.product_id))) { pulados++; continue; }
    if (await jaComprou(admin, o.comprador, o.comprador_email, o.product_id)) { pulados++; continue; }
    const { error: trava } = await admin.from('lembretes_pix').insert({ order_id: o.id, etapa: 'retro' });
    if (trava) { pulados++; continue; }
    const titulo = o.products?.titulo || 'seu produto';
    const destino = link(`/checkout/${o.product_id}`);
    const canais: string[] = [];
    await avisarWhatsApp({ evento: 'pix_lembrete_24h', chave: `pix_lembrete_retro:${o.id}`, userId: o.comprador, vars: { produto: titulo, valor: moneyBR(o.total), pedido: String(o.id).slice(0, 8), link: destino } });
    canais.push('whatsapp');
    const email = o.comprador_email || (await emailDoUsuario(admin, o.comprador));
    if (email) {
      const assunto = `Ainda quer ${titulo}?`;
      const corpo = `<p style="margin:0 0 12px 0;">Vimos que você não concluiu a compra de <b>${esc(titulo)}</b>.</p><p style="margin:0;">Se ainda quiser, é só gerar um novo Pix: leva menos de um minuto e o acesso é imediato.</p>`;
      const r = await sendEmail({ to: email, tag: 'outro', subject: assunto, html: layoutEmail({ titulo: assunto, preheader: assunto, texto: corpo, botaoTexto: 'Finalizar minha compra', botaoUrl: destino }) });
      if (r.ok) canais.push('email');
    }
    await admin.from('lembretes_pix').update({ canais }).eq('order_id', o.id).eq('etapa', 'retro');
    enviados++;
    await espera(intervaloMs);
  }

  for (const c of await carrinhosAntigos(admin, dias, escopo)) {
    if (enviados >= limite || !noPrazo()) break;
    if (pausados.has(chaveRecuperacao(c.email, c.user_id, c.product_id))) { pulados++; continue; }
    if (await jaComprou(admin, c.user_id, c.email, c.product_id)) { pulados++; await admin.from('carrinhos_abandonados').update({ lembrete_24h: new Date().toISOString() }).eq('id', c.id); continue; }
    const { data: marcado } = await admin.from('carrinhos_abandonados').update({ lembrete_24h: new Date().toISOString() }).eq('id', c.id).is('lembrete_24h', null).select('id');
    if (!marcado?.length) { pulados++; continue; }
    const titulo = c.products?.titulo || 'o produto';
    // usa o cupom de recuperação que o vendedor configurou no Checkout do produto (se tiver)
    const cupom = await carregarPosVenda(admin, c.product_id).then((r) => r.cfg.recuperacao.cupom).catch(() => null);
    const destino = linkRecuperacao(SITE_URL, c.product_id, c.email, cupom);
    if (c.user_id) await avisarWhatsApp({ evento: 'carrinho_24h', chave: `carrinho_retro:${c.id}`, userId: c.user_id, vars: { produto: titulo, link: destino, cupom: cupom || '' } });
    if (c.email) {
      const assunto = `Ainda dá tempo: ${titulo}`;
      const primeiro = esc(String(c.nome || '').split(' ')[0]);
      const cupomTxt = cupom ? `<p style="margin:0 0 12px 0;">Use o cupom <b>${esc(cupom)}</b> — ele já vai aplicado pelo botão abaixo.</p>` : '';
      const corpo = `<p style="margin:0 0 12px 0;">${primeiro ? `Oi, ${primeiro}! ` : ''}Você começou a compra de <b>${esc(titulo)}</b> e não terminou.</p>${cupomTxt}<p style="margin:0;">É rapidinho: Pix ou cartão, e o acesso chega na hora.</p>`;
      await sendEmail({ to: c.email, tag: 'outro', subject: assunto, html: layoutEmail({ titulo: assunto, preheader: assunto, texto: corpo, botaoTexto: 'Finalizar minha compra', botaoUrl: destino }) });
    }
    enviados++;
    await espera(intervaloMs);
  }

  const el = await antigosElegiveis(admin, dias, escopo);
  const restantes = el.pedidos.length + el.carrinhos.length;
  return { enviados, pulados, restantes };
}

// ============================================================
// Fila de recuperação (SQL 26): uma linha por pessoa + produto, com o histórico de tudo que já saiu.
// ============================================================

const EVENTOS_RECUP = ['pix_gerado', 'pix_lembrete', 'pix_lembrete_24h', 'carrinho_1h', 'carrinho_24h'];

/** Clientes pausados: marcados como "Desistiu" (+ contatados à mão nas últimas `horasManual` h, se pedido). */
export async function chavesPausadas(admin: any, horasManual = 0): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const { data } = await admin.from('recuperacao_situacao').select('chave').eq('situacao', 'desistiu').limit(5000);
    ((data ?? []) as any[]).forEach((r) => out.add(r.chave));
    if (horasManual > 0) {
      const { data: m } = await admin.from('recuperacao_contatos').select('chave').gte('created_at', new Date(Date.now() - horasManual * 3600000).toISOString()).limit(5000);
      ((m ?? []) as any[]).forEach((r) => out.add(r.chave));
    }
  } catch { /* sem SQL 26 */ }
  return out;
}

/** Cliente marcou "Desistiu"? (os lembretes automáticos param para ele) */
export async function recuperacaoPausada(admin: any, email: string | null | undefined, userId: string | null | undefined, productId: string): Promise<boolean> {
  try {
    const { data, error } = await admin.from('recuperacao_situacao').select('chave').eq('chave', chaveRecuperacao(email, userId, productId)).maybeSingle();
    return !error && !!data;
  } catch { return false; }
}

export async function filaDeRecuperacao(admin: any, dias = 7): Promise<{ itens: ItemFila[]; sql26: boolean }> {
  const desde = new Date(Date.now() - dias * DIA).toISOString();
  const [pixR, cartR] = await Promise.all([
    admin.from('orders').select('id, comprador, comprador_email, product_id, total, created_at, products(titulo, stores(nome))')
      .eq('status', 'pendente').not('pix_code', 'is', null).gte('created_at', desde).order('created_at', { ascending: false }).limit(400),
    admin.from('carrinhos_abandonados').select('id, product_id, user_id, email, nome, criado_em, atualizado_em, lembrete_1h, lembrete_24h, products(titulo, preco, preco_promo, status, stores(nome))')
      .is('convertido_em', null).gte('atualizado_em', desde).order('atualizado_em', { ascending: false }).limit(400),
  ]);
  const pixRaw = ((pixR.data ?? []) as any[]);
  const cartRaw = ((cartR.error ? [] : cartR.data ?? []) as any[]).filter((c) => c.products?.status === 'ativo');

  // Quem pagou (ou gerou Pix, no caso do carrinho) do mesmo produto depois sai da fila
  const prods = Array.from(new Set([...pixRaw, ...cartRaw].map((x) => x.product_id)));
  const { data: depois } = prods.length
    ? await admin.from('orders').select('comprador, comprador_email, product_id, status, created_at').in('product_id', prods).in('status', ['pendente', 'pago', 'entregue']).gte('created_at', desde).limit(5000)
    : { data: [] };
  const ords = (depois ?? []) as any[];
  const mesmo = (o: any, user: string | null, email: string | null, prod: string) => o.product_id === prod
    && ((user && o.comprador === user) || (email && String(o.comprador_email || '').toLowerCase() === String(email).toLowerCase()));
  const pix = pixRaw.filter((p) => !ords.some((o) => ['pago', 'entregue'].includes(o.status) && mesmo(o, p.comprador, p.comprador_email, p.product_id) && o.created_at >= p.created_at));
  const carrinhos = cartRaw.filter((c) => !ords.some((o) => mesmo(o, c.user_id, c.email, c.product_id) && new Date(o.created_at).getTime() >= new Date(c.atualizado_em).getTime() - 10 * 60000));

  const userIds = Array.from(new Set([...pix.map((p) => p.comprador), ...carrinhos.map((c) => c.user_id)].filter(Boolean)));
  const [logs, lembretes, manuais, desist, contatos] = await Promise.all([
    userIds.length ? admin.from('whatsapp_log').select('evento, chave, status, created_at, enviado_em').in('user_id', userIds.slice(0, 500)).in('evento', EVENTOS_RECUP).gte('created_at', desde).limit(3000) : Promise.resolve({ data: [] }),
    pix.length ? admin.from('lembretes_pix').select('order_id, etapa, enviado_em, canais').in('order_id', pix.map((p) => p.id).slice(0, 400)) : Promise.resolve({ data: [] }),
    admin.from('recuperacao_contatos').select('chave, canal, por_nome, created_at').gte('created_at', desde).order('created_at', { ascending: true }).limit(3000),
    admin.from('recuperacao_situacao').select('chave').eq('situacao', 'desistiu').limit(5000),
    contatosDosCompradores(admin, userIds as string[]),
  ]);
  const sql26 = !(manuais as any).error;
  const itens = montarFila({
    pix: pix.map((p) => ({ id: p.id, comprador: p.comprador, comprador_email: p.comprador_email, product_id: p.product_id, total: Number(p.total), created_at: p.created_at, titulo: p.products?.titulo || 'Produto', loja: p.products?.stores?.nome ?? null })),
    carrinhos: carrinhos.map((c) => ({ id: c.id, product_id: c.product_id, user_id: c.user_id, email: c.email, nome: c.nome, atualizado_em: c.atualizado_em, titulo: c.products?.titulo || 'Produto', loja: c.products?.stores?.nome ?? null, preco: c.products?.preco_promo ?? c.products?.preco ?? null, lembrete_1h: c.lembrete_1h, lembrete_24h: c.lembrete_24h })),
    logs: (((logs as any).data ?? []) as any[]),
    lembretes: (((lembretes as any).data ?? []) as any[]),
    manuais: sql26 ? (((manuais as any).data ?? []) as any[]) : [],
    desistiu: new Set((((desist as any).error ? [] : (desist as any).data ?? []) as any[]).map((r) => r.chave)),
    contatos,
  });
  return { itens, sql26 };
}

export async function registrarContato(admin: any, chave: string, canal: Canal, por: { id: string; nome: string | null }) {
  const { error } = await admin.from('recuperacao_contatos').insert({ chave: chave.slice(0, 200), canal, por: por.id, por_nome: (por.nome || 'Admin').slice(0, 80) });
  return !error;
}

export async function marcarSituacao(admin: any, chave: string, desistiu: boolean, por: { id: string; nome: string | null }) {
  const r = desistiu
    ? await admin.from('recuperacao_situacao').upsert({ chave: chave.slice(0, 200), situacao: 'desistiu', por: por.id, por_nome: (por.nome || 'Admin').slice(0, 80), atualizado_em: new Date().toISOString() })
    : await admin.from('recuperacao_situacao').delete().eq('chave', chave);
  return !r.error;
}

/** Antigos que o botão "Chamar quem ficou para trás" vai chamar (sem quem desistiu ou já foi chamado à mão nas últimas 24 h). */
export async function antigosElegiveis(admin: any, dias = 7, escopo: Escopo = {}) {
  const [pedidos, carrinhos, pausados] = await Promise.all([pedidosAntigos(admin, dias, escopo), carrinhosAntigos(admin, dias, escopo), chavesPausadas(admin, 24)]);
  return {
    pedidos: pedidos.filter((o: any) => !pausados.has(chaveRecuperacao(o.comprador_email, o.comprador, o.product_id))),
    carrinhos: carrinhos.filter((c: any) => !pausados.has(chaveRecuperacao(c.email, c.user_id, c.product_id))),
  };
}
