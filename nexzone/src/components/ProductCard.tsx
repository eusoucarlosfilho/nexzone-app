import Link from 'next/link';
import FavButton from './FavButton';
import Icon from './Icon';
import { CategoryCover } from './CategoryIcon';
import type { Product } from '@/lib/types';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function ProductCard({ p }: { p: Product }) {
  const preco = p.preco_promo ?? p.preco;
  const off = p.preco_promo && p.preco > p.preco_promo ? Math.round((1 - p.preco_promo / p.preco) * 100) : 0;
  const destaque = p.destaque_ate && new Date(p.destaque_ate) > new Date();
  return (
    <Link href={`/produto/${p.id}`} className="pc">
      <div className="top">
        {p.capa_url
          ? <span className="cov" style={{ backgroundImage: `url(${p.capa_url})` }} aria-hidden="true" />
          : <CategoryCover cat={p.categoria} />}
        {destaque ? <span className="badge"><Icon name="star" size={12} strokeWidth={2.6} />Destaque</span> : p.vendas > 1000 && <span className="badge">Mais vendido</span>}
        {off > 0 && <span className="badge off">-{off}%</span>}
        <FavButton productId={p.id} overlay />
      </div>
      <div className="body">
        <div className="vend">
          {p.stores?.nome ?? 'Loja'}
          <svg width="14" height="14" viewBox="0 0 24 24" role="img" aria-label="Loja verificada"><path fill="#1D7AE0" d="M12 2l2.4 2.2 3.2-.4.9 3.1 2.9 1.5-1 3.1 1 3.1-2.9 1.5-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1-2.9-1.5 1-3.1-1-3.1 2.9-1.5.9-3.1 3.2.4z" /><path d="M8.5 12l2.4 2.4 4.6-4.8" stroke="#fff" strokeWidth="2" fill="none" /></svg>
        </div>
        <div className="tit">{p.titulo}</div>
        <div className="rt">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF9A3C" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
          {p.nota || '—'} · {p.vendas.toLocaleString('pt-BR')} vendas
        </div>
        <div className="ft">
          <div className="price">{money(preco)}{p.preco_promo && <small>{money(p.preco)}</small>}</div>
        </div>
      </div>
    </Link>
  );
}
