import type { MetadataRoute } from 'next';
import { BLOQUEADOS } from '@/lib/seoSite';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.compreibarato.com.br').replace(/\/+$/, '');

// Áreas privadas fora do Google; vitrine, produtos, categorias e lojas liberados.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: BLOQUEADOS }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
