// Vitrine OFERTAS DO DIA — SÓ SERVIDOR. Configuração em settings (sem tabela nova); leitura em cache de 60 s.
import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { PRODUTO_CARD } from '@/lib/consultas';
import { produtosPublicos } from '@/lib/vendedorPublico';
import type { Product } from '@/lib/types';
import { CHAVE_OFERTAS_DIA, OFERTAS_DIA_PADRAO, itensNoAr, mostrarContador, normalizarOfertasDia, type CfgOfertasDia } from '@/lib/ofertasDia';

export async function lerCfgOfertasDia(admin: any = createAdminClient()): Promise<CfgOfertasDia> {
  try {
    const { data } = await admin.from('settings').select('value').eq('key', CHAVE_OFERTAS_DIA).maybeSingle();
    return data ? normalizarOfertasDia((data as any).value) : OFERTAS_DIA_PADRAO;
  } catch { return OFERTAS_DIA_PADRAO; }
}

export async function salvarCfgOfertasDia(admin: any, v: unknown): Promise<CfgOfertasDia> {
  const cfg = normalizarOfertasDia(v);
  await admin.from('settings').upsert({ key: CHAVE_OFERTAS_DIA, value: cfg, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  try { revalidateTag('ofertas-dia'); } catch { /* fora de requisição */ }
  return cfg;
}

// Configuração + produtos ativos, em cache. O filtro de horário é feito a cada requisição (fora do cache).
const lerBase = unstable_cache(async () => {
  const admin = createAdminClient();
  const cfg = await lerCfgOfertasDia(admin);
  if (!cfg.ativo || !cfg.itens.length) return { cfg, produtos: [] as Product[] };
  const { data } = await admin.from('products').select(PRODUTO_CARD).eq('status', 'ativo').in('id', cfg.itens.map((i) => i.id));
  return { cfg, produtos: produtosPublicos((data ?? []) as unknown as Product[]) };
}, ['ofertas-dia'], { revalidate: 60, tags: ['ofertas-dia'] });

/** Itens da vitrine agora: só anúncios ativos, na ordem do admin, com o contador quando há prazo real. */
export async function vitrineOfertasDia(): Promise<{ titulo: string; subtitulo: string; itens: { produto: Product; fim: number | null }[] } | null> {
  try {
    const { cfg, produtos } = await lerBase();
    const mapa = new Map(produtos.map((p) => [p.id, p]));
    const itens = itensNoAr(cfg).map((i) => ({ produto: mapa.get(i.id), fim: mostrarContador(i.fim) })).filter((x) => x.produto) as { produto: Product; fim: number | null }[];
    // menos de 3 anúncios ativos no ar: a seção não aparece (vitrine vazia passa a impressão errada)
    return itens.length >= 3 ? { titulo: cfg.titulo, subtitulo: cfg.subtitulo, itens } : null;
  } catch { return null; }
}
