import FavButton from './FavButton';
import Icon from './Icon';
import { CategoryCover } from './CategoryIcon';
import LinkRastreado from './v3/LinkRastreado';
import type { Product } from '@/lib/types';
import { vendedorPublico } from '@/lib/vendedorPublico';
import { acharCategoria } from '@/lib/categorias';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export type OrigemCard = 'home' | 'busca' | 'categoria' | 'catalogo' | 'relacionados' | 'loja' | 'outro';

// Card de PRODUTO NATIVO (vendido e entregue pelo Comprei Barato).
// Nota e vendas só aparecem quando existem: nada de "—" ou "0 vendas" para preencher espaço.
export default function ProductCard({ p, origem }: { p: Product; origem?: OrigemCard }) {
  const preco = p.preco_promo ?? p.preco;
  const off = p.preco_promo && p.preco > p.preco_promo ? Math.round((1 - p.preco_promo / p.preco) * 100) : 0;
  const destaque = p.destaque_ate && new Date(p.destaque_ate) > new Date();
  const vend = vendedorPublico(p.stores);
  const cat = acharCategoria(p.categoria);
  const nota = Number(p.nota) || 0;
  const vendas = Number(p.vendas) || 0;
  return (
    <LinkRastreado href={`/produto/${p.id}`} className="pc"
      evento="produto_clique" origemAuto
      dados={{ tipo: 'nativo', ...(origem ? { origem } : {}), ...(cat ? { categoria: cat.slug } : {}) }}>
      <div className="top">
        {p.capa_url
          ? <span className="cov" style={{ backgroundImage: `url(${p.capa_url})` }} aria-hidden="true" />
          : <CategoryCover cat={p.categoria} />}
        {(p as any).plano === 'topo' ? <span className="badge topo"><Icon name="trophy" size={12} strokeWidth={2.6} />Topo</span> : destaque || (p as any).plano === 'destaque' ? <span className="badge"><Icon name="star" size={12} strokeWidth={2.6} />Destaque</span> : vendas > 1000 && <span className="badge">Mais vendido</span>}
        {off > 0 && <span className="badge off">-{off}%</span>}
        <FavButton productId={p.id} overlay />
      </div>
      <div className="body">
        <div className="vend">
          <span className="vend-n">{vend.nome}</span>
          {(vend.oficial || vend.verificada) && (
            <svg width="14" height="14" viewBox="0 0 24 24" role="img" aria-label={vend.oficial ? 'Loja oficial' : 'Loja verificada'} style={{ flex: 'none' }}><path fill="#1D7AE0" d="M12 2l2.4 2.2 3.2-.4.9 3.1 2.9 1.5-1 3.1 1 3.1-2.9 1.5-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1-2.9-1.5 1-3.1-1-3.1 2.9-1.5.9-3.1 3.2.4z" /><path d="M8.5 12l2.4 2.4 4.6-4.8" stroke="#fff" strokeWidth="2" fill="none" /></svg>
          )}
        </div>
        <div className="tit">{p.titulo}</div>
        {/* Números reais; o que for zero não aparece ("0 vendas" afasta o comprador) */}
        {Number(p.nota) > 0 || Number(p.vendas) > 0 ? (
          <div className="rt">
            {Number(p.nota) > 0 && <><svg width="14" height="14" viewBox="0 0 24 24" fill="#FF9A3C" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>{Number(p.nota).toFixed(1).replace('.', ',')}</>}
            {Number(p.nota) > 0 && Number(p.vendas) > 0 && ' · '}
            {Number(p.vendas) > 0 && `${Number(p.vendas).toLocaleString('pt-BR')} venda${Number(p.vendas) === 1 ? '' : 's'}`}
          </div>
        ) : <div className="rt" style={{ color: 'var(--green)', fontWeight: 800 }}>Novo</div>}
        <div className="ft">
          <div className="price">{money(preco)}{off > 0 && <small><span className="sr-only">De </span>{money(p.preco)}</small>}</div>
        </div>
      </div>
    </LinkRastreado>
  );
}
