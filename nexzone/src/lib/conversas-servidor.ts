// Conversas do pedido — parte do servidor (service_role). Nunca importar em componente do navegador.
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { produtosComCurso } from '@/lib/curso-servidor';
import { entregaPeloVendedor } from '@/lib/confianca';
import { entregaEfetiva, BUCKET_CHAT, ANEXO_CHAT_MAX, ANEXO_CHAT_TIPOS, extDoTipo, validarAnexoChat, caminhoDoPedido, tipoPelosBytes, nomeSeguro } from '@/lib/conversas';
import { avisarWhatsApp, link as linkSite } from '@/lib/whatsapp/enviar';
import { situacaoGarantia } from '@/lib/reembolso-servidor';
import { situacaoChat, podeReclamar, ESPERA_RECLAMACAO_H } from '@/lib/conversas';
import { vendedorPublico } from '@/lib/vendedorPublico';

type Admin = ReturnType<typeof createAdminClient>;
export type Papel = 'comprador' | 'vendedor' | 'admin';

/** Papel de quem acessa a conversa do pedido. */
export async function autorizarPedido(orderId: string, userId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders')
    .select('id, comprador, store_id, status, conteudo_liberado, entregue_em, product_id, products(titulo, emoji, tipo_anuncio), stores(nome, owner, ocultar_vendedor)')
    .eq('id', orderId).maybeSingle();
  if (!order) return { erro: 'pedido não encontrado' as const };
  let papel: Papel | null = null;
  const dono = (order as any).stores?.owner ?? null;
  if ((order as any).comprador === userId) papel = 'comprador';
  else if (dono && dono === userId) papel = 'vendedor';
  else {
    const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if ((prof as any)?.role === 'admin') papel = 'admin';
  }
  if (!papel) return { erro: 'sem acesso' as const };
  return { order: order as any, papel, admin, dono: dono as string | null };
}

/** Data em que o vendedor marcou como entregue (null = não marcou). sql25=false: coluna ainda não existe. */
export async function lerConfirmacao(admin: Admin, ids: string[]): Promise<{ sql25: boolean; mapa: Record<string, string | null> }> {
  if (!ids.length) return { sql25: true, mapa: {} };
  const { data, error } = await admin.from('orders').select('id, entrega_confirmada_em').in('id', ids);
  if (error) return { sql25: false, mapa: {} };
  return { sql25: true, mapa: Object.fromEntries(((data ?? []) as any[]).map((o) => [o.id, o.entrega_confirmada_em ?? null])) };
}

/** Entregue de verdade, para cada pedido (marcado pelo vendedor ou entrega automática real). */
export async function entregasEfetivas(admin: Admin, pedidos: { id: string; status: string; product_id: string; conteudo_liberado?: string | null; tipo_anuncio?: string | null }[]): Promise<{ sql25: boolean; entregue: Record<string, boolean>; confirmadaEm: Record<string, string | null> }> {
  const ids = pedidos.map((p) => p.id);
  const prodIds = Array.from(new Set(pedidos.map((p) => p.product_id).filter(Boolean)));
  const [conf, arqs, cursos] = await Promise.all([
    lerConfirmacao(admin, ids),
    prodIds.length ? admin.from('products').select('id, arquivo_path').in('id', prodIds) : Promise.resolve({ data: [] as any[] }),
    produtosComCurso(admin, prodIds).catch(() => new Set<string>()),
  ]);
  const comArquivo = new Set(((arqs as any).data ?? []).filter((p: any) => !!p.arquivo_path).map((p: any) => p.id));
  const entregue: Record<string, boolean> = {};
  for (const p of pedidos) {
    // Sem o SQL 25 não dá para o vendedor marcar: mantém o comportamento antigo (pago = entregue)
    entregue[p.id] = !conf.sql25
      ? ['pago', 'entregue'].includes(p.status)
      : entregaEfetiva({ status: p.status, entrega_confirmada_em: conf.mapa[p.id] ?? null }, {
          manual: entregaPeloVendedor(p.tipo_anuncio), temArquivo: comArquivo.has(p.product_id), temCurso: cursos.has(p.product_id), conteudo: p.conteudo_liberado ?? null,
        });
  }
  return { sql25: conf.sql25, entregue, confirmadaEm: conf.mapa };
}

