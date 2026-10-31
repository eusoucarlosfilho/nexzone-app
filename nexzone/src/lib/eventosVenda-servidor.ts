// ============================================================
// Sprint 2 — processa a fila de eventos de venda (SQL 16) e os lembretes de Pix.
// Chamado pela rotina /api/cron/eventos (a cada minuto) e pela página do pedido quando o pagamento aparece.
// Nunca altera pedido, valor ou entrega: só LÊ o pedido e avisa Meta, TikTok, o sistema do vendedor e o comprador.
// ============================================================
import { recuperacaoPausada } from './recuperacao-servidor';
import { lookup } from 'dns/promises';
import { decifrar } from './whatsapp/config';
import { ipPrivado } from './ofertas/puxarDados';
import { normalizarCheckout } from './checkoutConfig';
import { SITE_URL, sendEmail, layoutEmail, emailDoUsuario, moneyBR, esc } from './email';
import { avisarWhatsApp, contatoDoUsuario, link, enviarSequenciaPix } from './whatsapp/enviar';
import {
  eventoMeta, eventoTikTok, corpoPostback, assinarPostback, eventoParaPostback, urlPostbackValida,
  proximaTentativa, MAX_TENTATIVAS, type DadosVenda,
} from './integracoes';

const TEMPO_MS = 6000;
type Resultado = { ok: boolean; status?: number; resposta?: string; ignorado?: boolean };

async function postJson(url: string, corpo: string, headers: Record<string, string>): Promise<Resultado> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_MS);
  try {
    const r = await fetch(url, { method: 'POST', body: corpo, headers: { 'Content-Type': 'application/json', ...headers }, redirect: 'manual', signal: ctrl.signal, cache: 'no-store' });
    const txt = (await r.text().catch(() => '')).slice(0, 300);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, resposta: txt };
  } catch (e: any) {
    return { ok: false, resposta: e?.name === 'AbortError' ? 'tempo esgotado (6 s)' : String(e?.message || e).slice(0, 200) };
  } finally { clearTimeout(t); }
}

/** Postback: confere o domínio na hora do envio (não pode apontar para rede interna). */
async function enviarPostback(urlBruta: string, segredo: string, corpoObj: any, evento: string): Promise<Resultado> {
  const v = urlPostbackValida(urlBruta);
  if (!v.ok) return { ok: false, resposta: v.erro };
  try {
    const recs = await lookup(v.host, { all: true });
    if (!recs.length || recs.some((r) => ipPrivado(r.address))) return { ok: false, resposta: 'endereço não permitido' };
  } catch { return { ok: false, resposta: 'domínio não encontrado' }; }
  const corpo = JSON.stringify(corpoObj);
  return postJson(v.url, corpo, {
    'User-Agent': 'CompreiBarato-Postback/1.0', 'X-CB-Evento': evento, 'X-CB-Assinatura': assinarPostback(segredo, corpo),
  });
}

/** Junta tudo o que os envios precisam sobre um pedido. */
export async function dadosDaVenda(admin: any, orderId: string, evento: DadosVenda['evento']): Promise<{ d: DadosVenda; productId: string; cfg: any; integ: any } | null> {
  const { data: o } = await admin.from('orders')
    .select('id, status, total, created_at, entregue_em, comprador, product_id, bumps, origem, products(titulo, checkout_config)')
    .eq('id', orderId).maybeSingle();
  if (!o) return null;
  const [contato, email, rast, integ] = await Promise.all([
    contatoDoUsuario(admin, (o as any).comprador).catch(() => ({ telefone: null, nome: null } as any)),
    emailDoUsuario(admin, (o as any).comprador),
    admin.from('order_rastreio').select('cliques, ip, user_agent').eq('order_id', orderId).maybeSingle(),
    admin.from('produto_integracoes').select('*').eq('product_id', (o as any).product_id).maybeSingle(),
  ]);
  const prod: any = (o as any).products || {};
  const d: DadosVenda = {
    evento, pedidoId: (o as any).id, status: (o as any).status, total: Number((o as any).total) || 0,
    criadoEm: (o as any).created_at, pagoEm: (o as any).entregue_em ?? null,
    produto: { id: (o as any).product_id, titulo: prod.titulo || 'Produto' },
    bumps: Array.isArray((o as any).bumps) ? (o as any).bumps.map((b: any) => ({ product_id: String(b.product_id), titulo: String(b.titulo || ''), valor: Number(b.valor) || 0 })) : [],
    comprador: { id: (o as any).comprador, nome: contato?.nome ?? null, email, whatsapp: contato?.telefone ?? null },
    origem: (o as any).origem ?? null,
    cliques: (rast?.data as any)?.cliques ?? null, ip: (rast?.data as any)?.ip ?? null, userAgent: (rast?.data as any)?.user_agent ?? null,
    urlPagina: `${SITE_URL}/checkout/${(o as any).product_id}`,
  };
  return { d, productId: (o as any).product_id, cfg: normalizarCheckout(prod.checkout_config).rastreio, integ: integ?.data ?? null };
}

