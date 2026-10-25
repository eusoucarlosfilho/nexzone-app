// ============================================================
// Galeria de fotos do produto — regras únicas (usadas no navegador e no servidor).
// capa_url é SEMPRE a 1ª foto da galeria.
// ============================================================

export const MAX_FOTOS = 8;
export const MAX_MB_FOTO = 3;

/** Início da URL pública do bucket 'capas' do NOSSO Supabase (ex.: https://xxx.supabase.co/storage/v1/object/public/capas/). */
export function prefixoBucketCapas(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/capas/`;
}

/** Fotos para exibir: a galeria; produto antigo sem galeria usa [capa_url]. */
export function galeriaDe(p: { imagens?: unknown; capa_url?: string | null } | null | undefined): string[] {
  const lista = Array.isArray(p?.imagens) ? (p!.imagens as unknown[]).filter((u): u is string => typeof u === 'string' && !!u) : [];
  if (lista.length) return lista;
  return p?.capa_url ? [p.capa_url] : [];
}

/**
 * Valida a lista enviada pelo vendedor.
 * - no máximo MAX_FOTOS, sem repetidas;
 * - cada URL precisa ser do nosso bucket 'capas', DENTRO da pasta do próprio vendedor
 *   (o upload e a importação de anúncio gravam em capas/{userId}/...);
 * - `jaSalvas`: fotos que o produto já tinha (ex.: capa antiga de antes desta regra) continuam aceitas na edição.
 */
export function validarImagens(raw: unknown, userId: string, jaSalvas: string[] = []):
  { ok: true; imagens: string[] } | { ok: false; error: string } {
  let lista: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) lista = [];
    else { try { lista = JSON.parse(raw); } catch { return { ok: false, error: 'Lista de fotos inválida.' }; } }
  }
  if (lista == null) lista = [];
  if (!Array.isArray(lista)) return { ok: false, error: 'Lista de fotos inválida.' };
  if (lista.length > MAX_FOTOS) return { ok: false, error: `Máximo de ${MAX_FOTOS} fotos por produto.` };

  const prefixo = prefixoBucketCapas() + `${userId}/`;
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of lista) {
    if (typeof item !== 'string' || !item.trim()) return { ok: false, error: 'Lista de fotos inválida.' };
    const u = item.trim();
    if (vistos.has(u)) continue;
    const doNossoBucket = u.startsWith(prefixo) && !u.includes('..') && !/[?#\s]/.test(u) && u.length <= 500;
    if (!doNossoBucket && !jaSalvas.includes(u)) {
      return { ok: false, error: 'Use só fotos enviadas pelo cadastro do produto (links externos não são aceitos).' };
    }
    vistos.add(u);
    out.push(u);
  }
  return { ok: true, imagens: out };
}
