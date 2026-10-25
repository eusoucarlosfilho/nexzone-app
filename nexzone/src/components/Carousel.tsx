'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { CategoryCover } from './CategoryIcon';
import type { Product } from '@/lib/types';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function Carousel({ items }: { items: Product[] }) {
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
  const preco = p.preco_promo ?? p.preco;

  return (
    <div className="car" aria-roledescription="carrossel" aria-label="Produtos em destaque"
      onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)} onBlur={() => setPause(false)}>
      <Link href={`/produto/${p.id}`} className="car-link">
        <div className="car-tx">
          <span className="car-tag"><Icon name="star" size={12} strokeWidth={2.6} />Destaque</span>
          <h2>{p.titulo}</h2>
          <div className="car-meta">{p.stores?.nome ?? 'Loja'}{p.categoria ? ` · ${p.categoria}` : ''}</div>
          <div className="car-buy">
            <b>{money(preco)}</b>
            <span>Ver produto →</span>
          </div>
        </div>
        <div className="car-img">
          {p.capa_url ? <img src={p.capa_url} alt={p.titulo} /> : <CategoryCover cat={p.categoria} size={64} />}
        </div>
      </Link>
      {n > 1 && (
        <div className="car-dots">
          {items.map((_, k) => (
            <button key={k} type="button" onClick={() => setI(k)} aria-label={`Destaque ${k + 1} de ${n}`} aria-current={k === i ? 'true' : undefined}><i /></button>
          ))}
        </div>
      )}
    </div>
  );
}
