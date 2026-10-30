import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripeAvailable, createCheckoutSession, STRIPE_MIN_BRL } from '@/lib/payments/stripe';
import { lerTaxas } from '@/lib/settings';
import { taxaComprador, comissaoCobreGateway } from '@/lib/taxas';
import { lerCfgCampanhas, ehPrimeiraCompra } from '@/lib/campanhas-servidor';
import { taxaComPromo } from '@/lib/campanhas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cria a Checkout Session da Stripe para um pedido PENDENTE do próprio comprador.
// O valor vem SEMPRE de orders.total (servidor), nunca do navegador.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });

  if (!(await stripeAvailable())) {
    return NextResponse.json({ error: 'Pagamento com cartão indisponível no momento. Use o Pix.' }, { status: 403 });
  }

  let orderId = '';
  try { orderId = String((await req.json())?.orderId || ''); } catch {}
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders')
    .select('id, status, total, taxa, comprador, products(titulo)')
    .eq('id', orderId).maybeSingle();

  if (!order || (order as any).comprador !== user.id) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  }
  if ((order as any).status !== 'pendente') {
    return NextResponse.json({ error: 'Este pedido não está mais aguardando pagamento.' }, { status: 409 });
  }

  const total = Number((order as any).total);
  if (!Number.isFinite(total) || total < STRIPE_MIN_BRL) {
    return NextResponse.json({ error: 'Valor abaixo do mínimo para cartão. Pague com Pix.' }, { status: 400 });
  }
  // Taxa de serviço do cartão (paga pelo comprador, mostrada antes do pagamento). O webhook confere se cobre o total.
  // 1ª compra sem taxa (SQL 28): no cartão só se o admin ligou "incluir cartão"
  // Trava: a 1ª compra só sai sem taxa se a comissão do pedido cobrir a tarifa da Stripe (nunca vende no prejuízo)
  const cfgT = await lerTaxas();
  const promoCartao = (await ehPrimeiraCompra(admin, user.id)) && comissaoCobreGateway('cartao', total, Number((order as any).taxa) || 0, cfgT);
  const taxaCartao = taxaComPromo(taxaComprador('cartao', total, cfgT), 'cartao', promoCartao, await lerCfgCampanhas(admin));
  const amountCents = Math.round((total + taxaCartao) * 100);
  const { error: eTaxa } = await admin.from('orders').update({ taxa_comprador_cartao: taxaCartao }).eq('id', orderId).eq('status', 'pendente');
  if (eTaxa && !/taxa_comprador/i.test(eTaxa.message || '')) console.error('[stripe] taxa do comprador:', eTaxa.message);

  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
  const titulo = (order as any).products?.titulo || 'Produto digital';

  const s = await createCheckoutSession({
    orderId,
    amountCents,
    productName: titulo,
    customerEmail: user.email,
    successUrl: `${site}/pedido/${orderId}?cartao=ok`,
    cancelUrl: `${site}/pedido/${orderId}`,
  });
  if (!s.ok) return NextResponse.json({ error: s.error }, { status: 502 });

  return NextResponse.json({ url: s.url });
}
