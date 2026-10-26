import ProductCard, { type OrigemCard } from './ProductCard';
import PartnerOfferCard from './PartnerOfferCard';
import type { Product } from '@/lib/types';
import type { OfertaVitrine } from '@/lib/ofertas/tipos';
import type { ItemMix } from '@/lib/ofertas/mix';

// Grade única com produtos nativos e ofertas de parceiros já intercalados (ver lib/ofertas/mix.ts).
// `origem` vai para o evento de clique; sem ela, o card deduz pela página atual.
export default function GradeMista({ itens, className = 'pg', mostrarOrigem = false, origem }: { itens: ItemMix<Product, OfertaVitrine>[]; className?: string; mostrarOrigem?: boolean; origem?: OrigemCard }) {
  return (
    <div className={className}>
      {itens.map((x) => x.tipo === 'nativo'
        ? <ProductCard key={'n' + x.item.id} p={x.item} origem={origem} />
        : <PartnerOfferCard key={'o' + x.item.id} o={x.item} mostrarOrigem={mostrarOrigem} origem={origem} />)}
    </div>
  );
}
