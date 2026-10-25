import Link from 'next/link';
import Icon from './Icon';
import { CategoryCover } from './CategoryIcon';
import { acharCategoria } from '@/lib/categorias';
import { ROTULO_PLATAFORMA, formatarPreco, type OfertaVitrine } from '@/lib/ofertas/tipos';

// url("...") com aspas, barras e parênteses escapados (a URL já foi validada como https no cadastro)
export const cssUrl = (u: string) => `url("${u.replace(/["\\()\s]/g, (c) => encodeURIComponent(c))}")`;

// Card de OFERTA DE PARCEIRO: mesmo visual do card de produto nativo, com selo e plataforma.
// Leva à página da oferta (/oferta/<slug>), que explica que a compra acontece fora do Comprei Barato.
export default function PartnerOfferCard({ o }: { o: OfertaVitrine }) {
  const preco = formatarPreco(o.price_reference, o.currency);
  const cat = acharCategoria(o.category);
  return (
    <Link href={`/oferta/${o.slug}`} className="pc pc-parceiro">
      <div className="top">
        {o.image_url
          ? <span className="cov" style={{ backgroundImage: cssUrl(o.image_url) }} aria-hidden="true" />
          : <CategoryCover cat={cat?.slug || o.category} />}
        <span className="badge badge-parceiro"><Icon name="link" size={12} strokeWidth={2.6} />Oferta de parceiro</span>
      </div>
      <div className="body">
        <div className="vend">{o.producer_name || ROTULO_PLATAFORMA[o.external_platform] || 'Parceiro'}</div>
        <div className="tit">{o.title}</div>
        <div className="rt pc-plat">Vendido em {ROTULO_PLATAFORMA[o.external_platform] || 'site parceiro'}</div>
        <div className="ft">
          <div className="price">{preco ? <>{preco}<small className="pc-ref">referência</small></> : <span className="pc-semp">Ver preço no parceiro</span>}</div>
        </div>
      </div>
    </Link>
  );
}
