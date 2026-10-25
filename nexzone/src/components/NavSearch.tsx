'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import CategoryIcon from './CategoryIcon';

export type NavCat = { nome: string; slug: string };

export default function NavSearch() {
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get('q') ?? '');
  const router = useRouter();
  function go(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `/produtos?q=${encodeURIComponent(t)}` : '/produtos');
  }
  return (
    <form onSubmit={go} className="nav-search" role="search">
      <Icon name="search" size={18} color="#5A5A72" strokeWidth={2.2} />
      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produtos" type="search"
        enterKeyHint="search" placeholder="Busque prompts, planilhas, templates, automações…" />
      <button type="submit">Buscar</button>
    </form>
  );
}

/** Linha de categorias (sem estado ativo) — usada também como fallback do Suspense. */
export function CatChips({ cats, active }: { cats: NavCat[]; active?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ l: false, r: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => {
      const max = el.scrollWidth - el.clientWidth;
      setFade({ l: el.scrollLeft > 2, r: el.scrollLeft < max - 2 });
    };
    upd();
    el.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    return () => { el.removeEventListener('scroll', upd); window.removeEventListener('resize', upd); };
  }, [cats.length]);

  // Garante que o chip ativo fique visível ao entrar na página
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.chip.on');
    if (el && ref.current) {
      const c = ref.current;
      const left = el.offsetLeft - c.offsetLeft;
      if (left + el.offsetWidth > c.scrollLeft + c.clientWidth || left < c.scrollLeft) c.scrollLeft = Math.max(0, left - 24);
    }
  }, [active]);

  return (
    <nav className="nav-cats-wrap" aria-label="Categorias">
      <div ref={ref} className={`nav-cats${fade.l ? ' fl' : ''}${fade.r ? ' fr' : ''}`}>
        <Link href="/produtos" className={`chip${active === '' ? ' on' : ''}`} aria-current={active === '' ? 'page' : undefined}>
          <Icon name="grid" size={18} />Todos
        </Link>
        {cats.map((c) => {
          const on = active === c.slug;
          return (
            <Link key={c.slug} href={`/produtos?cat=${encodeURIComponent(c.slug)}`} className={`chip${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
              <CategoryIcon cat={c.slug} size={18} color={on ? '#fff' : undefined} />{c.nome}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Descobre a categoria ativa a partir de ?cat=<slug> ou /categoria/<slug>. */
export function useActiveCat(): string | null {
  const pathname = usePathname() || '';
  const params = useSearchParams();
  const m = pathname.match(/^\/categoria\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  const cat = params?.get('cat');
  if (cat) return cat;
  if (pathname === '/produtos' && !params?.get('q')) return '';
  return null;
}

export function NavCats({ cats }: { cats: NavCat[] }) {
  const active = useActiveCat();
  return <CatChips cats={cats} active={active} />;
}
