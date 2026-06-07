// Adaptador de pagamento agnóstico.
// Troque a implementação conforme o gateway escolhido (Mercado Pago / Iugu / Pagar.me).
// A ideia: o resto do app fala com esta interface; só este arquivo conhece o gateway.

export interface CreatePaymentInput {
  orderId: string;
  amount: number;          // total da compra
  sellerRecipientId: string | null; // subconta/recipient do vendedor no gateway
  feePercent: number;      // taxa da plataforma (ex.: 3)
  description: string;
  payerEmail?: string;
}

export interface CreatePaymentResult {
  gatewayRef: string;      // id da transação no gateway
  pixCopiaECola?: string;  // payload do Pix (copia e cola)
  pixQrBase64?: string;    // imagem do QR em base64
  status: 'pendente' | 'pago' | 'erro';
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

// -------- Implementação Mercado Pago (esqueleto pronto para credenciais) --------
// Docs split: https://www.mercadopago.com.br/developers/pt/docs/split-payments
class MercadoPagoGateway implements PaymentGateway {
  private token = process.env.PAYMENT_ACCESS_TOKEN!;

  async createPixPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.token) {
      // Sem credenciais ainda: retorna um Pix simulado para o fluxo rodar em dev.
      return { gatewayRef: `dev_${input.orderId}`, pixCopiaECola: '00020126...SIMULADO', status: 'pendente' };
    }
    const fee = +(input.amount * (input.feePercent / 100)).toFixed(2);
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.orderId,
      },
      body: JSON.stringify({
        transaction_amount: input.amount,
        description: input.description,
        payment_method_id: 'pix',
        payer: { email: input.payerEmail || 'comprador@nexzone.com.br' },
        // split: valor que fica com a plataforma (application_fee) e destino do vendedor
        application_fee: fee,
        // marketplace / recipient do vendedor vai aqui conforme o modelo da conta
        external_reference: input.orderId,
        notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/payment`,
      }),
    });
    const data = await res.json();
    const tx = data?.point_of_interaction?.transaction_data;
    return {
      gatewayRef: String(data.id),
      pixCopiaECola: tx?.qr_code,
      pixQrBase64: tx?.qr_code_base64,
      status: 'pendente',
    };
  }

  async parseWebhook(_req: Request, rawBody: string): Promise<WebhookEvent | null> {
    // TODO: validar assinatura (PAYMENT_WEBHOOK_SECRET) antes de confiar no evento.
    try {
      const body = JSON.parse(rawBody);
      const id = body?.data?.id;
      if (!id) return null;
      // Confirma o status real consultando a API (não confie só no payload):
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
  switch (process.env.PAYMENT_PROVIDER) {
    case 'mercadopago':
    default:
      return new MercadoPagoGateway();
    // case 'iugu': return new IuguGateway();
    // case 'pagarme': return new PagarmeGateway();
  }
}
