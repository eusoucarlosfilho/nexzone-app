import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase/server';
import { vendedorPublico } from '@/lib/vendedorPublico';
import { arteDivulgacao } from '@/lib/arteDivulgacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// Imagem promocional de um anúncio ATIVO, com os dados reais dele (título, preço, loja).
// GET /api/divulgar/imagem/<id>?f=quadrado (1080x1080, feed) | story (1080x1920, stories/status)
// Nada inventado: sem nota, sem "mais vendido", sem desconto que o anúncio não tem.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function capaPng(url: string | null): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    const png = await sharp(buf).resize(1000, 1000, { fit: 'cover' }).png().toBuffer(); // webp/avif viram png
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return null; }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return new Response('Anúncio inválido', { status: 400 });
  const f = new URL(req.url).searchParams.get('f') === 'story' ? 'story' : 'quadrado';
  const { data: p } = await createAdminClient().from('products')
    .select('id, titulo, preco, preco_promo, capa_url, status, stores(nome, ocultar_vendedor)').eq('id', params.id).maybeSingle();
  if (!p || (p as any).status !== 'ativo') return new Response('Este anúncio não está disponível.', { status: 404 });

  const preco = Number((p as any).preco); const promo = (p as any).preco_promo == null ? null : Number((p as any).preco_promo);
  const capa = await capaPng((p as any).capa_url);
  return arteDivulgacao({ f, titulo: String((p as any).titulo || ''), preco, promo, loja: vendedorPublico((p as any).stores).nome || 'Comprei Barato', capa }, { 'Cache-Control': 'public, max-age=600, s-maxage=600' });
}