/** Vendedor (ou admin) marca o pedido como entregue. Não mexe em status, entregue_em nem saldo. */
export async function marcarEntregue(admin: Admin, o: { id: string; comprador: string; status: string; products?: any }, quem: 'vendedor' | 'admin'): Promise<{ ok: boolean; erro?: string; ja?: boolean; status?: number }> {
  if (!['pago', 'entregue'].includes(o.status)) return { ok: false, erro: 'Só dá para marcar como entregue um pedido pago.', status: 409 };
  const { data, error } = await admin.from('orders').update({ entrega_confirmada_em: new Date().toISOString() })
    .eq('id', o.id).is('entrega_confirmada_em', null).in('status', ['pago', 'entregue']).select('id');
  if (error) return /entrega_confirmada_em/.test(error.message || '')
    ? { ok: false, erro: 'Falta rodar o SQL 25 para marcar entregas.', status: 503 }
    : { ok: false, erro: 'Não foi possível marcar agora.', status: 500 };
  if (!data || !data.length) return { ok: true, ja: true };
  const titulo = o.products?.titulo || 'seu pedido';
  await admin.from('order_messages').insert({
    order_id: o.id, remetente: null, papel: 'sistema',
    texto: `✅ ${quem === 'admin' ? 'O suporte' : 'O vendedor'} marcou este pedido como entregue. Se você não recebeu ou algo não funciona, avise por aqui ou use "Preciso de ajuda" no pedido.`,
  });
  try {
    await admin.from('notificacoes').insert({ user_id: o.comprador, tipo: 'compra', titulo: 'Pedido entregue', texto: `"${String(titulo).slice(0, 120)}" foi marcado como entregue. Confira e, se estiver tudo certo, avalie a compra.`, link: `/pedido/${o.id}`, grupo: `entregue:${o.id}` });
  } catch { /* o aviso nunca trava a entrega */ }
  await avisarWhatsApp({ evento: 'pedido_entregue', chave: `pedido_entregue:${o.id}`, userId: o.comprador, vars: { produto: titulo, pedido: String(o.id).slice(0, 8), link: linkSite(`/pedido/${o.id}`) } });
  return { ok: true };
}

/** Registra que a pessoa viu a conversa agora (para o "Lido" do outro lado). */
export async function registrarVisto(admin: Admin, orderId: string, userId: string) {
  try { await admin.from('chat_lido').upsert({ order_id: orderId, user_id: userId, visto_em: new Date().toISOString() }); } catch { /* sem SQL 25 */ }
}

export async function vistoDe(admin: Admin, orderId: string, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await admin.from('chat_lido').select('visto_em').eq('order_id', orderId).eq('user_id', userId).maybeSingle();
    if (error) return null;
    return (data as any)?.visto_em ?? null;
  } catch { return null; }
}

// ---------- Anexos ----------
async function garantirBucket(admin: Admin) {
  try {
    const { data } = await admin.storage.getBucket(BUCKET_CHAT);
    if (data) return;
    await admin.storage.createBucket(BUCKET_CHAT, { public: false, fileSizeLimit: ANEXO_CHAT_MAX, allowedMimeTypes: [...ANEXO_CHAT_TIPOS] });
  } catch (e: any) { console.error('[chat] bucket:', e?.message || e); }
}

/** Passo 1: URL assinada para o navegador subir o arquivo direto no Storage (sem o limite de 4,5 MB da Vercel). */
export async function uploadAnexoChat(admin: Admin, orderId: string, tipo: string, tamanho: number) {
  const erro = validarAnexoChat(tipo, tamanho);
  if (erro) return { error: erro };
  await garantirBucket(admin);
  const path = `${orderId}/${randomUUID()}.${extDoTipo(tipo)}`;
  const { data, error } = await admin.storage.from(BUCKET_CHAT).createSignedUploadUrl(path);
  if (error || !data) return { error: 'Não foi possível preparar o envio do anexo.' };
  return { path: data.path, token: data.token };
}

