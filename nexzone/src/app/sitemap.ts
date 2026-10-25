import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/server';

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
  const fixas: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: agora, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/produtos`, lastModified: agora, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/seja-vendedor`, lastModified: agora, changeFrequency: 'monthly', priority: 0.6 },
  ];

  try {
    const admin = createAdminClient();
    const [produtos, lojas] = await Promise.all([
      paginar<{ id: string; created_at: string | null }>((a, b) =>
        admin.from('products').select('id, created_at').eq('status', 'ativo').order('created_at', { ascending: false }).range(a, b)),
      paginar<{ slug: string | null; created_at: string | null }>((a, b) =>
        admin.from('stores').select('slug, created_at').neq('status', 'suspenso').not('slug', 'is', null).order('created_at', { ascending: false }).range(a, b)),
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
    return [...fixas, ...prodUrls, ...lojaUrls];
  } catch {
    return fixas;
  }
}
