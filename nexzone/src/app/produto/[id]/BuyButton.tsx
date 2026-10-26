'use client';
import { useRouter } from 'next/navigation';
import { trackEvento } from '@/lib/rastreio-cliente';

// Botão de compra VERDE (mais visível que o laranja da marca). Esgotado: desabilitado, sem ir ao checkout.
// V3: o evento "compra_clique" é só um registro anônimo do clique e nunca bloqueia a navegação.
export default function BuyButton({ productId, esgotado = false, categoria }: { productId: string; esgotado?: boolean; categoria?: string | null }) {
  const router = useRouter();
  return (
    <div style={{ width: '100%' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .btn-comprar{background:#16A34A;color:#fff;box-shadow:0 10px 26px rgba(22,163,74,.32);border:none;}
        .btn-comprar:hover{background:#15803D;box-shadow:0 14px 32px rgba(22,163,74,.42);}
        .btn-comprar:focus-visible{outline:3px solid #86EFAC;outline-offset:2px;}
        .btn-comprar:disabled{background:#D1D5DB;color:#4B5563;box-shadow:none;cursor:not-allowed;}
      ` }} />
      <button type="button" className="btn btn-lg btn-comprar" style={{ width: '100%', fontSize: 17 }}
        disabled={esgotado} aria-disabled={esgotado}
        onClick={() => { if (esgotado) return; trackEvento('compra_clique', { tipo: 'nativo', ...(categoria ? { categoria } : {}) }); router.push(`/checkout/${productId}`); }}>
        {esgotado ? 'Esgotado' : 'Comprar'}
      </button>
    </div>
  );
}