/** Passo 2: confere o arquivo de verdade (dono do caminho, tamanho e assinatura dos bytes) antes de gravar a mensagem. */
export async function confirmarAnexoChat(admin: Admin, orderId: string, path: unknown, nome: unknown): Promise<{ ok: true; path: string; nome: string; tipo: string; tamanho: number } | { ok: false; error: string }> {
  if (!caminhoDoPedido(path, orderId)) return { ok: false, error: 'Anexo inválido.' };
  const p = String(path);
  const bucket = admin.storage.from(BUCKET_CHAT);
  const { data: blob, error } = await bucket.download(p);
  if (error || !blob) return { ok: false, error: 'Anexo não encontrado. Envie de novo.' };
  const buf = new Uint8Array(await blob.arrayBuffer());
  const tipo = tipoPelosBytes(buf);
  if (!tipo || buf.byteLength > ANEXO_CHAT_MAX || extDoTipo(tipo) !== p.split('.').pop()) {
    await bucket.remove([p]);
    return { ok: false, error: buf.byteLength > ANEXO_CHAT_MAX ? 'O anexo pode ter no máximo 10 MB.' : 'Envie uma imagem (PNG, JPG, WEBP, GIF) ou PDF.' };
  }
  return { ok: true, path: p, nome: nomeSeguro(nome), tipo, tamanho: buf.byteLength };
}

export async function linkAnexoChat(admin: Admin, path: string, nome: string, baixar: boolean): Promise<string | null> {
  const { data, error } = await admin.storage.from(BUCKET_CHAT).createSignedUrl(path, 300, baixar ? { download: nome } : undefined);
  return error ? null : (data as any)?.signedUrl ?? null;
}

// ---------- Fechamento do chat ----------
/** Conversa aberta ou encerrada: fecha no fim da garantia (ou quando a venda é reembolsada); reembolso/reclamação aberta mantém aberta. */
export async function estadoDoChat(admin: Admin, order: { id: string; status: string }): Promise<{ fechado: boolean; fechaEm: string | null }> {
  try {
    const [g, cmp] = await Promise.all([
      situacaoGarantia(admin, order.id),
      admin.from('complaints').select('id').eq('order_id', order.id).eq('status', 'aberta').limit(1),
    ]);
    if (!['pago', 'entregue', 'reembolsado', 'cancelado'].includes(order.status)) return { fechado: false, fechaEm: null };
    return situacaoChat({
      status: order.status,
      fimGarantia: g?.elegivel.ate ? g.elegivel.ate.toISOString() : null,
      reembolsoAberto: !!g?.pedidos.some((p) => p.status === 'aberto'),
      reclamacaoAberta: !!(cmp.data && cmp.data.length),
    });
  } catch { return { fechado: false, fechaEm: null }; }
}

// ---------- Produtos citados no chat ----------
export type CartaoProduto = { id: string; titulo: string; preco: number; precoDe: number | null; capa_url: string | null; ativo: boolean; loja: string };

export async function cartoesDeProduto(admin: Admin, ids: string[]): Promise<Record<string, CartaoProduto>> {
  if (!ids.length) return {};
  const { data } = await admin.from('products').select('id, titulo, preco, preco_promo, capa_url, status, stores(nome, ocultar_vendedor, status)').in('id', ids.slice(0, 30));
  const out: Record<string, CartaoProduto> = {};
  for (const p of (data ?? []) as any[]) {
    const promo = p.preco_promo != null && Number(p.preco_promo) < Number(p.preco);
    out[p.id] = { id: p.id, titulo: p.titulo, preco: Number(promo ? p.preco_promo : p.preco), precoDe: promo ? Number(p.preco) : null, capa_url: p.capa_url ?? null, ativo: p.status === 'ativo', loja: vendedorPublico(p.stores).nome };
  }
  return out;
}

// ---------- Mensagem retida ----------
export async function avisarAdminsRetida(admin: Admin, orderId: string, titulo: string, papel: string) {
  try {
    const { data: adms } = await admin.from('profiles').select('id').eq('role', 'admin');
    const quem = papel === 'vendedor' ? 'O vendedor' : 'O cliente';
    const linhas = ((adms ?? []) as any[]).map((a) => ({
      user_id: a.id, tipo: 'aviso', titulo: 'Mensagem retida no chat',
      texto: `${quem} tentou passar contato externo em "${String(titulo).slice(0, 100)}". Abra a conversa para analisar.`,
      link: `/admin?aba=pedidos&chat=${orderId}`, grupo: `retida:${orderId}`,
    }));
    if (linhas.length) await admin.from('notificacoes').insert(linhas);
  } catch (e: any) { console.error('[chat] aviso retida', e?.message || e); }
}

