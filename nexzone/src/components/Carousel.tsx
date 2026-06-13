'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/types';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function Carousel({ items }: { items: Product[] }) {
  const [i, setI] = useState(0);
  const n = items.length;

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);

  if (!n) return null;
  const p = items[i];
  const preco = p.preco_promo ?? p.preco;

  return (
    <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', background: 'var(--grad)', minHeight: 260 }}>
      <Link href={`/produto/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 32, textDecoration: 'none', color: '#fff', minHeight: 260 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,.22)', borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 800, fontFamily: 'Outfit' }}>⭐ Destaque</span>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900, letterSpacing: '-.8px', margin: '14px 0 8px', lineHeight: 1.1 }}>{p.titulo}</h2>
          <div style={{ opacity: .92, fontSize: 14, marginBottom: 18 }}>{p.stores?.nome ?? 'Loja'} · {p.categoria}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>{money(preco)}</span>
            <span style={{ background: '#fff', color: 'var(--orange)', borderRadius: 12, padding: '10px 20px', fontFamily: 'Outfit', fontWeight: 800 }}>Ver produto →</span>
          </div>
        </div>
        <div style={{ width: 230, height: 196, borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, flexShrink: 0 }}>
          {p.capa_url ? <img src={p.capa_url} alt={p.titulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{p.emoji}</span>}
        </div>
      </Link>
      {n > 1 && (
        <div style={{ position: 'absolute', bottom: 14, left: 32, display: 'flex', gap: 7 }}>
          {items.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`slide ${k + 1}`}
              style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 50, border: 'none', cursor: 'pointer', background: k === i ? '#fff' : 'rgba(255,255,255,.5)', transition: '.2s' }} />
          ))}
        </div>
      )}
    </div>
  );
}
