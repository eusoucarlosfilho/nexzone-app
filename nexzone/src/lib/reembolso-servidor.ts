// Garantia e reembolso — leitura e regras no SERVIDOR (service_role).
import { diasDeGarantia, podePedirReembolso, type Elegibilidade } from './garantia';
import { semSql18 } from './curso-servidor';

export type PedidoReembolso = { id: number; status: 'aberto' | 'aprovado' | 'recusado' | 'cancelado'; motivo: string; detalhe: string | null; resposta: string | null; created_at: string; decidido_em: string | null };

export async function situacaoGarantia(admin: any, orderId: string): Promise<{ sql18: boolean; dias: number; elegivel: Elegibilidade; pedidos: PedidoReembolso[] } | null> {
  const { data: o } = await admin.from('orders').select('id, status, entregue_em, created_at, product_id, products(garantia_dias)').eq('id', orderId).maybeSingle();
  if (!o) return null;
  const { data: rs, error } = await admin.from('reembolso_pedidos')
    .select('id, status, motivo, detalhe, resposta, created_at, decidido_em').eq('order_id', orderId).order('id', { ascending: false }).limit(10);
  const sql18 = !(error && semSql18(error));
  const pedidos = (rs ?? []) as PedidoReembolso[];
  const dias = diasDeGarantia((o as any).products?.garantia_dias);
  const pagoEm = (o as any).entregue_em || ((o as any).status === 'pago' || (o as any).status === 'entregue' ? (o as any).created_at : null);
  const elegivel = podePedirReembolso({
    status: (o as any).status, pagoEm, garantiaDias: dias,
    pedidoAberto: pedidos.some((p) => p.status === 'aberto'),
    jaDecidido: pedidos.find((p) => p.status === 'recusado') ? 'recusado' : null,
  });
  return { sql18, dias, elegivel, pedidos };
}

/** Marca o pedido como reembolsado (mesma regra do botão "Reembolsar" do admin): status + vendas do produto. */
export async function marcarReembolsado(admin: any, orderId: string): Promise<{ ok: boolean; erro?: string }> {
  const { data: order } = await admin.from('orders').select('id, status, product_id').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, erro: 'pedido não encontrado' };
  if ((order as any).status === 'reembolsado') return { ok: true };
  if (!['pago', 'entregue'].includes((order as any).status)) return { ok: false, erro: 'só é possível reembolsar pedidos pagos' };
  const { data: upd, error } = await admin.from('orders').update({ status: 'reembolsado' }).eq('id', orderId).in('status', ['pago', 'entregue']).select('id');
  if (error) return { ok: false, erro: 'falha ao atualizar o pedido' };
  if (upd && upd.length) {
    const { data: prod } = await admin.from('products').select('vendas').eq('id', (order as any).product_id).maybeSingle();
    await admin.from('products').update({ vendas: Math.max(0, ((prod as any)?.vendas ?? 1) - 1) }).eq('id', (order as any).product_id);
  }
  return { ok: true };
}
