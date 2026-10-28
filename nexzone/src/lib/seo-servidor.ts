// ============================================================
// SEO — parte do servidor: configuração (verificação do Google/Bing, perfis da marca)
// e aviso automático aos buscadores (IndexNow: Bing, Yandex, Naver, Seznam e outros).
// O Google não usa IndexNow: para ele valem o mapa do site (sitemap.xml) e o Search Console.
// ============================================================
import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from './supabase/server';
import { limparPerfis, SITE } from './seoSite';

/** Chave pública do IndexNow (o arquivo /{chave}.txt está em /public). Não é segredo. */
export const INDEXNOW_CHAVE = '3a71e5f73c6bbd4ddcb6779557f3c368';

export type SeoConfig = { google: string; bing: string; perfis: string[]; ultimoIndexNow: string | null };
const CHAVES = ['seo_google', 'seo_bing', 'seo_perfis', 'seo_indexnow_em'];
const VAZIO: SeoConfig = { google: '', bing: '', perfis: [], ultimoIndexNow: null };

/** Só o código do meta (aceita colar a tag inteira do Search Console). */
export function limparVerificacao(v: unknown): string {
  const s = String(v ?? '').trim();
  const m = /content=["']([^"']+)["']/i.exec(s);
  return (m ? m[1] : s).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
}

async function lerDoBanco(): Promise<SeoConfig> {
  try {
    const { data } = await createAdminClient().from('settings').select('key, value').in('key', CHAVES);
    const m: Record<string, any> = Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, r.value]));
    return {
      google: limparVerificacao(m.seo_google),
      bing: limparVerificacao(m.seo_bing),
      perfis: limparPerfis(m.seo_perfis),
      ultimoIndexNow: typeof m.seo_indexnow_em === 'string' ? m.seo_indexnow_em : null,
    };
  } catch { return VAZIO; }
}

/** Lida com cache de 10 min (o admin limpa o cache ao salvar). */
export const lerSeoConfig = unstable_cache(lerDoBanco, ['seo-config'], { revalidate: 600, tags: ['seo-config'] });
export const lerSeoConfigAgora = lerDoBanco;
export const limparCacheSeo = () => { try { revalidateTag('seo-config'); } catch {} };

/** Envia URLs ao IndexNow. Nunca lança erro; devolve se o envio foi aceito. */
export async function avisarBuscadores(urls: string[]): Promise<{ ok: boolean; status?: number; enviados: number }> {
  const lista = Array.from(new Set(urls.filter((u) => u.startsWith(SITE + '/')))).slice(0, 10000);
  if (!lista.length) return { ok: false, enviados: 0 };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, signal: ctrl.signal, cache: 'no-store',
      body: JSON.stringify({ host: new URL(SITE).host, key: INDEXNOW_CHAVE, keyLocation: `${SITE}/${INDEXNOW_CHAVE}.txt`, urlList: lista }),
    });
    const ok = r.status === 200 || r.status === 202;
    if (ok) {
      try { await createAdminClient().from('settings').upsert({ key: 'seo_indexnow_em', value: new Date().toISOString(), updated_at: new Date().toISOString() }); } catch {}
    } else console.warn('[indexnow] status', r.status);
    return { ok, status: r.status, enviados: lista.length };
  } catch (e: any) {
    console.warn('[indexnow] falhou', String(e?.message || e).slice(0, 120));
    return { ok: false, enviados: 0 };
  } finally { clearTimeout(t); }
}
