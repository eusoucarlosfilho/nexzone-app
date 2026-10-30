// Confiança no checkout — parte do servidor (lê settings, números reais do vendedor, pede avaliações).
// SÓ SERVIDOR. Nenhuma função aqui lança erro para quem chamou.
import { createAdminClient } from '@/lib/supabase/server';
import { CHAVES_EMPRESA, EMPRESA_VAZIA, lerDadosEmpresa, precisaPedirAvaliacao, JANELA_AVALIACAO, type DadosEmpresa, type StatsVendedor } from './confianca';
import { avisarWhatsApp, link } from '@/lib/whatsapp/enviar';

export async function lerEmpresa(): Promise<DadosEmpresa> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('settings').select('key, value').in('key', [...CHAVES_EMPRESA, 'support_email']);
    const map: Record<string, unknown> = Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, r.value]));
    return lerDadosEmpresa(map, map.support_email);
  } catch {
    return { ...EMPRESA_VAZIA };
  }
}

/** Números reais da loja: desde quando, vendas pagas e avaliações. Loja oculta/oficial usa a plataforma toda. */
export async function statsVendedor(storeId: string | null | undefined): Promise<StatsVendedor> {
  const vazio: StatsVendedor = { desde: null, vendas: 0, avaliacoes: 0, media: 0 };
  if (!storeId) return vazio;
  try {
    const admin = createAdminClient();
    const [loja, vendas, produtos] = await Promise.all([
      admin.from('stores').select('created_at').eq('id', storeId).maybeSingle(),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', storeId).in('status', ['pago', 'entregue']),
      admin.from('products').select('id').eq('store_id', storeId).limit(1000),
    ]);
    const ids = ((produtos.data ?? []) as any[]).map((p) => p.id);
    let notas: number[] = [];
    if (ids.length) {
      const { data: rv } = await admin.from('reviews').select('nota').in('product_id', ids).limit(5000);
      notas = ((rv ?? []) as any[]).map((r) => Number(r.nota)).filter((n) => n >= 1 && n <= 5);
    }
    return {
      desde: (loja.data as any)?.created_at ?? null,
      vendas: vendas.count ?? 0,
      avaliacoes: notas.length,
      media: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0,
    };
  } catch {
    return vazio;
  }
}

/**
 * Pede a avaliação de quem recebeu o produto há 24–72 h e ainda não avaliou.
 * Sino + celular (notificação) e WhatsApp (se ligado e o cliente aceitou avisos).
 * A própria notificação (grupo pedaval:<pedido>) é a trava: um pedido por compra.
 */
export async function pedirAvaliacoes(admin: any, limite = 10): Promise<{ enviados: number }> {
  const agora = Date.now();
  let enviados = 0;
  try {
    const { data: pedidos, error } = await admin.from('orders')
      .select('id, comprador, status, entregue_em, product_id, products(titulo)')
      .in('status', ['pago', 'entregue'])
      .gte('entregue_em', new Date(agora - JANELA_AVALIACAO.deHoras * 3600000).toISOString())
      .lte('entregue_em', new Date(agora - JANELA_AVALIACAO.ateHoras * 3600000).toISOString())
      .order('entregue_em', { ascending: true }).limit(60);
    if (error || !pedidos?.length) return { enviados: 0 };
    const ids = (pedidos as any[]).map((o) => o.id);
    const [rv, ja, rec] = await Promise.all([
      admin.from('reviews').select('order_id').in('order_id', ids),
      admin.from('notificacoes').select('grupo').in('grupo', ids.map((i) => `pedaval:${i}`)),
      admin.from('complaints').select('order_id').in('order_id', ids),
    ]);
    const avaliados = new Set(((rv.data ?? []) as any[]).map((r) => r.order_id));
    const pedidos2 = new Set(((ja.data ?? []) as any[]).map((r) => String(r.grupo).slice(8)));
    const reclamou = new Set(((rec.data ?? []) as any[]).map((r) => r.order_id)); // quem reclamou não recebe "avalie"
    for (const o of pedidos as any[]) {
      if (enviados >= limite) break;
      if (reclamou.has(o.id)) continue;
      if (!precisaPedirAvaliacao(o, agora, avaliados.has(o.id), pedidos2.has(o.id))) continue;
      const titulo = o.products?.titulo || 'sua compra';
      const destino = `/pedido/${o.id}#avaliar`;
      const { error: e } = await admin.from('notificacoes').insert({
        user_id: o.comprador, tipo: 'compra', titulo: 'Como foi sua compra?',
        texto: `Conte em 1 minuto como foi ${String(titulo).slice(0, 120)}. Sua avaliação ajuda outros gamers a comprar com segurança.`,
        link: destino, grupo: `pedaval:${o.id}`,
      });
      if (e) continue; // sem a trava gravada, não manda nada (evita repetir a cada minuto)
      await avisarWhatsApp({ evento: 'pedir_avaliacao', chave: `pedir_avaliacao:${o.id}`, userId: o.comprador, vars: { produto: titulo, pedido: String(o.id).slice(0, 8), link: link(destino) } });
      enviados++;
    }
  } catch (e: any) {
    console.error('[avaliacao] pedir', e?.message || e);
  }
  return { enviados };
}
