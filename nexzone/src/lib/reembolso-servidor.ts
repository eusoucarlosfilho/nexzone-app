// Garantia e reembolso — leitura e regras no SERVIDOR (service_role).
import { diasDeGarantia, podePedirReembolso, type Elegibilidade } from './garantia';
import { semSql18 } from './curso-servidor';
import { estornarCashback } from './campanhas-servidor';

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
    await estornarCashback(admin, orderId);
  }
  return { ok: true };
}

// ---------- Devolução confirmada pelo gateway (SQL 31) ----------
export type InfoDevolucao = { origem: 'webhook' | 'conferencia' | 'manual'; valor?: number | null; ref?: string | null; em?: string | null; adminId?: string | null };

/** Grava os campos da devolução; sem o SQL 31 não faz nada (o reembolso continua valendo). */
async function gravarDevolucao(admin: any, reembolsoId: number, campos: Record<string, unknown>) {
  const { error } = await admin.from('reembolso_pedidos').update(campos).eq('id', reembolsoId);
  if (error && !/devolucao/.test(error.message || '')) console.error('[devolução]', error.message);
}

/**
 * O dinheiro voltou para o cliente (a MisticPay avisou, a conferência achou, ou um admin confirmou à mão).
 * Marca o pedido como reembolsado (com as mesmas regras do admin), fecha o pedido de reembolso e registra a devolução.
 * Se a devolução foi feita direto no painel da MisticPay, sem ninguém pedir pelo site, cria o registro.
 * Idempotente: um segundo aviso não muda nada.
 */
export async function registrarDevolucao(admin: any, orderId: string, info: InfoDevolucao): Promise<{ ok: boolean; erro?: string; novo?: boolean }> {
  const { data: o } = await admin.from('orders').select('id, status, comprador').eq('id', orderId).maybeSingle();
  if (!o) return { ok: false, erro: 'pedido não encontrado' };
  const jaEra = (o as any).status === 'reembolsado';
  if (!jaEra) {
    const m = await marcarReembolsado(admin, orderId);
    if (!m.ok) return m;
  }
  const agora = new Date().toISOString();
  const campos = {
    devolucao_status: info.origem === 'manual' ? 'manual' : 'confirmada', devolucao_em: info.em || agora,
    devolucao_valor: info.valor ?? null, devolucao_ref: info.ref ? String(info.ref).slice(0, 120) : null,
    devolucao_origem: info.origem, devolucao_por: info.origem === 'manual' ? info.adminId ?? null : null,
  };
  const { data: rs } = await admin.from('reembolso_pedidos').select('id, status').eq('order_id', orderId).in('status', ['aberto', 'aprovado']).order('id', { ascending: false }).limit(1);
  const r = ((rs ?? []) as any[])[0];
  let novo = false;
  if (r) {
    if (r.status === 'aberto') {
      await admin.from('reembolso_pedidos').update({ status: 'aprovado', decidido_em: agora, decidido_por: info.adminId ?? null, resposta: info.origem === 'manual' ? null : 'Devolvido pelo gateway de pagamento.' }).eq('id', r.id).eq('status', 'aberto');
    }
    await gravarDevolucao(admin, r.id, campos);
  } else if ((o as any).comprador) {
    // devolução feita direto no painel do gateway: registra para ficar no histórico
    const { data: ins } = await admin.from('reembolso_pedidos').insert({
      order_id: orderId, comprador: (o as any).comprador, motivo: 'outro', detalhe: 'Devolução feita direto no painel do gateway.',
      status: 'aprovado', resposta: 'Devolvido pelo gateway de pagamento.', decidido_em: agora,
    }).select('id').maybeSingle();
    if ((ins as any)?.id) { await gravarDevolucao(admin, (ins as any).id, campos); novo = true; }
  }
  if (!jaEra || info.origem !== 'manual') {
    const valor = info.valor ? ` de ${Number(info.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '';
    await admin.from('order_messages').insert({ order_id: orderId, remetente: null, papel: 'sistema', texto: `✅ Reembolso concluído: a devolução${valor} foi feita na mesma forma de pagamento. No Pix, o valor já está na conta de onde saiu o pagamento.` });
  }
  return { ok: true, novo };
}

/** O banco recusou a devolução: o pedido de reembolso volta a ficar pendente de ação no admin. */
export async function registrarDevolucaoRecusada(admin: any, orderId: string) {
  const { data: rs } = await admin.from('reembolso_pedidos').select('id').eq('order_id', orderId).in('status', ['aberto', 'aprovado']).order('id', { ascending: false }).limit(1);
  const r = ((rs ?? []) as any[])[0];
  if (r) await gravarDevolucao(admin, r.id, { devolucao_status: 'recusada', devolucao_em: new Date().toISOString(), devolucao_origem: 'webhook' });
  try {
    const { data: adms } = await admin.from('profiles').select('id').eq('role', 'admin');
    const linhas = ((adms ?? []) as any[]).map((a) => ({ user_id: a.id, tipo: 'aviso', titulo: 'Devolução recusada pelo banco', texto: 'A MisticPay avisou que o banco recusou uma devolução de Pix. O valor voltou para o saldo. Abra Reembolsos para resolver.', link: '/admin?aba=reembolsos', grupo: `devolucao_recusada:${orderId}` }));
    if (linhas.length) await admin.from('notificacoes').insert(linhas);
  } catch { /* sem notificações */ }
}
