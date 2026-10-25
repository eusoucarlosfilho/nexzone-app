// Stripe (cartão de crédito) via API REST — sem dependência nova.
// USO EXCLUSIVO NO SERVIDOR. As chaves ficam SÓ nas variáveis de ambiente da Vercel:
//   STRIPE_SECRET_KEY      (sk_test_... / sk_live_...)
//   STRIPE_WEBHOOK_SECRET  (whsec_...)
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

const API = 'https://api.stripe.com/v1';
export const STRIPE_MIN_BRL = 0.5; // valor mínimo que a Stripe aceita cobrar em BRL

export function stripeEnvStatus() {
  return {
    secret_set: !!process.env.STRIPE_SECRET_KEY,
    webhook_set: !!process.env.STRIPE_WEBHOOK_SECRET,
    test_mode: (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_'),
  };
}

// Liga/desliga salvo pelo Admin na tabela settings (lida com service_role).
export async function stripeEnabledSetting(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('settings').select('value').eq('key', 'stripe_enabled').maybeSingle();
    const v = (data as any)?.value;
    return v === true || v === 'true';
  } catch {
    return false;
  }
}

// O botão de cartão só aparece se o Admin ligou E as duas variáveis existem.
export async function stripeAvailable(): Promise<boolean> {
  const env = stripeEnvStatus();
  if (!env.secret_set || !env.webhook_set) return false;
  return stripeEnabledSetting();
}

// Converte um objeto aninhado no formato form-urlencoded que a Stripe espera (a[b][0][c]=...).
function toForm(obj: Record<string, any>, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') toForm(item, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === 'object') {
      toForm(v, key, out);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export async function createCheckoutSession(params: {
  orderId: string;
  amountCents: number;
  productName: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ ok: true; url: string; id: string } | { ok: false; error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, error: 'Pagamento com cartão indisponível.' };

  const body = toForm({
    mode: 'payment',
    payment_method_types: ['card'],
    locale: 'pt-BR',
    client_reference_id: params.orderId,
    customer_email: params.customerEmail || undefined,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { kind: 'order', ref_id: params.orderId },
    payment_intent_data: { metadata: { kind: 'order', ref_id: params.orderId } },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'brl',
        unit_amount: params.amountCents,
        product_data: { name: params.productName.slice(0, 250) || 'Produto digital' },
      },
    }],
  }).join('&');

  try {
    const res = await fetch(`${API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
      },
      body,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.url) {
      console.error('Stripe erro checkout:', res.status, data?.error?.type, data?.error?.code, data?.error?.message);
      return { ok: false, error: 'Não foi possível iniciar o pagamento com cartão. Tente novamente ou pague com Pix.' };
    }
    return { ok: true, url: String(data.url), id: String(data.id) };
  } catch (e: any) {
    console.error('Stripe erro de rede:', e?.message);
    return { ok: false, error: 'Não foi possível falar com a Stripe agora. Tente novamente ou pague com Pix.' };
  }
}

// Verifica o header 'stripe-signature' (t=...,v1=...) com HMAC-SHA256 de `${t}.${rawBody}`.
// Tolerância de 5 minutos contra reenvio de avisos antigos.
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  let t = '';
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v);
  }
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || !v1.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSec) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  return v1.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const sigBuf = Buffer.from(sig, 'hex');
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  });
}
