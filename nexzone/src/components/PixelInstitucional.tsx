'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { pageViewInstitucional } from '@/lib/pixelInstitucional';

// Coloque <PixelInstitucional /> só nas páginas de destino das campanhas da marca
// (hoje: home e /black-friday). Dispara PageView no pixel institucional a cada abertura da página.
export default function PixelInstitucional() {
  const caminho = usePathname();
  useEffect(() => { pageViewInstitucional(); }, [caminho]);
  return null;
}
