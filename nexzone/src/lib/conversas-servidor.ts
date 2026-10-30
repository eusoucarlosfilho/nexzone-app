// Conversas do pedido — parte do servidor (service_role). Nunca importar em componente do navegador.
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { produtosComCurso } from '@/lib/curso-servidor';
import { entregaPeloVendedor } from '@/lib/confianca';
import { entregaEfetiva, BUCKET_CHAT, ANEXO_CHAT_MAX, ANEXO_CHAT_TIPOS, extDoTipo, validarAnexoChat, caminhoDoPedido, tipoPelosBytes, nomeSeguro } from '@/lib/conversas';
import { avisarWhatsApp, link as linkSite } from '@/lib/whatsapp/enviar';

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
