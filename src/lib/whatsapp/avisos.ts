// Avisos por WhatsApp de eventos que NÃO têm e-mail hoje (só WhatsApp).
// Cada função busca o que precisa, chama avisarWhatsApp e NUNCA lança erro.
// SÓ SERVIDOR (usa o cliente administrativo apenas para LER dados do destinatário).
import { createAdminClient } from '@/lib/supabase/server';
import { moneyBR } from '@/lib/email';
import { avisarWhatsApp, link } from './enviar';

const seguro = async (fn: () => Promise<void>) => { try { await fn(); } catch (e: any) { console.error('[whatsapp] aviso:', e?.message || e); } };

/** Produto aprovado ou reprovado na moderação → vendedor. */
export const avisarProdutoModerado = (productId: string, aprovado: boolean) => seguro(async () => {
  const admin = createAdminClient();
  const { data: p } = await admin.from('products').select('id, titulo, stores(owner)').eq('id', productId).maybeSingle();
  const owner = (p as any)?.stores?.owner;
  if (!owner) return;
  const evento = aprovado ? 'produto_aprovado' : 'produto_reprovado';
  await avisarWhatsApp({
    evento, chave: `${evento}:${productId}:${Math.floor(Date.now() / 3600000)}`, userId: owner,
    vars: { produto: (p as any).titulo, link: link(aprovado ? `/produto/${productId}` : '/vender/produtos') },
  });
});

/** Saque solicitado / pago / recusado → dono da loja. */
export const avisarSaque = (payoutId: string | null, storeId: string | null, evento: 'saque_solicitado' | 'saque_pago' | 'saque_recusado', valor?: number) => seguro(async () => {
  const admin = createAdminClient();
  let sid = storeId, v = valor, pid = payoutId;
  if (payoutId && (!sid || v === undefined)) {
    const { data: po } = await admin.from('payouts').select('id, store_id, valor').eq('id', payoutId).maybeSingle();
    sid = (po as any)?.store_id ?? sid; v = Number((po as any)?.valor ?? v ?? 0);
  }
  if (!sid) return;
  const { data: st } = await admin.from('stores').select('owner').eq('id', sid).maybeSingle();
  if (!(st as any)?.owner) return;
  await avisarWhatsApp({
    evento, chave: `${evento}:${pid || `${sid}:${Date.now() - (Date.now() % 60000)}`}`, userId: (st as any).owner,
    vars: { valor: moneyBR(v ?? 0), link: link('/vender/recebimentos') },
  });
});

async function dadosPedido(orderId: string) {
  const admin = createAdminClient();
  const { data: o } = await admin.from('orders').select('id, comprador, products(titulo), stores(owner)').eq('id', orderId).maybeSingle();
  return o as any;
}

/** Reclamação aberta → vendedor. */
export const avisarReclamacaoAberta = (orderId: string) => seguro(async () => {
  const o = await dadosPedido(orderId);
  if (!o?.stores?.owner) return;
  await avisarWhatsApp({
    evento: 'reclamacao_aberta', chave: `reclamacao_aberta:${orderId}:${Math.floor(Date.now() / 3600000)}`, userId: o.stores.owner,
    vars: { produto: o.products?.titulo, pedido: String(orderId).slice(0, 8), link: link(`/vender/conversas/${orderId}`) },
  });
});

/** Reclamação resolvida → comprador e vendedor. */
export const avisarReclamacaoResolvida = (orderId: string, complaintId: string) => seguro(async () => {
  const o = await dadosPedido(orderId);
  if (!o) return;
  const vars = { produto: o.products?.titulo, pedido: String(orderId).slice(0, 8) };
  await Promise.all([
    avisarWhatsApp({ evento: 'reclamacao_resolvida', chave: `reclamacao_resolvida:${complaintId}:comprador`, userId: o.comprador, vars: { ...vars, link: link(`/pedido/${orderId}`) } }),
    o.stores?.owner ? avisarWhatsApp({ evento: 'reclamacao_resolvida', chave: `reclamacao_resolvida:${complaintId}:vendedor`, userId: o.stores.owner, vars: { ...vars, link: link(`/vender/conversas/${orderId}`) } }) : Promise.resolve(),
  ]);
});

/** Avaliação recebida → vendedor. */
export const avisarAvaliacao = (orderId: string, nota: number) => seguro(async () => {
  const o = await dadosPedido(orderId);
  if (!o?.stores?.owner) return;
  await avisarWhatsApp({
    evento: 'avaliacao_recebida', chave: `avaliacao_recebida:${orderId}`, userId: o.stores.owner,
    vars: { produto: o.products?.titulo, nota, link: link('/vender/produtos') },
  });
});

/** Aviso/advertência do admin → usuário (o mesmo texto da faixa no site). */
export const avisarAvisoAdmin = (userId: string, texto: string, noticeKey: string) => seguro(async () => {
  await avisarWhatsApp({
    evento: 'aviso_admin', chave: `aviso_admin:${noticeKey}`, userId,
    vars: { mensagem: String(texto).slice(0, 600), link: link('/conta') },
  });
});
