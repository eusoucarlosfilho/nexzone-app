'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type FavCtx = { favs: Set<string>; toggle: (id: string) => void; loaded: boolean };
const Ctx = createContext<FavCtx | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/favorites', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d) => { setFavs(new Set(d.ids || [])); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const toggle = useCallback(async (id: string) => {
    const was = favs.has(id);
    setFavs((prev) => { const n = new Set(prev); was ? n.delete(id) : n.add(id); return n; });
    try {
      const r = await fetch('/api/favorite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ productId: id }),
      });
      if (r.status === 401) { window.location.href = '/login'; return; }
      const d = await r.json();
      setFavs((prev) => { const n = new Set(prev); d.favorited ? n.add(id) : n.delete(id); return n; });
    } catch {
      setFavs((prev) => { const n = new Set(prev); was ? n.add(id) : n.delete(id); return n; });
    }
  }, [favs]);

  return <Ctx.Provider value={{ favs, toggle, loaded }}>{children}</Ctx.Provider>;
}

export function useFavorites() { return useContext(Ctx); }
