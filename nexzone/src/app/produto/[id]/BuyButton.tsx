'use client';
import { useRouter } from 'next/navigation';

// Botão de compra VERDE (mais visível que o laranja da marca). Esgotado: desabilitado, sem ir ao checkout.
export default function BuyButton({ productId, esgotado = false }: { productId: string; esgotado?: boolean }) {
  const router = useRouter();
  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .btn-comprar{background:#16A34A;color:#fff;box-shadow:0 10px 26px rgba(22,163,74,.32);border:none;}
        .btn-comprar:hover{background:#15803D;box-shadow:0 14px 32px rgba(22,163,74,.42);}
        .btn-comprar:focus-visible{outline:3px solid #86EFAC;outline-offset:2px;}
        .btn-comprar:disabled{background:#D1D5DB;color:#4B5563;box-shadow:none;cursor:not-allowed;}
      `}</style>
      <button type="button" className="btn btn-lg btn-comprar" style={{ width: '100%', fontSize: 17 }}
        disabled={esgotado} aria-disabled={esgotado}
        onClick={() => { if (!esgotado) router.push(`/checkout/${productId}`); }}>
        {esgotado ? 'Esgotado' : 'Comprar'}
      </button>
    </div>
  );
}
