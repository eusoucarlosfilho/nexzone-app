// Pós-venda (SQL 19) no SERVIDOR: oferta depois da compra e recuperação de carrinho.
import { getGateway } from '@/lib/payments/gateway';
import { getSettings, lerTaxas } from '@/lib/settings';
import { divisaoVendedor, taxaComprador, planoEfetivo } from './taxas';
import { lerPosVenda, etapaAtual, ofertaNoPrazo, expiraEm, etapasCarrinho, linkRecuperacao, type PosVenda } from './posVenda';
import { sendEmail, layoutEmail, emailDoUsuario, esc, SITE_URL } from './email';
import { avisarWhatsApp } from './whatsapp/enviar';

export const semSql19 = (e: any) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /produto_pos_venda|ofertas_respostas|carrinhos_abandonados|verificacoes_vendedor/i.test(String(e.message || '')) && /exist|find|schema cache/i.test(String(e.message || '')));
const PAGO = ['pago', 'entregue'];

export async function carregarPosVenda(admin: any, productId: string): Promise<{ sql19: boolean; cfg: PosVenda }> {
  const { data, error } = await admin.from('produto_pos_venda').select('*').eq('product_id', productId).maybeSingle();
  if (error) return { sql19: !semSql19(error), cfg: lerPosVenda(null) };
  return { sql19: true, cfg: lerPosVenda(data) };
}

export type OfertaTela = {
  etapa: 'upsell' | 'downsell';
  productId: string; titulo: string; capa: string | null; precoNormal: number; preco: number;
  chamada: string; texto: string; botao: string; expira: string | null; temCurso?: boolean;
};

/** A oferta que o comprador deste pedido deve ver agora (ou null). */
export async function ofertaDoPedido(admin: any, orderId: string, userId: string): Promise<OfertaTela | null> {
  const { data: o } = await admin.from('orders').select('id, comprador, product_id, store_id, status, entregue_em, created_at, origem').eq('id', orderId).maybeSingle();
  if (!o || (o as any).comprador !== userId || !PAGO.includes((o as any).status)) return null;
  if ((o as any).origem?.utm_source === 'pos_compra') return null; // a própria oferta não puxa outra oferta
  const { sql19, cfg } = await carregarPosVenda(admin, (o as any).product_id);
  if (!sql19) return null;
  const { data: resp } = await admin.from('ofertas_respostas').select('etapa, resposta').eq('order_id', orderId);
  const etapa = etapaAtual(cfg, (resp ?? []) as any[]);
  if (!etapa) return null;
  const pagoEm = (o as any).entregue_em || (o as any).created_at;
  if (!ofertaNoPrazo(pagoEm, cfg.upsell.minutos)) return null;
  const e = cfg[etapa];
  const { data: p } = await admin.from('products').select('id, titulo, capa_url, preco, preco_promo, status, store_id').eq('id', e.product_id).maybeSingle();
  if (!p || (p as any).status !== 'ativo' || (p as any).store_id !== (o as any).store_id) return null;
  // já tem esse produto? não oferece de novo
  const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('comprador', userId).eq('product_id', (p as any).id).in('status', PAGO);
  if ((count ?? 0) > 0) return null;
  return {
    etapa, productId: (p as any).id, titulo: (p as any).titulo, capa: (p as any).capa_url ?? null,
    precoNormal: Number((p as any).preco_promo ?? (p as any).preco) || 0, preco: Number(e.preco),
    chamada: e.titulo || (etapa === 'upsell' ? 'Espere! Oferta exclusiva para quem acabou de comprar' : 'Última chance: condição especial'),
    texto: e.texto || '', botao: e.botao || 'Sim, quero adicionar',
    expira: expiraEm(pagoEm, cfg.upsell.minutos),
  };
}