async function registrar(admin: any, orderId: string | null, productId: string | null, evento: string, destino: string, r: Resultado) {
  try {
    await admin.from('entregas_integracao').insert({
      order_id: orderId, product_id: productId, evento, destino, ok: r.ok, http_status: r.status ?? null, resposta: (r.resposta || '').slice(0, 300),
    });
  } catch { /* histórico é opcional */ }
}

/** Envia um evento para cada destino configurado que ainda não deu certo. */
async function enviarEvento(admin: any, ev: any): Promise<Record<string, string>> {
  const det: Record<string, string> = { ...(ev.detalhes || {}) };
  const info = await dadosDaVenda(admin, ev.order_id, ev.evento);
  if (!info) return { ...det, geral: 'ignorado: pedido não encontrado' };
  const { d, productId, cfg, integ } = info;

  // Meta e TikTok: só a compra aprovada (o navegador já manda os eventos anteriores)
  if (ev.evento === 'compra') {
    if (det.meta !== 'ok') {
      const token = integ?.meta_token ? decifrar(integ.meta_token) : '';
      if (!cfg.meta || !token) det.meta = 'ignorado';
      else {
        const r = await postJson(`https://graph.facebook.com/v21.0/${cfg.meta}/events?access_token=${encodeURIComponent(token)}`, JSON.stringify(eventoMeta(d, integ?.meta_teste || null)), {});
        det.meta = r.ok ? 'ok' : `erro ${r.status ?? ''}`.trim();
        await registrar(admin, d.pedidoId, productId, ev.evento, 'meta', r);
      }
    }
    if (det.tiktok !== 'ok') {
      const token = integ?.tiktok_token ? decifrar(integ.tiktok_token) : '';
      if (!cfg.tiktok || !token) det.tiktok = 'ignorado';
      else {
        const r = await postJson('https://business-api.tiktok.com/open_api/v1.3/event/track/', JSON.stringify(eventoTikTok(d, cfg.tiktok)), { 'Access-Token': token });
        // A TikTok responde 200 com "code" diferente de 0 quando recusa
        let okTk = r.ok;
        try { if (r.ok && r.resposta && JSON.parse(r.resposta).code !== 0) okTk = false; } catch { /* resposta cortada: confia no HTTP */ }
        det.tiktok = okTk ? 'ok' : `erro ${r.status ?? ''}`.trim();
        await registrar(admin, d.pedidoId, productId, ev.evento, 'tiktok', { ...r, ok: okTk });
      }
    }
  }

  // Postback para o sistema do vendedor
  if (det.postback !== 'ok') {
    const nome = eventoParaPostback(ev.evento);
    const segredo = integ?.postback_segredo ? decifrar(integ.postback_segredo) : '';
    if (!integ?.postback_url || !segredo || !(integ.postback_eventos || []).includes(nome)) det.postback = 'ignorado';
    else {
      const r = await enviarPostback(integ.postback_url, segredo, corpoPostback(d), nome);
      det.postback = r.ok ? 'ok' : `erro ${r.status ?? ''}`.trim();
      await registrar(admin, d.pedidoId, productId, nome, 'postback', r);
    }
  }
  return det;
}

