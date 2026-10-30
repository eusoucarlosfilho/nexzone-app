'use client';
import { useEffect } from 'react';
import { usePixels, dispararPixel } from '@/components/PixelsVenda';
import type { RastreioProduto } from '@/lib/rastreioVenda';

// Pixel do PRÓPRIO produto (configurado no checkout dele): PageView + ViewContent só nesta página.
// Quem vem do anúncio entra no funil já na página do produto, não só no checkout.
export default function PixelProduto({ rastreio, produtoId, titulo, valor }: { rastreio: RastreioProduto; produtoId: string; titulo: string; valor: number }) {
  usePixels(rastreio);
  useEffect(() => {
    const t = setTimeout(() => dispararPixel(rastreio, 'ViewContent', { valor, produtoId, titulo }), 400);
    return () => clearTimeout(t);
  }, [rastreio, produtoId, titulo, valor]);
  return null;
}
