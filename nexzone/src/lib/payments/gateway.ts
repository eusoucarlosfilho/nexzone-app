import { getPaymentConfig } from './config';
import { rotaPix, type ConfigTaxas } from '../taxas';

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  sellerRecipientId: string | null;
  feePercent: number;
  description: string;
  payerEmail?: string;
  payerName?: string;
  payerDocument?: string; // CPF (apenas dígitos) — exigido pela MisticPay
}
export interface CreatePaymentResult {
  gatewayRef: string;
  pixCopiaECola?: string;
  pixQrBase64?: string;
  status: 'pendente' | 'pago' | 'erro';
  error?: string;
}
export interface WebhookEvent {
  gatewayRef: string;
  status: 'pago' | 'recusado' | 'estornado' | 'pendente';
  orderId?: string;
  amount?: number; // valor confirmado pelo gateway (quando disponível)
  estado?: string; // estado bruto no gateway (ex.: COMPLETO, DEVOLVIDO, DEVOLVIDO_PARCIAL)
  criadoEm?: string | null; atualizadoEm?: string | null;
  /** Dados do Pix recebido (só no aviso de pagamento): nome do pagador no banco, id end-to-end e banco */
  pix?: { pagador: string | null; e2e: string | null; banco: string | null };
  /** Aviso de devolução (reembolso feito no painel da MisticPay ou pelo banco) */
  devolucao?: { status: string; valor: number | null; ref: string | null; em: string | null; parcial: boolean };
}
export interface PaymentGateway {
  createPixPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent | null>;
  /** Consulta direta no gateway (conferência quando o aviso não chega). null = não deu para consultar. */
  checkPayment(gatewayRef: string): Promise<WebhookEvent | null>;
}

/* ========================= MISTIC PAY ========================= */
function gerarCpfValido(): string {
  const d: number[] = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  for (let j = 9; j < 11; j++) {
    let s = 0;
    for (let i = 0; i < j; i++) s += d[i] * (j + 1 - i);
    let r = (s * 10) % 11;
    if (r === 10) r = 0;
    d.push(r);
  }
  return d.join('');
}

class MisticPayGateway implements PaymentGateway {
  private base = 'https://api.misticpay.com/api';
  constructor(private ci: string, private cs: string) {}

  private headers() {
    // Chaves de acesso novas usam Basic auth; ci/cs mantidos para credenciais antigas.
    const basic = Buffer.from(`${this.ci}:${this.cs}`).toString('base64');
    return { Authorization: `Basic ${basic}`, ci: this.ci, cs: this.cs, 'Content-Type': 'application/json' };
  }

