import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { PAGINAS_FIXAS } from '@/lib/seoSite';
import { CATEGORIAS } from '@/lib/categorias';
import { listarJogos } from '@/lib/crescimento-servidor';
import { TIPOS_SEO } from '@/lib/crescimento';

export const revalidate = 3600; // regenera a cada 1h

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.compreibarato.com.br').replace(/\/+$/, '');
const PAGE = 1000;
const MAX = 45000; // limite do protocolo é 50.000 URLs por sitemap

async function paginar<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date();
  // Páginas fixas + todas as categorias (cada categoria é uma porta de entrada no Google)
  const fixas: MetadataRoute.Sitemap = [
    ...PAGINAS_FIXAS.map((f) => ({ url: `${BASE}${f.caminho === '/' ? '/' : f.caminho}`, lastModified: agora, changeFrequency: f.freq, priority: f.prioridade })),
    ...CATEGORIAS.map((c) => ({ url: `${BASE}/categoria/${c.slug}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];

  try {
    const admin = createAdminClient();
    const [produtos, lojas] = await Promise.all([
      paginar<{ id: string; created_at: string | null }>((a, b) =>
        admin.from('products').select('id, created_at').eq('status', 'ativo').order('created_at', { ascending: false }).range(a, b)),
      paginar<{ slug: string | null; created_at: string | null }>((a, b) =>
        admin.from('stores').select('slug, created_at').neq('status', 'suspenso').eq('ocultar_vendedor', false).not('slug', 'is', null).order('created_at', { ascending: false }).range(a, b)),
    ]);

    const prodUrls: MetadataRoute.Sitemap = produtos.map((p) => ({
      url: `${BASE}/produto/${p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : agora,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
    const lojaUrls: MetadataRoute.Sitemap = lojas
      .filter((l) => l.slug)
      .map((l) => ({
        url: `${BASE}/loja/${encodeURIComponent(String(l.slug))}`,
        lastModified: l.created_at ? new Date(l.created_at) : agora,
        changeFrequency: 'weekly',
        priority: 0.6,
      }));
    // Páginas por jogo (e por tipo) — só as que têm anúncio ativo
    const jogos = await listarJogos(admin).catch(() => []);
    const jogoUrls: MetadataRoute.Sitemap = [
      { url: `${BASE}/jogos`, lastModified: agora, changeFrequency: 'daily', priority: 0.8 },
      { url: `${BASE}/black-friday`, lastModified: agora, changeFrequency: 'daily', priority: 0.7 },
      { url: `${BASE}/oferta-do-dia`, lastModified: agora, changeFrequency: 'daily', priority: 0.6 },
      ...jogos.flatMap((j) => [
        { url: `${BASE}/jogo/${j.slug}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.8 },
        ...TIPOS_SEO.filter((t) => (j.tipos[t.tipo] || 0) > 0).map((t) => ({ url: `${BASE}/jogo/${j.slug}/${t.slug}`, lastModified: agora, changeFrequency: 'daily' as const, priority: 0.7 })),
      ]),
    ];
    return [...fixas, ...jogoUrls, ...prodUrls, ...lojaUrls];
  } catch {
    return fixas;
  }
}
