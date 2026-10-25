import ProductCard from './ProductCard';
import PartnerOfferCard from './PartnerOfferCard';
import type { Product } from '@/lib/types';
import type { OfertaVitrine } from '@/lib/ofertas/tipos';
import type { ItemMix } from '@/lib/ofertas/mix';

// Grade única com produtos nativos e ofertas de parceiros já intercalados (ver lib/ofertas/mix.ts).
export default function GradeMista({ itens, className = 'pg' }: { itens: ItemMix<Product, OfertaVitrine>[]; className?: string }) {
  return (
    <div className={className}>
      {itens.map((x) => x.tipo === 'nativo'
        ? <ProductCard key={'n' + x.item.id} p={x.item} />
        : <PartnerOfferCard key={'o' + x.item.id} o={x.item} />)}
    </div>
  );
}
