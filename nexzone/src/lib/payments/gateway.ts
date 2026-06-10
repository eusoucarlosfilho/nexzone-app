export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  sellerRecipientId: string | null;
  feePercent: number;
  description: string;
  payerEmail?: string;
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
      payer: { email: input.payerEmail || 'comprador@nexzone.com.br' },
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

export function getGateway(): PaymentGateway {
  return new MercadoPagoGateway();
}
