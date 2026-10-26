'use client';
import { useRouter } from 'next/navigation';
import { trackEvento } from '@/lib/rastreio-cliente';

// A compra continua igual: o botão leva ao checkout (/checkout/[id]), que exige login e valida tudo no servidor.
// O evento "compra_clique" é só um registro anônimo do clique e nunca bloqueia a navegação.
export default function BuyButton({ productId, categoria }: { productId: string; categoria?: string | null }) {
  const router = useRouter();
  return (
    <div style={{ width: '100%' }}>
      <button className="btn btn-pri btn-lg" style={{ width: '100%', fontSize: 17 }}
        onClick={() => {
          trackEvento('compra_clique', { tipo: 'nativo', ...(categoria ? { categoria } : {}) });
          router.push(`/checkout/${productId}`);
        }}>Comprar</button>
    </div>
  );
}
