'use client';
import { useFavorites } from '@/lib/favorites';

export default function FavButton({ productId, overlay }: { productId: string; overlay?: boolean }) {
  const fav = useFavorites();
  const active = !!fav?.favs?.has(productId);
  function click(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); fav?.toggle(productId); }
  const base: React.CSSProperties = {
    border: 'none', cursor: 'pointer', borderRadius: 50, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', lineHeight: 1, fontSize: overlay ? 16 : 20,
  };
  const ov: React.CSSProperties = overlay
    ? { position: 'absolute', top: 10, right: 10, width: 34, height: 34, background: 'rgba(255,255,255,.92)', boxShadow: '0 2px 8px rgba(0,0,0,.15)', zIndex: 3 }
    : { background: 'transparent', padding: 4 };
  return (
    <button onClick={click} aria-label={active ? 'Remover dos favoritos' : 'Favoritar'} title={active ? 'Remover dos favoritos' : 'Favoritar'} style={{ ...base, ...ov }}>
      {active ? '❤️' : '🤍'}
    </button>
  );
}