  async createPixPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.ci || !this.cs) {
      return {
        gatewayRef: '', status: 'erro',
        error: 'MisticPay não configurada. Cadastre o Client ID e o Client Secret nas Configurações do admin.',
      };
    }
    // CPF: usa o informado se válido; senão gera um válido (não exige CPF do comprador)
    let doc = (input.payerDocument || '').replace(/\D/g, '');
    if (doc.length !== 11) doc = gerarCpfValido();

    const body = {
      amount: Number(input.amount.toFixed(2)),
      payerName: (input.payerName || 'Cliente Comprei Barato').slice(0, 120),
      payerDocument: doc,
      transactionId: input.orderId,
      // "Pedido #xxxxxxxx" no começo: é o que a busca do Extrato da MisticPay encontra (o transactionId ela não busca)
      description: `${codigoPedido(input.orderId)} · ${input.description || 'Compra Comprei Barato'}`.slice(0, 140),
      projectWebhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/payment`,
    };

    try {
      const res = await fetch(`${this.base}/transactions/create`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        console.error('MisticPay erro create:', res.status, JSON.stringify(data));
        const msg = data?.message || data?.error || (typeof data === 'object' ? JSON.stringify(data) : 'erro');
        return { gatewayRef: '', status: 'erro', error: `MisticPay recusou (HTTP ${res.status}): ${msg}` };
      }
      const d = data?.data || {};
      const qr = typeof d.qrCodeBase64 === 'string'
        ? d.qrCodeBase64.replace(/^data:image\/[a-z]+;base64,/i, '')
        : undefined;
      const copia = d.copyPaste || undefined;
      if (!copia && !qr) {
        console.error('MisticPay sem QR/copyPaste:', JSON.stringify(data));
        return { gatewayRef: String(d.transactionId || ''), status: 'erro', error: 'MisticPay não retornou o código Pix.' };
      }
      return {
        gatewayRef: String(d.transactionId || ''),
        pixCopiaECola: copia,
        pixQrBase64: qr,
        status: 'pendente',
      };
    } catch (e: any) {
      console.error('MisticPay exceção create:', e?.message);
      return { gatewayRef: '', status: 'erro', error: 'Não foi possível conectar à MisticPay. Tente novamente.' };
    }
  }

  async parseWebhook(_req: Request, rawBody: string): Promise<WebhookEvent | null> {
    try {
      const b = JSON.parse(rawBody);

      // Webhook de MED (infração/chargeback): apenas reconhecemos; tratativa é manual no admin.
      if (b?.event === 'INFRACTION') {
        console.warn('MisticPay MED recebido:', JSON.stringify(b?.infraction || {}));
        return null;
      }

      // Webhook de saque (RETIRADA) não é pagamento de pedido.
      if (b?.transactionType && String(b.transactionType).toUpperCase() === 'RETIRADA') return null;

      const ref = String(b?.transactionId || '');
      if (!ref) return null;

      // A MisticPay não assina o webhook: qualquer um pode chamar esta URL.
      // Por isso o status e o valor vêm da consulta à API, nunca do corpo recebido.
      const ev = await this.checkPayment(ref);
      if (!ev) return null;
      // dados do Pix (informativos, para achar a compra no extrato): nome do pagador como veio do banco, e2e, banco
      if (b?.clientName || b?.e2e || b?.bankName) ev.pix = { pagador: b?.clientName ? String(b.clientName).slice(0, 120) : null, e2e: b?.e2e ? String(b.e2e).slice(0, 60) : null, banco: b?.bankName ? String(b.bankName).slice(0, 80) : null };
      // Devolução (reembolso): o ESTADO vem da consulta (DEVOLVIDO); do corpo só os detalhes (valor, id da devolução)
      const rf = b?.refund;
      if (rf || ev.estado === 'DEVOLVIDO' || ev.estado === 'DEVOLVIDO_PARCIAL') {
        const recusado = String(rf?.status || '').toUpperCase() === 'RECUSADO';
        ev.devolucao = {
          status: recusado ? 'RECUSADO' : ev.estado === 'DEVOLVIDO' || ev.estado === 'DEVOLVIDO_PARCIAL' ? 'CONCLUIDO' : String(rf?.status || ''),
          valor: Number.isFinite(Number(rf?.refundedValue)) ? Number(rf.refundedValue) : null,
          ref: rf?.refundId ? String(rf.refundId) : b?.e2e ? String(b.e2e) : null,
          em: rf?.refundedAt ? String(rf.refundedAt) : null,
          parcial: ev.estado === 'DEVOLVIDO_PARCIAL',
        };
      }
      return ev;
    } catch {
      return null;
    }
  }

  /** Dados da conta MisticPay das chaves configuradas no site (para o admin saber em QUAL conta caem as vendas). */
  async contaInfo(): Promise<{ nome: string | null; email: string | null } | null> {
    try {
      if (!this.ci || !this.cs) return null;
      const res = await fetch(`${this.base}/users/info`, { headers: this.headers(), cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json().catch(() => ({} as any));
      const u = j?.data?.user ?? j?.data ?? j?.user ?? j;
      const nome = u?.name ?? u?.nome ?? u?.fullName ?? u?.razaoSocial ?? null;
      const email = u?.email ?? null;
      return { nome: nome ? String(nome).slice(0, 120) : null, email: email ? String(email).slice(0, 160) : null };
    } catch { return null; }
  }

  async checkPayment(ref: string): Promise<WebhookEvent | null> {
    try {
      if (!ref || !this.ci || !this.cs) return null;
      const res = await fetch(`${this.base}/transactions/check`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify({ transactionId: ref }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({} as any));
      const tx = data?.transaction || data?.data?.transaction || data?.data;
      if (!res.ok || !tx || String(tx.transactionId ?? ref) !== ref) {
        console.error('MisticPay erro check:', res.status, JSON.stringify(data));
        return null;
      }
      if (String(tx.transactionType || '').toUpperCase() === 'RETIRADA') return null;

      const s = String(tx.transactionState || tx.status || '').toUpperCase();
      const map: Record<string, WebhookEvent['status']> = {
        COMPLETO: 'pago', FALHA: 'recusado', PENDENTE: 'pendente', DEVOLVIDO: 'estornado', // DEVOLVIDO_PARCIAL: só avisa o admin
      };
      const value = Number(tx.value);
      return { gatewayRef: ref, status: map[s] || 'pendente', amount: isNaN(value) ? undefined : value, estado: s, criadoEm: tx.createdAt ?? null, atualizadoEm: tx.updatedAt ?? null };
    } catch {
      return null;
    }
  }
}

/* ========================= MERCADO PAGO ========================= */
class MercadoPagoGateway implements PaymentGateway {
  private token = process.env.PAYMENT_ACCESS_TOKEN!;

  async createPixPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.token) {
      return { gatewayRef: `dev_${input.orderId}`, pixCopiaECola: '00020126SIMULADO', status: 'pendente' };
    }
    const body: any = {
      transaction_amount: Number(input.amount.toFixed(2)),
      description: input.description,
      payment_method_id: 'pix',
      payer: { email: input.payerEmail || 'comprador@compreibarato.com.br' },
      external_reference: input.orderId,
      notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/payment`,
    };
    if (input.sellerRecipientId) {
      body.application_fee = +(input.amount * (input.feePercent / 100)).toFixed(2);
    }
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.orderId,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Mercado Pago erro:', JSON.stringify(data));
      return { gatewayRef: '', status: 'erro', error: data?.message || JSON.stringify(data) };
    }
    const tx = data?.point_of_interaction?.transaction_data;
    if (!tx?.qr_code) {
      const detail = data?.status_detail || data?.status || 'sem_qr';
      console.error('Mercado Pago sem QR:', JSON.stringify(data));
      let msg = `Não foi possível gerar o Pix (motivo: ${detail}).`;
      const d = String(detail).toLowerCase();
      if (String(data?.status) === 'rejected' || d.includes('payer') || d.includes('collector')) {
        msg = 'Não foi possível gerar o Pix. Se você está testando comprando da sua própria conta Mercado Pago, isso é bloqueado — o MP não permite pagar para si mesmo. Use outro e-mail/conta de comprador para testar.';
      }
      return { gatewayRef: String(data?.id || ''), status: 'erro', error: msg };
    }
    return {
      gatewayRef: String(data.id),
      pixCopiaECola: tx?.qr_code,
      pixQrBase64: tx?.qr_code_base64,
      status: 'pendente',
    };
  }

  async parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent | null> {
    try {
      let id: any = null;
      try { id = JSON.parse(rawBody)?.data?.id; } catch { /* corpo vazio: vem pela URL */ }
      if (!id) id = new URL(req.url).searchParams.get('data.id') || new URL(req.url).searchParams.get('id');
      if (!id) return null;
      // status e valor SEMPRE da consulta à API (o aviso não é assinado)
      return await this.checkPayment(String(id));
    } catch { return null; }
  }

  async checkPayment(ref: string): Promise<WebhookEvent | null> {
    try {
      if (!this.token || !ref || ref.startsWith('dev_')) return null;
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${this.token}` }, cache: 'no-store' });
      if (!r.ok) return null;
      const p = await r.json();
      const map: Record<string, WebhookEvent['status']> = { approved: 'pago', rejected: 'recusado', refunded: 'estornado', pending: 'pendente' };
      const value = Number(p.transaction_amount);
      return { gatewayRef: String(ref), status: map[p.status] || 'pendente', orderId: p.external_reference, amount: isNaN(value) ? undefined : value };
    } catch { return null; }
  }
}

/** Aviso do Mercado Pago? (o da MisticPay traz transactionId; o do MP traz data.id / type=payment) */
export function pareceAvisoMercadoPago(req: Request, rawBody: string): boolean {
  try {
    const u = new URL(req.url);
    if (u.searchParams.get('type') === 'payment' || u.searchParams.get('topic') === 'payment' || u.searchParams.get('data.id')) return true;
    const b = JSON.parse(rawBody || '{}');
    return !!b?.data?.id && !b?.transactionId;
  } catch { return false; }
}

export const PREFIXO_MP = 'mp:';

/**
 * Cria o Pix pelo gateway da ROTA (estudo de taxas): Mercado Pago até o limite configurado
 * (0,99% sem mínimo, melhor para ticket baixo), o gateway padrão (MisticPay) acima disso.
 * O gatewayRef do Mercado Pago volta com o prefixo "mp:" para a conferência saber onde consultar.
 * Se o Mercado Pago falhar, cai no padrão: o comprador nunca fica sem Pix.
 */
export async function criarPixRoteado(input: CreatePaymentInput, total: number, cfg: ConfigTaxas): Promise<CreatePaymentResult & { rota: 'mp' | 'padrao' }> {
  if (rotaPix(total, cfg) === 'mp') {
    const r = await new MercadoPagoGateway().createPixPayment({ ...input, sellerRecipientId: null });
    if (r.status !== 'erro' && r.gatewayRef && !r.gatewayRef.startsWith('dev_')) return { ...r, gatewayRef: PREFIXO_MP + r.gatewayRef, rota: 'mp' };
    console.error('[pix] Mercado Pago falhou, gerando pelo gateway padrão:', r.error);
  }
  const r = await (await getGateway()).createPixPayment(input);
  return { ...r, rota: 'padrao' };
}

/** Gateway e referência para CONSULTAR um Pix já criado (pelo prefixo da referência). */
export async function gatewayDaRef(gatewayRef: string): Promise<{ gw: PaymentGateway; ref: string }> {
  if (gatewayRef.startsWith(PREFIXO_MP)) return { gw: new MercadoPagoGateway(), ref: gatewayRef.slice(PREFIXO_MP.length) };
  return { gw: await getGateway(), ref: gatewayRef };
}

/** Nome e e-mail da conta MisticPay configurada no site (null se o gateway não for a MisticPay ou não responder). */
export async function contaDoGateway(): Promise<{ nome: string | null; email: string | null } | null> {
  const gw: any = await getGateway();
  return typeof gw.contaInfo === 'function' ? gw.contaInfo() : null;
}

/** Gateway para ler um aviso (webhook): Mercado Pago quando o aviso é dele, senão o padrão. */
export async function gatewayDoAviso(req: Request, rawBody: string): Promise<PaymentGateway> {
  if (pareceAvisoMercadoPago(req, rawBody)) return new MercadoPagoGateway();
  return getGateway();
}

/**
 * Retorna o gateway ativo conforme a configuração salva no admin.
 * É assíncrono porque lê as credenciais do banco.
 */
export async function getGateway(): Promise<PaymentGateway> {
  const cfg = await getPaymentConfig();
  if (cfg.gateway === 'misticpay') return new MisticPayGateway(cfg.misticpay.ci, cfg.misticpay.cs);
  return new MercadoPagoGateway();
}

/** Código curto do pedido usado na descrição do Pix (aparece e é buscável no extrato da MisticPay). */
export const codigoPedido = (orderId: string) => `Pedido #${String(orderId || '').replace(/^mp:/, '').slice(0, 8)}`;
