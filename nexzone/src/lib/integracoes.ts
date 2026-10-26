// ============================================================
// Sprint 2 — montagem (pura) dos envios de venda:
//   • API de Conversões do Meta (evento Purchase pelo servidor)
//   • Events API do TikTok (CompletePayment pelo servidor)
//   • Postback (webhook) para o sistema do vendedor, assinado com HMAC-SHA256
// O envio em si (rede, fila, tentativas) fica em eventosVenda-servidor.ts.
// ============================================================
import { createHash, createHmac, randomBytes } from 'crypto';

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export type DadosVenda = {
  evento: 'pix_gerado' | 'compra' | 'reembolso';
  pedidoId: string;
  status: string;
  total: number;
  criadoEm: string;
  pagoEm?: string | null;
  produto: { id: string; titulo: string };
  bumps: { product_id: string; titulo: string; valor: number }[];
  comprador: { id: string; nome: string | null; email: string | null; whatsapp: string | null };
  origem: Record<string, string> | null;
  cliques: Record<string, string> | null;
  ip: string | null;
  userAgent: string | null;
  urlPagina: string;
};

/** Primeiro e último nome (para fn/ln do Meta). */
export function separarNome(nome: string | null): { fn: string; ln: string } {
  const p = norm(nome).split(/\s+/).filter(Boolean);
  return { fn: p[0] || '', ln: p.length > 1 ? p[p.length - 1] : '' };
}

export const ID_EVENTO_COMPRA = (pedidoId: string) => `Purchase-${pedidoId}`; // igual ao do pixel no navegador

/** Corpo do POST https://graph.facebook.com/v21.0/{pixel}/events */
export function eventoMeta(d: DadosVenda, testCode?: string | null) {
  const { fn, ln } = separarNome(d.comprador.nome);
  const user_data: Record<string, any> = {};
  if (d.comprador.email) user_data.em = [sha256(norm(d.comprador.email))];
  if (d.comprador.whatsapp) user_data.ph = [sha256(String(d.comprador.whatsapp).replace(/\D/g, ''))];
  if (fn) user_data.fn = [sha256(fn)];
  if (ln) user_data.ln = [sha256(ln)];
  user_data.country = [sha256('br')];
  user_data.external_id = [sha256(d.comprador.id)];
  if (d.ip) user_data.client_ip_address = d.ip;
  if (d.userAgent) user_data.client_user_agent = d.userAgent;
  if (d.cliques?.fbp) user_data.fbp = d.cliques.fbp;
  if (d.cliques?.fbc) user_data.fbc = d.cliques.fbc;
  const ids = [d.produto.id, ...d.bumps.map((b) => b.product_id)];
  return {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(new Date(d.pagoEm || Date.now()).getTime() / 1000),
      event_id: ID_EVENTO_COMPRA(d.pedidoId),
      action_source: 'website',
      event_source_url: d.urlPagina,
      user_data,
      custom_data: { currency: 'BRL', value: Math.round(d.total * 100) / 100, content_ids: ids, content_type: 'product', content_name: d.produto.titulo, order_id: d.pedidoId, num_items: ids.length },
    }],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
}

/** Corpo do POST https://business-api.tiktok.com/open_api/v1.3/event/track/ */
export function eventoTikTok(d: DadosVenda, pixelCode: string) {
  const user: Record<string, any> = {};
  if (d.comprador.email) user.email = sha256(norm(d.comprador.email));
  if (d.comprador.whatsapp) user.phone = sha256('+' + String(d.comprador.whatsapp).replace(/\D/g, ''));
  user.external_id = sha256(d.comprador.id);
  if (d.ip) user.ip = d.ip;
  if (d.userAgent) user.user_agent = d.userAgent;
  if (d.cliques?.ttclid) user.ttclid = d.cliques.ttclid;
  if (d.cliques?.ttp) user.ttp = d.cliques.ttp;
  return {
    event_source: 'web',
    event_source_id: pixelCode,
    data: [{
      event: 'CompletePayment',
      event_time: Math.floor(new Date(d.pagoEm || Date.now()).getTime() / 1000),
      event_id: ID_EVENTO_COMPRA(d.pedidoId),
      user,
      page: { url: d.urlPagina },
      properties: {
        currency: 'BRL', value: Math.round(d.total * 100) / 100, order_id: d.pedidoId, content_type: 'product',
        contents: [{ content_id: d.produto.id, content_name: d.produto.titulo, quantity: 1 }, ...d.bumps.map((b) => ({ content_id: b.product_id, content_name: b.titulo, quantity: 1, price: b.valor }))],
      },
    }],
  };
}

