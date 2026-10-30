import { NextResponse } from 'next/server';
import { gatewayDoAviso } from '@/lib/payments/gateway';
import { createAdminClient } from '@/lib/supabase/server';
import { processarPedido, processarBoost, ORDER_FIELDS, BOOST_FIELDS } from '@/lib/payments/fulfill';
import { gravarFormaPagamento } from '@/lib/payments/formaPagamento';
import { registrarDevolucao, registrarDevolucaoRecusada } from '@/lib/reembolso-servidor';

// Aviso do gateway Pix (MisticPay / Mercado Pago).
// A liberação (pedido e destaque) fica em src/lib/payments/fulfill.ts, compartilhada com o webhook da Stripe.
export async function POST(req: Request) {
  const raw = await req.text();
  // MisticPay e Mercado Pago (Pix das vendas pequenas) chegam nesta mesma URL
  const gw = await gatewayDoAviso(req, raw);
  const event = await gw.parseWebhook(req, raw);
  if (!event) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const ev = { status: event.status, amount: event.amount, gatewayRef: event.gatewayRef };

  // BOOST identificado pelo orderId (gateways que devolvem o external_reference, ex.: Mercado Pago)
  if (event.orderId && event.orderId.startsWith('boost:')) {
    const boostId = event.orderId.slice(6);
    const { data: boost } = await admin.from('boosts').select(BOOST_FIELDS).eq('id', boostId).maybeSingle();
    if (boost) await processarBoost(admin, boost, ev);
    return NextResponse.json({ ok: true });
  }

  // PEDIDO — por id (se veio) ou por gateway_ref (ex.: MisticPay, que só devolve o id dela)
  let oq = admin.from('orders').select(ORDER_FIELDS);
  oq = event.orderId && /^[0-9a-f-]{36}$/i.test(event.orderId) ? oq.eq('id', event.orderId) : oq.eq('gateway_ref', event.gatewayRef);
  const { data: order } = await oq.maybeSingle();
  if (order) {
    // Devolução (reembolso feito no painel da MisticPay ou pelo banco): fecha o reembolso no site sozinho
    if (event.devolucao) {
      const d = event.devolucao;
      if (d.status === 'RECUSADO') await registrarDevolucaoRecusada(admin, (order as any).id);
      else if (d.parcial) {
        try {
          const { data: adms } = await admin.from('profiles').select('id').eq('role', 'admin');
          const linhas = ((adms ?? []) as any[]).map((a) => ({ user_id: a.id, tipo: 'aviso', titulo: 'Devolução PARCIAL na MisticPay', texto: `Um Pix foi devolvido em parte${d.valor ? ` (R$ ${d.valor.toFixed(2).replace('.', ',')})` : ''}. O pedido não foi marcado como reembolsado: confira em Reembolsos.`, link: '/admin?aba=reembolsos', grupo: `devolucao_parcial:${(order as any).id}` }));
          if (linhas.length) await admin.from('notificacoes').insert(linhas);
        } catch { /* segue */ }
      } else if (event.status === 'estornado') {
        await registrarDevolucao(admin, (order as any).id, { origem: 'webhook', valor: d.valor, ref: d.ref, em: d.em });
      }
      return NextResponse.json({ ok: true });
    }
    const liberado = await processarPedido(admin, order, ev);
    if (liberado && ev.status === 'pago') await gravarFormaPagamento(admin, (order as any).id, 'pix'); // Dashboard: entrou no Pix
    return NextResponse.json({ ok: true });
  }

  // Não achou pedido: pode ser um BOOST pago via MisticPay (casamos por gateway_ref)
  if (event.gatewayRef) {
    const { data: boost } = await admin.from('boosts').select(BOOST_FIELDS).eq('gateway_ref', event.gatewayRef).maybeSingle();
    if (boost) await processarBoost(admin, boost, ev);
  }

  return NextResponse.json({ ok: true });
}
