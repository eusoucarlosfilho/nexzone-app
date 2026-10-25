// Acesso a dados das ofertas parceiras (SÓ servidor).
// Se a tabela ainda não existir (script 01 não aprovado), tudo devolve lista vazia:
// a vitrine, a busca e o admin continuam funcionando sem ofertas.
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { COLUNAS_PAGINA, COLUNAS_VITRINE, type OfertaParceira, type OfertaVitrine } from './tipos';
import { MIX_PADRAO, normalizarMix, type ConfigMix } from './mix';

export const CHAVE_MIX = 'ofertas_parceiras_mix';

/** Configuração de exibição (tabela settings, chave/valor). Sem a chave: padrão. */
export async function configMix(): Promise<ConfigMix> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('settings').select('value').eq('key', CHAVE_MIX).maybeSingle();
    return data ? normalizarMix((data as any).value) : MIX_PADRAO;
  } catch {
    return MIX_PADRAO;
  }
}

type Filtro = { categoria?: string | null; termo?: string | null; min?: number; max?: number; limite?: number; excluirSlug?: string };

/**
 * Ofertas ATIVAS para a vitrine. Usa o cliente do visitante: a RLS (script 01) só libera status 'ativo'.
 * Ordem: destaque, prioridade, mais recentes. Nunca usa contagem de vendas.
 */
export async function ofertasAtivas(f: Filtro = {}): Promise<OfertaVitrine[]> {
  try {
    const supabase = createClient();
    let q = supabase.from('partner_offers').select(COLUNAS_VITRINE).eq('status', 'ativo');
    if (f.categoria) q = q.eq('category', f.categoria);
    if (f.termo) q = q.ilike('title', `%${f.termo}%`);
    if (f.min && f.min > 0) q = q.gte('price_reference', f.min);
    if (f.max && f.max > 0) q = q.lte('price_reference', f.max);
    if (f.excluirSlug) q = q.neq('slug', f.excluirSlug);
    const { data, error } = await q
      .order('featured', { ascending: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(f.limite ?? 12, 1), 48));
    if (error || !data) return [];
    return data as unknown as OfertaVitrine[];
  } catch {
    return [];
  }
}

/** Uma oferta ativa pelo slug (página pública). */
export async function ofertaPorSlug(slug: string): Promise<(OfertaVitrine & Pick<OfertaParceira, 'description' | 'tags' | 'last_verified_at'>) | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('partner_offers').select(COLUNAS_PAGINA).eq('slug', slug).eq('status', 'ativo').maybeSingle();
    if (error || !data) return null;
    return data as any;
  } catch {
    return null;
  }
}

/** Para a rota de saída: busca o link no servidor (service role) e confere status. */
export async function ofertaParaSaida(id: string): Promise<Pick<OfertaParceira, 'id' | 'status' | 'affiliate_url' | 'external_product_url' | 'external_platform'> | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('partner_offers')
      .select('id, status, affiliate_url, external_product_url, external_platform').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return data as any;
  } catch {
    return null;
  }
}
