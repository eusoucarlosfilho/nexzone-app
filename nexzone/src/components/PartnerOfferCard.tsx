import Link from 'next/link';
import Icon from './Icon';
import { CategoryCover } from './CategoryIcon';
import { acharCategoria } from '@/lib/categorias';
import { ROTULO_PLATAFORMA, descontoPct, formatarPreco, type OfertaVitrine } from '@/lib/ofertas/tipos';

// Card de PRODUTO EXTERNO no layout da loja (mesmas classes do card nativo).
// Com "mostrar origem" DESLIGADO (padrão): sem selo, sem plataforma e sem produtor.
// Sem avaliação e sem número de vendas: esses dados não são nossos e não são inventados.
export default function PartnerOfferCard({ o, mostrarOrigem = false }: { o: OfertaVitrine; mostrarOrigem?: boolean }) {
  const preco = formatarPreco(o.price_reference, o.currency);
  const de = formatarPreco(o.price_from, o.currency);
  const off = descontoPct(o.price_reference, o.price_from);
  const cat = acharCategoria(o.category);
  return (
    <Link href={`/oferta/${o.slug}`} className="pc pc-externo">
      <div className="top">
        {o.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="cov" src={o.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <CategoryCover cat={cat?.slug || o.category} />}
        {mostrarOrigem
          ? <span className="badge badge-parceiro"><Icon name="link" size={12} strokeWidth={2.6} />Oferta de parceiro</span>
          : o.featured && <span className="badge"><Icon name="star" size={12} strokeWidth={2.6} />Destaque</span>}
        {off > 0 && <span className="badge off">-{off}%</span>}
      </div>
      <div className="body">
        <div className="vend">{mostrarOrigem ? (o.producer_name || ROTULO_PLATAFORMA[o.external_platform] || 'Parceiro') : (cat?.nome || o.category)}</div>
        <div className="tit">{o.title}</div>
        {mostrarOrigem && <div className="rt pc-plat">Vendido em {ROTULO_PLATAFORMA[o.external_platform] || 'site parceiro'}</div>}
        <div className="ft">
          <div className="price">{preco ? <>{preco}{de && off > 0 && <small>{de}</small>}</> : <span className="pc-semp">Ver preço</span>}</div>
        </div>
      </div>
    </Link>
  );
}
