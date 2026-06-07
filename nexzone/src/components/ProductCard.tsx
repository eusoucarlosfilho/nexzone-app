import Link from 'next/link';
import type { Product } from '@/lib/types';

const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

export default function ProductCard({ p }: { p: Product }) {
  const preco = p.preco_promo ?? p.preco;
  return (
    <Link href={`/produto/${p.id}`} className="pc">
      <div className="top" style={{ background: 'var(--soft)' }}>
        {p.emoji}
        {p.vendas > 1000 && <span className="badge">🔥 HOT</span>}
      </div>
      <div className="body">
        <div className="vend">{p.stores?.nome ?? 'Loja'} ✓</div>
        <div className="tit">{p.titulo}</div>
        <div className="rt">★ {p.nota || '—'} · {p.vendas.toLocaleString('pt-BR')} vendas</div>
        <div className="ft">
          <div className="price">{money(preco)}{p.preco_promo && <small>{money(p.preco)}</small>}</div>
        </div>
      </div>
    </Link>
  );
}