/** Comprador aceitou/recusou. Aceitou → cria o pedido do produto da oferta (Pix já gerado) e devolve o id. */
export async function responderOferta(admin: any, p: { orderId: string; userId: string; email: string | null; aceitar: boolean }): Promise<{ ok: true; novoPedido?: string } | { ok: false; erro: string; status?: number }> {
  const oferta = await ofertaDoPedido(admin, p.orderId, p.userId);
  if (!oferta) return { ok: false, erro: 'Esta oferta não está mais disponível.', status: 410 };
  if (!p.aceitar) {
    await admin.from('ofertas_respostas').insert({ order_id: p.orderId, etapa: oferta.etapa, resposta: 'recusou' });
    return { ok: true };
  }
  // Trava: registra a resposta ANTES de criar o pedido (dois cliques não criam dois pedidos)
  const { error: trava } = await admin.from('ofertas_respostas').insert({ order_id: p.orderId, etapa: oferta.etapa, resposta: 'aceitou' });
  if (trava) return { ok: false, erro: 'Esta oferta já foi respondida.', status: 409 };

  const { data: prod } = await admin.from('products').select('id, titulo, store_id, plano, stores(owner, recipient_id)').eq('id', oferta.productId).maybeSingle();
  if (!prod || (prod as any).stores?.owner === p.userId) {
    await admin.from('ofertas_respostas').delete().eq('order_id', p.orderId).eq('etapa', oferta.etapa);
    return { ok: false, erro: 'Esta oferta não está mais disponível.', status: 410 };
  }
  const total = Math.round(oferta.preco * 100) / 100;
  const cfgTaxas = await lerTaxas();
  const plano = planoEfetivo((prod as any).plano, cfgTaxas);
  const { pct: feePercent, taxa, valorVendedor } = divisaoVendedor(total, plano, cfgTaxas);
  const taxaPix = taxaComprador('pix', total, cfgTaxas);
  const linha: any = {
    comprador: p.userId, comprador_email: p.email, product_id: (prod as any).id, store_id: (prod as any).store_id,
    total, taxa, valor_vendedor: valorVendedor, status: 'pendente', plano, pct_vendedor: feePercent, taxa_comprador_pix: taxaPix,
  };
  const origem = { utm_source: 'pos_compra', utm_medium: oferta.etapa, utm_content: String(p.orderId).slice(0, 8) };
  let { data: novo, error } = await admin.from('orders').insert({ ...linha, origem }).select('id').single();
  if (error && /origem/i.test(error.message || '')) ({ data: novo, error } = await admin.from('orders').insert(linha).select('id').single());
  if (error || !novo) {
    await admin.from('ofertas_respostas').delete().eq('order_id', p.orderId).eq('etapa', oferta.etapa);
    console.error('[oferta pós-compra] pedido:', error?.message);
    return { ok: false, erro: 'Não foi possível criar o pedido. Tente de novo.', status: 500 };
  }
  await admin.from('ofertas_respostas').update({ novo_pedido: (novo as any).id }).eq('order_id', p.orderId).eq('etapa', oferta.etapa);

  // Pix já gerado: o comprador cai direto na tela de pagamento (ou escolhe cartão lá)
  try {
    const { data: me } = await admin.from('profiles').select('nome').eq('id', p.userId).maybeSingle();
    const gw = await getGateway();
    const pay = await gw.createPixPayment({
      orderId: (novo as any).id, amount: +(total + taxaPix).toFixed(2), sellerRecipientId: (prod as any).stores?.recipient_id ?? null,
      feePercent, description: (prod as any).titulo, payerEmail: p.email ?? undefined, payerName: (me as any)?.nome ?? undefined,
    });
    if (pay.status !== 'erro') {
      await admin.from('orders').update({ gateway_ref: pay.gatewayRef, pix_code: pay.pixCopiaECola ?? null, pix_qr: pay.pixQrBase64 ?? null }).eq('id', (novo as any).id);
    } else console.error('[oferta pós-compra] pix:', pay.error);
  } catch (e: any) { console.error('[oferta pós-compra] pix:', e?.message); }
  return { ok: true, novoPedido: (novo as any).id };
}

/** Números da pós-venda para o produtor (no construtor do checkout) */
export async function numerosPosVenda(admin: any, productId: string) {
  const r = { ofertas: { aceitas: 0, pagas: 0, valor: 0, recusadas: 0 }, carrinhos: { total: 0, lembrados: 0, recuperados: 0, valor: 0 } };
  try {
    const { data: orig } = await admin.from('orders').select('id').eq('product_id', productId).in('status', PAGO).limit(5000);
    const ids = ((orig ?? []) as any[]).map((x) => x.id);
    for (let i = 0; i < ids.length; i += 300) {
      const { data: rs } = await admin.from('ofertas_respostas').select('resposta, novo_pedido').in('order_id', ids.slice(i, i + 300));
      const novos = ((rs ?? []) as any[]).filter((x) => x.resposta === 'aceitou' && x.novo_pedido).map((x) => x.novo_pedido);
      r.ofertas.aceitas += novos.length;
      r.ofertas.recusadas += ((rs ?? []) as any[]).filter((x) => x.resposta === 'recusou').length;
      if (novos.length) {
        const { data: ps } = await admin.from('orders').select('total, status').in('id', novos);
        for (const o of (ps ?? []) as any[]) if (PAGO.includes(o.status)) { r.ofertas.pagas++; r.ofertas.valor += Number(o.total) || 0; }
      }
    }
    const { data: cs } = await admin.from('carrinhos_abandonados').select('lembrete_1h, lembrete_24h, recuperado, valor_recuperado').eq('product_id', productId).limit(10000);
    for (const c of (cs ?? []) as any[]) {
      r.carrinhos.total++;
      if (c.lembrete_1h || c.lembrete_24h) r.carrinhos.lembrados++;
      if (c.recuperado) { r.carrinhos.recuperados++; r.carrinhos.valor += Number(c.valor_recuperado) || 0; }
    }
  } catch { /* sem SQL 19 */ }
  r.ofertas.valor = Math.round(r.ofertas.valor * 100) / 100;
  r.carrinhos.valor = Math.round(r.carrinhos.valor * 100) / 100;
  return r;
}

// ---------- carrinho abandonado ----------