// ---------- Postback ----------
export { EVENTOS_POSTBACK } from './rastreioVenda';
export const eventoParaPostback = (e: DadosVenda['evento']) => (e === 'compra' ? 'venda_aprovada' : e);

export function corpoPostback(d: DadosVenda) {
  return {
    evento: eventoParaPostback(d.evento),
    enviado_em: new Date().toISOString(),
    pedido: { id: d.pedidoId, status: d.status, total: Math.round(d.total * 100) / 100, moeda: 'BRL', criado_em: d.criadoEm, pago_em: d.pagoEm ?? null },
    produto: { id: d.produto.id, titulo: d.produto.titulo },
    itens_extras: d.bumps.map((b) => ({ id: b.product_id, titulo: b.titulo, valor: b.valor })),
    comprador: { nome: d.comprador.nome, email: d.comprador.email, whatsapp: d.comprador.whatsapp },
    origem: d.origem ?? {},
  };
}

/** Assinatura enviada no cabeçalho X-CB-Assinatura: "sha256=<hex>" do corpo exato. */
export const assinarPostback = (segredo: string, corpo: string) => 'sha256=' + createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex');
export const novoSegredo = () => 'cbps_' + randomBytes(24).toString('base64url');

/** Formato do link de postback: https, sem usuário/senha, sem IP direto, sem portas estranhas. */
export function urlPostbackValida(u: string): { ok: true; url: string; host: string } | { ok: false; erro: string } {
  if (!u || u.length > 500) return { ok: false, erro: 'Informe o link do postback (até 500 caracteres).' };
  let x: URL;
  try { x = new URL(u.trim()); } catch { return { ok: false, erro: 'Link inválido. Use um endereço completo começando com https://' }; }
  if (x.protocol !== 'https:') return { ok: false, erro: 'O postback precisa usar https://' };
  if (x.username || x.password) return { ok: false, erro: 'Não coloque usuário e senha no link.' };
  if (/^\[|^\d+\.\d+\.\d+\.\d+$/.test(x.hostname) || !x.hostname.includes('.')) return { ok: false, erro: 'Use um domínio (não um IP).' };
  if (/(^|\.)(localhost|local|internal|compreibarato\.com\.br)$/i.test(x.hostname)) return { ok: false, erro: 'Endereço não permitido.' };
  if (x.port && !['443', '8443'].includes(x.port)) return { ok: false, erro: 'Use a porta padrão do https.' };
  return { ok: true, url: x.toString(), host: x.hostname };
}

/** Espera até a próxima tentativa: 1 min, 5 min, 30 min, 2 h, 12 h. Depois desiste. */
export const ESPERAS_MIN = [1, 5, 30, 120, 720];
export const MAX_TENTATIVAS = ESPERAS_MIN.length + 1;
export const proximaTentativa = (tentativas: number) => (tentativas >= MAX_TENTATIVAS ? null : ESPERAS_MIN[Math.min(tentativas - 1, ESPERAS_MIN.length - 1)] * 60000);

/** Mascara um token para exibir ("••••a1b2"). */
export const mascarar = (t: string | null | undefined) => (t ? '••••' + String(t).slice(-4) : '');