/** Processa a fila. `orderId` limita a um pedido (página do pedido); sem ele, pega os mais antigos. */
export async function processarEventos(admin: any, opts: { orderId?: string; limite?: number } = {}): Promise<{ processados: number; erro?: string }> {
  // Libera itens presos em "processando" há mais de 10 min (rotina caiu no meio)
  await admin.from('eventos_pedido').update({ status: 'pendente' }).eq('status', 'processando').lt('atualizado_em', new Date(Date.now() - 600000).toISOString());

  let q = admin.from('eventos_pedido').select('id, order_id, evento, tentativas, detalhes').eq('status', 'pendente').lte('proxima_em', new Date().toISOString())
    .order('id', { ascending: true }).limit(opts.limite ?? 25);
  if (opts.orderId) q = q.eq('order_id', opts.orderId);
  const { data: fila, error } = await q;
  if (error) return { processados: 0, erro: error.message };

  let n = 0;
  for (const ev of (fila ?? []) as any[]) {
    // "Pega" o item (se outra execução já pegou, pula)
    const { data: pego } = await admin.from('eventos_pedido').update({ status: 'processando', atualizado_em: new Date().toISOString() })
      .eq('id', ev.id).eq('status', 'pendente').select('id');
    if (!pego?.length) continue;
    let det: Record<string, string>;
    try { det = await enviarEvento(admin, ev); } catch (e: any) { det = { ...(ev.detalhes || {}), geral: `erro: ${String(e?.message || e).slice(0, 120)}` }; }
    const falhou = Object.values(det).some((v) => v.startsWith('erro'));
    const tentativas = (ev.tentativas || 0) + 1;
    const espera = falhou ? proximaTentativa(tentativas) : null;
    await admin.from('eventos_pedido').update({
      detalhes: det, tentativas, atualizado_em: new Date().toISOString(),
      status: !falhou ? 'feito' : espera === null || tentativas >= MAX_TENTATIVAS ? 'erro' : 'pendente',
      ...(espera !== null ? { proxima_em: new Date(Date.now() + espera).toISOString() } : {}),
    }).eq('id', ev.id);
    n++;
  }
  return { processados: n };
}