/** Guarda (ou renova) o carrinho de quem se identificou no checkout. Nunca lança erro. */
export async function registrarCarrinho(admin: any, c: { productId: string; email: string; userId?: string | null; nome?: string | null }) {
  try {
    const email = String(c.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || !/^[0-9a-f-]{36}$/i.test(c.productId)) return;
    const agora = new Date().toISOString();
    const { data: ja } = await admin.from('carrinhos_abandonados').select('id, convertido_em, atualizado_em').eq('product_id', c.productId).eq('email', email).maybeSingle();
    if (ja) {
      // voltou ao checkout: renova o horário; se a última passagem foi há mais de 7 dias, recomeça os lembretes
      const velho = Date.now() - new Date((ja as any).atualizado_em).getTime() > 7 * 86400000;
      if ((ja as any).convertido_em && !velho) return;
      await admin.from('carrinhos_abandonados').update({
        atualizado_em: agora, ...(c.userId ? { user_id: c.userId } : {}), ...(c.nome ? { nome: c.nome } : {}),
        ...(velho ? { lembrete_1h: null, lembrete_24h: null, convertido_em: null, recuperado: false, valor_recuperado: null, criado_em: agora } : {}),
      }).eq('id', (ja as any).id);
    } else {
      await admin.from('carrinhos_abandonados').insert({ product_id: c.productId, email, user_id: c.userId ?? null, nome: c.nome ? String(c.nome).slice(0, 120) : null });
    }
  } catch { /* sem SQL 19 */ }
}

/** Rotina (cron de 1 min): lembretes de carrinho em 1 h e 24 h. */
export async function lembrarCarrinhos(admin: any, minutos = 60): Promise<{ enviados: number }> {
  let enviados = 0;
  const agora = Date.now();
  for (const e of etapasCarrinho(minutos)) {
    const { data: lista, error } = await admin.from('carrinhos_abandonados')
      .select('id, product_id, user_id, email, nome, atualizado_em, lembrete_1h, products(titulo, status, preco, preco_promo)')
      .is('convertido_em', null).is(e.coluna, null)
      .gte('atualizado_em', new Date(agora - e.de * 60000).toISOString())
      .lte('atualizado_em', new Date(agora - e.ate * 60000).toISOString())
      .order('atualizado_em', { ascending: true }).limit(30);
    if (error) break;
    for (const c of (lista ?? []) as any[]) {
      if (c.products?.status !== 'ativo') continue;
      // Gerou Pix depois de se identificar? Quem cuida é o lembrete de Pix (Sprint 2). Já comprou? Não incomoda.
      const filtro = (q: any) => (c.user_id ? q.eq('comprador', c.user_id) : q.eq('comprador_email', c.email));
      const { data: pedidos } = await filtro(admin.from('orders').select('id, status, created_at').eq('product_id', c.product_id)).gte('created_at', new Date(new Date(c.atualizado_em).getTime() - 5 * 60000).toISOString()).limit(5);
      if (((pedidos ?? []) as any[]).length) { await admin.from('carrinhos_abandonados').update({ [e.coluna]: new Date().toISOString() }).eq('id', c.id); continue; }
      // trava: marca antes de enviar (não envia em dobro)
      const { data: marcado } = await admin.from('carrinhos_abandonados').update({ [e.coluna]: new Date().toISOString() }).eq('id', c.id).is(e.coluna, null).select('id');
      if (!marcado?.length) continue;

      const { cfg } = await carregarPosVenda(admin, c.product_id);
      if (!cfg.recuperacao.ativa) continue;
      const titulo = c.products?.titulo || 'o produto';
      const link = linkRecuperacao(SITE_URL, c.product_id, c.email, cfg.recuperacao.cupom);
      const primeiro = esc(String(c.nome || '').split(' ')[0]);
      if (c.user_id) {
        await avisarWhatsApp({
          evento: e.etapa === '1h' ? 'carrinho_1h' : 'carrinho_24h', chave: `carrinho_${e.etapa}:${c.id}`, userId: c.user_id,
          vars: { produto: titulo, link, cupom: cfg.recuperacao.cupom || '' },
        });
      }
      const email = c.email || (c.user_id ? await emailDoUsuario(admin, c.user_id) : null);
      if (email) {
        const assunto = e.etapa === '1h' ? `Você esqueceu ${titulo} no carrinho` : `Ainda dá tempo: ${titulo}`;
        const cupomTxt = cfg.recuperacao.cupom ? `<p style="margin:0 0 12px 0;">Use o cupom <b>${esc(cfg.recuperacao.cupom)}</b> — ele já vai aplicado pelo botão abaixo.</p>` : '';
        const corpo = `<p style="margin:0 0 12px 0;">${primeiro ? `Oi, ${primeiro}! ` : ''}Você começou a compra de <b>${esc(titulo)}</b> e não terminou.</p>${cupomTxt}<p style="margin:0;">É rapidinho: Pix ou cartão, e o acesso chega na hora.</p>`;
        await sendEmail({ to: email, tag: 'outro', subject: assunto, html: layoutEmail({ titulo: assunto, preheader: assunto, texto: corpo, botaoTexto: 'Finalizar minha compra', botaoUrl: link }) });
      }
      enviados++;
    }
  }
  return { enviados };
}

