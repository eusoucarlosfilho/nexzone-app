'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { CategoryCover } from './CategoryIcon';
import { trackEvento } from '@/lib/rastreio-cliente';

// Faixa de destaque do topo da página inicial.
// Recebe itens já prontos (produtos nativos em destaque + ofertas externas marcadas como destaque),
// montados no servidor. Ofertas externas levam para a página /oferta/<slug> do próprio site,
// com o aviso neutro "Compra no site do vendedor" (a plataforma de origem continua oculta).
export type ItemDestaque = {
  key: string;
  href: string;
  titulo: string;
  meta: string;
  preco: string | null;
  precoDe: string | null;
  desconto: number;
  img: string | null;
  categoria: string | null; // slug, para o ícone e o evento
  externo: boolean;
};

export default function Carousel({ items }: { items: ItemDestaque[] }) {
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (n <= 1 || pause) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n, pause]);

  if (!n) return null;
  const p = items[Math.min(i, n - 1)];
  const ir = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <div className="car" aria-roledescription="carrossel" aria-label="Produtos em destaque"
      onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)} onBlur={() => setPause(false)}>
      <Link href={p.href} className="car-link"
        onClick={() => trackEvento('produto_clique', { origem: 'home', tipo: p.externo ? 'externo' : 'nativo', ...(p.categoria ? { categoria: p.categoria } : {}) })}>
        <div className="car-tx">
          <span className="car-tag"><Icon name="star" size={12} strokeWidth={2.6} />Destaque</span>
          <h2>{p.titulo}</h2>
          <div className="car-meta">{p.meta}</div>
          {p.externo && <div className="car-ext"><Icon name="globe" size={13} strokeWidth={2.2} />Compra no site do vendedor</div>}
          <div className="car-buy">
            {p.preco ? (
              <b>{p.preco}{p.precoDe && p.desconto > 0 && <small><span className="sr-only">De </span>{p.precoDe}</small>}</b>
            ) : null}
            <span>Ver produto →</span>
          </div>
        </div>
        <div className="car-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.img ? <img src={p.img} alt={p.titulo} referrerPolicy="no-referrer" /> : <CategoryCover cat={p.categoria} size={64} />}
          {p.desconto > 0 && <span className="car-off">-{p.desconto}%</span>}
        </div>
      </Link>
      {n > 1 && (
        <>
          <button type="button" className="car-seta car-ant" onClick={() => ir(-1)} aria-label="Destaque anterior"><Icon name="chevronRight" size={20} strokeWidth={2.4} style={{ transform: 'rotate(180deg)' }} /></button>
          <button type="button" className="car-seta car-prox" onClick={() => ir(1)} aria-label="Próximo destaque"><Icon name="chevronRight" size={20} strokeWidth={2.4} /></button>
          <div className="car-dots">
            {items.map((it, k) => (
              <button key={it.key} type="button" onClick={() => setI(k)} aria-label={`Destaque ${k + 1} de ${n}`} aria-current={k === i ? 'true' : undefined}><i /></button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
