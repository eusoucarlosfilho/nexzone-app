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
  const inicio = Date.now();
  const noPrazo = () => Date.now() - inicio < 45000; // a função da Vercel tem 60 s

  for (const o of await pedidosAntigos(admin, dias, escopo)) {
    if (enviados >= limite || !noPrazo()) break;
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

  const restantes = (await pedidosAntigos(admin, dias, escopo)).length + (await carrinhosAntigos(admin, dias, escopo)).length;
  return { enviados, pulados, restantes };
}
