'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import CategoryIcon from './CategoryIcon';

/**
 * Miniatura de um PRODUTO: mostra a foto (capa_url = 1ª foto da galeria).
 * Sem foto, ou se a imagem falhar ao carregar, mostra o ícone da categoria (CategoryIcon).
 * Use só onde a tela se refere a um produto. Onde o ícone representa a CATEGORIA
 * (barra de categorias, menu, filtros), continue usando CategoryIcon.
 *
 * - tamanho: lado do quadradinho, em px (padrão 46, o mesmo do .em do globals.css)
 * - raio: arredondamento, em px (padrão proporcional ao tamanho)
 * - icone: tamanho do ícone de reserva (padrão: o tamanho que cada tela já usava)
 * - className/style: para manter o quadradinho da tela (ex.: className="em")
 */
export default function ProductThumb({
  capa_url, categoria, titulo, tamanho = 46, raio, icone, className, style,
}: {
  capa_url?: string | null;
  categoria?: string | null;
  titulo?: string | null;
  tamanho?: number;
  raio?: number;
  icone?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [falhou, setFalhou] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setFalhou(false);
    // a imagem pode ter falhado antes do React ligar o onError (página vinda do servidor)
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setFalhou(true);
  }, [capa_url]);
  const temFoto = !!capa_url && !falhou;

  return (
    <span
      className={className}
      style={{
        width: tamanho, height: tamanho, minWidth: tamanho,
        borderRadius: raio ?? Math.round(tamanho * 0.3),
        overflow: 'hidden', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {temFoto ? (
        <img
          ref={imgRef}
          src={capa_url!}
          alt={titulo || 'Produto'}
          loading="lazy"
          decoding="async"
          onError={() => setFalhou(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <CategoryIcon cat={categoria} size={icone ?? Math.round(tamanho * 0.48)} />
      )}
    </span>
  );
}
