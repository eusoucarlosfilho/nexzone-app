'use client';
import { useFavorites } from '@/lib/favorites';

export default function FavButton({ productId, overlay }: { productId: string; overlay?: boolean }) {
  const fav = useFavorites();
  const active = !!fav?.favs?.has(productId);
  function click(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); fav?.toggle(productId); }
  return (
    <button onClick={click} aria-label={active ? 'Remover dos favoritos' : 'Favoritar'} title={active ? 'Remover dos favoritos' : 'Favoritar'}
      aria-pressed={active} className={`fav-btn ${overlay ? 'ov' : 'inl'} ${active ? 'on' : ''}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16162A" strokeWidth="2.2" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}
