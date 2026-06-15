import { getPaymentConfig } from './config';

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
}
export interface PaymentGateway {
  createPixPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent | null>;
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
    return { ci: this.ci, cs: this.cs, 'Content-Type': 'application/json' };
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
      description: (input.description || 'Compra Comprei Barato').slice(0, 140),
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
      const s = String(b?.status || '').toUpperCase();
      const map: Record<string, WebhookEvent['status']> = {
        COMPLETO: 'pago', FALHA: 'recusado', PENDENTE: 'pendente',
      };
      return { gatewayRef: ref, status: map[s] || 'pendente' };
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

  async parseWebhook(_req: Request, rawBody: string): Promise<WebhookEvent | null> {
    try {
      const body = JSON.parse(rawBody);
      const id = body?.data?.id;
      if (!id) return null;
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      const p = await r.json();
      const map: Record<string, WebhookEvent['status']> = {
        approved: 'pago', rejected: 'recusado', refunded: 'estornado', pending: 'pendente',
      };
      return { gatewayRef: String(id), status: map[p.status] || 'pendente', orderId: p.external_reference };
    } catch { return null; }
  }
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
