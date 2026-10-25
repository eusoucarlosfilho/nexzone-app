import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyStripeSignature } from '@/lib/payments/stripe';
import { processarPedido, ORDER_FIELDS } from '@/lib/payments/fulfill';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook da Stripe (cartão). Separado do webhook do Pix.
// Só age em avisos com assinatura válida (STRIPE_WEBHOOK_SECRET).
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'json inválido' }, { status: 400 }); }

  const type = String(event?.type || '');
  const session = event?.data?.object;
  const relevante =
    (type === 'checkout.session.completed' && session?.payment_status === 'paid') ||
    type === 'checkout.session.async_payment_succeeded';
  if (!relevante || !session) return NextResponse.json({ received: true });

  const kind = session.metadata?.kind;
  const refId = String(session.metadata?.ref_id || session.client_reference_id || '');
  if (kind !== 'order' || !refId) return NextResponse.json({ received: true });

  if (String(session.currency || '').toLowerCase() !== 'brl') {
    console.error('Stripe webhook: moeda inesperada', session.id, session.currency);
    return NextResponse.json({ received: true });
  }
  const amount = Number(session.amount_total) / 100;
  if (!Number.isFinite(amount)) return NextResponse.json({ received: true });

  try {
    const admin = createAdminClient();
    const { data: order } = await admin.from('orders').select(ORDER_FIELDS).eq('id', refId).maybeSingle();
    if (!order) {
      console.error('Stripe webhook: pedido não encontrado', refId, session.id);
      return NextResponse.json({ received: true });
    }
    // Idempotente: se o pedido já não estiver 'pendente', processarPedido não faz nada.
    // valorConfere (dentro de processarPedido) bloqueia se amount_total não cobrir orders.total.
    const liberado = await processarPedido(admin, order, { status: 'pago', amount, gatewayRef: session.id });
    if (!liberado && (order as any).status !== 'pendente') {
      console.warn('Stripe webhook: pedido já não estava pendente (possível pagamento em dobro)', refId, session.id);
    }
  } catch (e: any) {
    // 500 faz a Stripe tentar de novo depois.
    console.error('Stripe webhook: erro ao processar', e?.message);
    return NextResponse.json({ error: 'erro interno' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