// ---------- Recuperação de Pix ----------
/** Lembra quem gerou o Pix e não pagou: 15 min depois (Pix ainda válido) e 24 h depois (link para comprar de novo). */
export async function lembrarPix(admin: any, minutos = 15): Promise<{ enviados: number }> {
  const agora = Date.now();
  const etapas = [
    { etapa: '15min', de: Math.max(60, minutos + 55), ate: minutos }, // 1º lembrete: X minutos depois (Pix ainda válido)
    { etapa: '24h', de: 26 * 60, ate: 23 * 60 },  // criado entre 26 h e 23 h atrás
  ] as const;
  let enviados = 0;
  for (const e of etapas) {
    const { data: pedidos, error } = await admin.from('orders')
      .select('id, comprador, comprador_email, product_id, total, created_at, pix_code, pix_qr, products(titulo)')
      .eq('status', 'pendente').not('pix_code', 'is', null)
      .gte('created_at', new Date(agora - e.de * 60000).toISOString())
      .lte('created_at', new Date(agora - e.ate * 60000).toISOString())
      .order('created_at', { ascending: true }).limit(40);
    if (error) break;
    for (const o of (pedidos ?? []) as any[]) {
      // cada lembrete com QR Code leva alguns segundos: o que não couber nesta rodada fica para a próxima
      if (Date.now() - agora > 9000) break;
      // Já comprou este produto depois (outro pedido pago)? Não incomoda.
      const { count } = await admin.from('orders').select('id', { count: 'exact', head: true })
        .eq('comprador', o.comprador).eq('product_id', o.product_id).in('status', ['pago', 'entregue']);
      if ((count ?? 0) > 0) continue;
      // Admin marcou "Desistiu" na fila de recuperação (SQL 26): não incomoda mais
      if (await recuperacaoPausada(admin, o.comprador_email, o.comprador, o.product_id)) continue;
      // Trava: um lembrete por etapa por pedido
      const { error: travaErr } = await admin.from('lembretes_pix').insert({ order_id: o.id, etapa: e.etapa });
      if (travaErr) continue;

      const titulo = o.products?.titulo || 'seu produto';
      const destino = e.etapa === '15min' ? link(`/pedido/${o.id}`) : link(`/checkout/${o.product_id}`);
      const canais: string[] = [];
      if (e.etapa === '15min') {
        // Pix ainda válido: reenvia as 4 mensagens (QR Code, aviso, código copia e cola, "número só de notificações")
        await enviarSequenciaPix({
          userId: o.comprador, orderId: o.id, tipo: 'lembrete', produto: titulo, valor: moneyBR(o.total),
          pixCode: o.pix_code, pixQr: o.pix_qr ?? null,
        });
      } else {
        // 24 h: o Pix já venceu, então vai o link para gerar um novo
        await avisarWhatsApp({
          evento: 'pix_lembrete_24h', chave: `pix_lembrete_${e.etapa}:${o.id}`, userId: o.comprador,
          vars: { produto: titulo, valor: moneyBR(o.total), pedido: String(o.id).slice(0, 8), link: destino },
        });
      }
      canais.push('whatsapp');
      const email = await emailDoUsuario(admin, o.comprador);
      if (email) {
        const contato = await contatoDoUsuario(admin, o.comprador).catch(() => ({ nome: null } as any));
        const nome = esc(String(contato?.nome || '').split(' ')[0]);
        const tituloHtml = esc(titulo);
        const assunto = e.etapa === '15min' ? `Seu Pix de ${titulo} está esperando` : `Ainda quer ${titulo}?`;
        const corpo = e.etapa === '15min'
          ? `<p style="margin:0 0 12px 0;">${nome ? `Oi, ${nome}! ` : ''}Seu pedido de <b>${tituloHtml}</b> (${moneyBR(o.total)}) está reservado, só falta o pagamento.</p><p style="margin:0;">O Pix copia e cola continua na página do pedido. O acesso é liberado assim que o pagamento cair.</p>`
          : `<p style="margin:0 0 12px 0;">${nome ? `Oi, ${nome}! ` : ''}Vimos que você não concluiu a compra de <b>${tituloHtml}</b>.</p><p style="margin:0;">Se ainda quiser, é só gerar um novo Pix: leva menos de um minuto e o acesso é imediato.</p>`;
        const r = await sendEmail({ to: email, tag: 'outro', subject: assunto, html: layoutEmail({ titulo: assunto, preheader: assunto, texto: corpo, botaoTexto: e.etapa === '15min' ? 'Pagar com Pix agora' : 'Finalizar minha compra', botaoUrl: destino }) });
        if (r.ok) canais.push('email');
      }
      await admin.from('lembretes_pix').update({ canais }).eq('order_id', o.id).eq('etapa', e.etapa);
      enviados++;
    }
  }
  return { enviados };
}

/** Envio de TESTE do postback (botão no construtor). Não grava em pedido. */
export async function testarPostback(admin: any, productId: string, titulo: string, url: string, segredo: string): Promise<Resultado> {
  const agora = new Date().toISOString();
  const corpo = {
    evento: 'teste', enviado_em: agora,
    pedido: { id: '00000000-0000-0000-0000-000000000000', status: 'entregue', total: 97, moeda: 'BRL', criado_em: agora, pago_em: agora },
    produto: { id: productId, titulo }, itens_extras: [],
    comprador: { nome: 'Comprador Teste', email: 'teste@exemplo.com', whatsapp: '5511999999999' },
    origem: { utm_source: 'teste', utm_campaign: 'teste-postback' },
  };
  const r = await enviarPostback(url, segredo, corpo, 'teste');
  await registrar(admin, null, productId, 'teste', 'postback_teste', r);
  return r;
}
