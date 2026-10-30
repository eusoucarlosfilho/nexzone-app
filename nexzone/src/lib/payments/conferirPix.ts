// Conferência do Pix direto no gateway — rede de segurança para quando o aviso (webhook) não chega,
// chega antes de a MisticPay marcar o Pix como pago, ou falha. Sem isso o cliente paga e o pedido
// fica "Aguardando pagamento" para sempre (e ainda recebe lembrete de Pix).
// Usado: pela página do pedido (enquanto o cliente espera), pela rotina de 1 em 1 minuto e pelo admin.
// USO EXCLUSIVO NO SERVIDOR (client admin). Nunca lança erro. A liberação é a MESMA do webhook (fulfill.ts).
import { gatewayDaRef, type PaymentGateway } from './gateway';
import { processarPedido, ORDER_FIELDS } from './fulfill';
import { gravarFormaPagamento } from './formaPagamento';

export type ResultadoConferencia = 'liberado' | 'pendente' | 'ja_pago' | 'sem_ref' | 'erro' | 'recusado';

const CAMPOS = `${ORDER_FIELDS}, gateway_ref, created_at`;

/** Confere UM pedido pendente no gateway e libera se o Pix já caiu. */
export async function conferirPedido(admin: any, orderOrId: any, gw?: PaymentGateway): Promise<ResultadoConferencia> {
  try {
    let order = orderOrId;
    if (typeof orderOrId === 'string') {
      const { data } = await admin.from('orders').select(CAMPOS).eq('id', orderOrId).maybeSingle();
      order = data;
    }
    if (!order) return 'erro';
    if (order.status !== 'pendente') return 'ja_pago';
    const ref = String(order.gateway_ref || '');
    if (!ref || ref.startsWith('dev_')) return 'sem_ref';
    // pela referência: "mp:<id>" consulta o Mercado Pago; o resto, o gateway padrão
    const alvo = ref.startsWith('mp:') || !gw ? await gatewayDaRef(ref) : { gw, ref };
    const ev = await alvo.gw.checkPayment(alvo.ref);
    if (!ev) return 'erro';
    if (ev.status === 'recusado') return 'recusado';
    if (ev.status !== 'pago') return 'pendente';
    const liberado = await processarPedido(admin, order, { status: 'pago', amount: ev.amount, gatewayRef: ref });
    if (liberado) {
      await gravarFormaPagamento(admin, order.id, 'pix');
      console.warn('[conferirPix] pedido liberado pela conferência (o aviso do gateway não tinha chegado):', order.id);
      return 'liberado';
    }
    return 'pendente'; // pago, mas valor menor que o esperado (fulfill registra no log) ou outro aviso liberou junto
  } catch (e: any) {
    console.error('[conferirPix]', e?.message);
    return 'erro';
  }
}

/** Confere em lote os pedidos Pix pendentes recentes (mais novos primeiro), dentro de um tempo máximo. */
export async function conferirPendentes(admin: any, opt: { horas?: number; limite?: number; ms?: number } = {}) {
  const horas = opt.horas ?? 48, limite = opt.limite ?? 15, ms = opt.ms ?? 8000;
  const inicio = Date.now();
  const r = { conferidos: 0, liberados: [] as string[], erros: 0 };
  try {
    const desde = new Date(Date.now() - horas * 3600000).toISOString();
    const ate = new Date(Date.now() - 60000).toISOString(); // dá 1 min para o webhook normal chegar
    const { data } = await admin.from('orders').select(CAMPOS)
      .eq('status', 'pendente').not('gateway_ref', 'is', null)
      .gte('created_at', desde).lte('created_at', ate)
      .order('created_at', { ascending: false }).limit(limite);
    const lista = (data ?? []) as any[];
    if (!lista.length) return r;
    const gw = (await gatewayDaRef('')).gw;
    for (const o of lista) {
      if (Date.now() - inicio > ms) break;
      const x = await conferirPedido(admin, o, gw);
      r.conferidos++;
      if (x === 'liberado') r.liberados.push(o.id);
      if (x === 'erro') r.erros++;
    }
  } catch (e: any) { console.error('[conferirPendentes]', e?.message); }
  return r;
}