// ---------- Quando o cliente pode reclamar ----------
/**
 * Reclamação por problema: só depois de 24 h do pagamento (o vendedor tem esse tempo para resolver),
 * a não ser que ele já tenha marcado como entregue. Desistir da compra vale desde o primeiro minuto.
 * Depois da garantia não dá mais.
 */
export async function liberacaoReclamacao(admin: Admin, orderId: string, motivo: string | null): Promise<{ pode: boolean; erro?: string; liberaEm?: string | null }> {
  const { data: o } = await admin.from('orders').select('id, status, created_at, entregue_em, product_id, conteudo_liberado, products(tipo_anuncio)').eq('id', orderId).maybeSingle();
  if (!o) return { pode: false, erro: 'Pedido não encontrado.' };
  const g = await situacaoGarantia(admin, orderId);
  if (g?.elegivel.ate && g.elegivel.ate.getTime() < Date.now()) {
    return { pode: false, erro: `A garantia terminou em ${g.elegivel.ate.toLocaleDateString('pt-BR')}. Depois disso não dá mais para reclamar desta compra.` };
  }
  const ent = await entregasEfetivas(admin, [{ id: (o as any).id, status: (o as any).status, product_id: (o as any).product_id, conteudo_liberado: (o as any).conteudo_liberado, tipo_anuncio: (o as any).products?.tipo_anuncio }]);
  const r = podeReclamar({ pagoEm: (o as any).entregue_em || (o as any).created_at, entregue: !!ent.entregue[orderId], motivo });
  if (!r.pode) {
    const quando = r.liberaEm ? new Date(r.liberaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return { pode: false, liberaEm: r.liberaEm, erro: `O vendedor tem até ${ESPERA_RECLAMACAO_H} h para resolver. Fale com ele no chat do pedido; se não resolver, a reclamação libera em ${quando}.` };
  }
  return { pode: true };
}

// ---------- Vendedor cancela a venda ----------
export async function cancelarPeloVendedor(admin: Admin, o: { id: string; comprador: string; status: string }, detalhe: string): Promise<{ ok: boolean; erro?: string; status?: number }> {
  if (!['pago', 'entregue'].includes(o.status)) return { ok: false, erro: 'Só dá para cancelar uma venda paga.', status: 409 };
  const g = await situacaoGarantia(admin, o.id);
  if (g?.pedidos.some((p) => p.status === 'aberto')) return { ok: false, erro: 'Já existe um reembolso em andamento para esta venda.', status: 409 };
  if (g?.elegivel.ate && g.elegivel.ate.getTime() < Date.now()) return { ok: false, erro: 'O prazo da garantia já terminou. Para devolver agora, fale com o suporte.', status: 409 };
  const { error } = await admin.from('reembolso_pedidos').insert({ order_id: o.id, comprador: o.comprador, motivo: 'cancelado_vendedor', detalhe: detalhe.slice(0, 2000) || null, origem: 'vendedor' });
  if (error) {
    if (/origem|cancelado_vendedor|check/i.test(error.message || '')) return { ok: false, erro: 'Falta rodar o SQL 29 para o vendedor cancelar.', status: 503 };
    if (/reembolso_um_aberto|duplicate/i.test(error.message || '')) return { ok: false, erro: 'Já existe um reembolso em andamento para esta venda.', status: 409 };
    return { ok: false, erro: 'Não foi possível cancelar agora.', status: 500 };
  }
  await admin.from('order_messages').insert({
    order_id: o.id, remetente: null, papel: 'sistema',
    texto: `O vendedor cancelou esta venda${detalhe ? `: "${detalhe.slice(0, 300)}"` : ''}. O valor volta para o cliente pela mesma forma de pagamento (o suporte faz a devolução, normalmente em até 2 dias úteis).`,
  });
  return { ok: true };
}
