'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import CategoryIcon, { categoryColors } from './CategoryIcon';
import type { NavCat } from './NavSearch';

const ID = 'menu-mobile';

export default function MobileMenu({ loggedIn, cats }: { loggedIn: boolean; cats: NavCat[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const btnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // Fecha ao trocar de rota
  useEffect(() => { setOpen(false); }, [pathname]);

  // Foco no primeiro link ao abrir, devolve o foco ao botão ao fechar; trava o scroll do fundo
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      document.body.classList.add('mm-open');
      const first = drawerRef.current?.querySelector<HTMLElement>('.mm-body a, .mm-body button');
      first?.focus();
    } else {
      document.body.classList.remove('mm-open');
      if (wasOpen.current) { wasOpen.current = false; btnRef.current?.focus(); }
    }
    return () => document.body.classList.remove('mm-open');
  }, [open]);

  // Fecha se a tela crescer para desktop com a gaveta aberta
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 861px)');
    const on = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const items = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const is = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));
  const L = ({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) => (
    <Link key={href} href={href} className={`mm-link${is(href) ? ' on' : ''}`} aria-current={is(href) ? 'page' : undefined} onClick={close}>
      <Icon name={icon} size={20} />{children}
    </Link>
  );

  return (
    <>
      <button ref={btnRef} type="button" className="nav-burger" aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open} aria-controls={ID} onClick={() => setOpen((v) => !v)}>
        <Icon name="menu" size={22} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="mm-ov" onClick={close} aria-hidden="true" />
          <div ref={drawerRef} id={ID} className="mm" role="dialog" aria-modal="true" aria-label="Menu" onKeyDown={onKeyDown} tabIndex={-1}>
            <div className="mm-hd">
              <b>Menu</b>
              <button type="button" className="mm-x" onClick={close} aria-label="Fechar menu"><Icon name="x" size={20} /></button>
            </div>
            <div className="mm-body">
              {L({ href: '/produtos', icon: 'grid', children: 'Explorar' })}
              {loggedIn ? (
                <>
                  {L({ href: '/favoritos', icon: 'heart', children: 'Favoritos' })}
                  {L({ href: '/minhas-compras', icon: 'bag', children: 'Minhas compras' })}
                  {L({ href: '/cb-points', icon: 'star', children: 'CB Points' })}
                  {L({ href: '/vender', icon: 'store', children: 'Minha loja' })}
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="mm-link"><Icon name="logout" size={20} />Sair</button>
                  </form>
                </>
              ) : (
                <>
                  {L({ href: '/login', icon: 'user', children: 'Entrar' })}
                  <Link href="/vender" className="btn btn-dark mm-cta" onClick={close}><Icon name="store" size={18} />Vender</Link>
                </>
              )}
              {cats.length > 0 && (
                <>
                  <div className="mm-sec">Categorias</div>
                  {cats.map((c) => {
                    const { bg } = categoryColors(c.slug);
                    return (
                      <Link key={c.slug} href={`/produtos?cat=${encodeURIComponent(c.slug)}`} className="mm-link" onClick={close}>
                        <span className="ci" style={{ background: bg }}><CategoryIcon cat={c.slug} size={18} /></span>{c.nome}
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
