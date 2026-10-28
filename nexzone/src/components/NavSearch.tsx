'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import CategoryIcon from './CategoryIcon';
import { CATEGORIAS } from '@/lib/categorias';

export type NavCat = { nome: string; slug: string };

const CHAVE_RECENTES = 'cb_buscas_recentes';
const MAX_RECENTES = 6;
const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
// Buscas recentes ficam SÓ neste navegador. Nada que pareça e-mail ou número longo (CPF, telefone) é guardado.
const pareceDadoPessoal = (t: string) => /[^\s@]+@[^\s@]+/.test(t) || /\d{6,}/.test(t.replace(/[\s.\-/()]/g, ''));

function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, MAX_RECENTES) : [];
  } catch { return []; }
}
function guardarRecente(t: string) {
  if (!t || t.length > 60 || pareceDadoPessoal(t)) return;
  try {
    const atual = lerRecentes().filter((x) => semAcento(x) !== semAcento(t));
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify([t, ...atual].slice(0, MAX_RECENTES)));
  } catch {}
}

type Sugestao =
  | { tipo: 'buscar'; texto: string }
  | { tipo: 'recente'; texto: string }
  | { tipo: 'categoria'; texto: string; slug: string };

export default function NavSearch() {
  const params = useSearchParams();
  const pathname = usePathname();
  const atualQ = params?.get('q') ?? '';
  const [q, setQ] = useState(atualQ);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [recentes, setRecentes] = useState<string[]>([]);
  const router = useRouter();
  const wrap = useRef<HTMLFormElement>(null);

  // Ao trocar de página/termo, o campo mostra o termo da URL
  useEffect(() => { setQ(atualQ); setAberto(false); }, [atualQ, pathname]);
  useEffect(() => { setRecentes(lerRecentes()); }, []);

  const termo = q.trim();
  const sugestoes: Sugestao[] = (() => {
    const out: Sugestao[] = [];
    const t = semAcento(termo);
    if (!t) return recentes.map((texto) => ({ tipo: 'recente' as const, texto }));
    out.push({ tipo: 'buscar', texto: termo });
    for (const c of CATEGORIAS) {
      if (out.length >= 5) break;
      const n = semAcento(c.nome);
      if (t.length >= 2 && (n.includes(t) || n.split(/[^a-z0-9]+/).some((p) => p.length >= 3 && t.startsWith(p)))) out.push({ tipo: 'categoria', texto: c.nome, slug: c.slug });
    }
    for (const r of recentes) {
      if (out.length >= 8) break;
      const rn = semAcento(r);
      if (rn !== t && rn.includes(t)) out.push({ tipo: 'recente', texto: r });
    }
    return out;
  })();
  const mostrar = aberto && sugestoes.length > 0;

  function buscar(t: string) {
    const v = t.trim();
    if (v) { guardarRecente(v); setRecentes(lerRecentes()); }
    setAberto(false);
    router.push(v ? `/produtos?q=${encodeURIComponent(v)}` : '/produtos');
  }
  function escolher(s: Sugestao) {
    if (s.tipo === 'categoria') { setAberto(false); router.push(`/produtos?cat=${encodeURIComponent(s.slug)}`); return; }
    setQ(s.texto);
    buscar(s.texto);
  }
  function go(e: React.FormEvent) {
    e.preventDefault();
    if (mostrar && ativo >= 0 && sugestoes[ativo]) { escolher(sugestoes[ativo]); return; }
    buscar(q);
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setAberto(false); setAtivo(-1); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!sugestoes.length) return;
      e.preventDefault();
      setAberto(true);
      setAtivo((i) => {
        const n = sugestoes.length;
        return e.key === 'ArrowDown' ? (i + 1) % n : (i <= 0 ? n - 1 : i - 1);
      });
    }
  }
  function limparRecentes() {
    try { localStorage.removeItem(CHAVE_RECENTES); } catch {}
    setRecentes([]);
  }

  // Fecha ao tocar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('touchstart', fora, { passive: true });
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('touchstart', fora); };
  }, [aberto]);

  const idOpcao = (i: number) => `nsg-op-${i}`;
  return (
    <form ref={wrap} onSubmit={go} className="nav-search" role="search" aria-label="Buscar no Comprei Barato">
      <Icon name="search" size={18} color="#5A5A72" strokeWidth={2.2} />
      <input value={q} type="search" enterKeyHint="search" maxLength={100} autoComplete="off"
        role="combobox" aria-label="Buscar produtos" aria-autocomplete="list" aria-expanded={mostrar} aria-controls="nsg-lista"
        aria-activedescendant={mostrar && ativo >= 0 ? idOpcao(ativo) : undefined}
        onChange={(e) => { setQ(e.target.value); setAberto(true); setAtivo(-1); }}
        onFocus={() => { setRecentes(lerRecentes()); setAberto(true); }}
        onKeyDown={onKey}
        placeholder="Busque contas, skins, gift cards, cursos…" />
      <button type="submit">Buscar</button>
      {mostrar && (
        <div className="nsg">
          {!termo && <div className="nsg-t"><span>Buscas recentes</span><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={limparRecentes}>Limpar</button></div>}
          <ul id="nsg-lista" role="listbox" aria-label="Sugestões de busca">
            {sugestoes.map((s, i) => (
              <li key={s.tipo + s.texto} id={idOpcao(i)} role="option" aria-selected={i === ativo}
                className={`nsg-op${i === ativo ? ' on' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(s)} onMouseEnter={() => setAtivo(i)}>
                {s.tipo === 'categoria'
                  ? <><span className="nsg-ic"><CategoryIcon cat={s.slug} size={16} /></span><span className="nsg-tx">{s.texto}</span><small>Categoria</small></>
                  : s.tipo === 'recente'
                    ? <><span className="nsg-ic"><Icon name="clock" size={16} /></span><span className="nsg-tx">{s.texto}</span></>
                    : <><span className="nsg-ic"><Icon name="search" size={16} /></span><span className="nsg-tx">Buscar “{s.texto}”</span></>}
              </li>
            ))}
          </ul>
        </div>
      )}
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
      {/* setas para rolar no computador (no celular, arrasta com o dedo) */}
      {fade.l && <button type="button" className="nav-cats-arrow l" aria-label="Rolar categorias para a esquerda"
        onClick={() => ref.current?.scrollBy({ left: -Math.round((ref.current?.clientWidth || 300) * 0.7), behavior: 'smooth' })}><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>}
      {fade.r && <button type="button" className="nav-cats-arrow r" aria-label="Rolar categorias para a direita"
        onClick={() => ref.current?.scrollBy({ left: Math.round((ref.current?.clientWidth || 300) * 0.7), behavior: 'smooth' })}><Icon name="chevronRight" size={18} /></button>}
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
        <Link href="/produtos" className="chip chip-todas">Ver todas<Icon name="chevronRight" size={16} /></Link>
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
