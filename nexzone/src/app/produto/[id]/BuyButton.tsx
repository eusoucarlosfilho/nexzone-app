'use client';
import { useRouter } from 'next/navigation';

export default function BuyButton({ productId }: { productId: string }) {
  const router = useRouter();
  return (
    <div style={{ width: '100%' }}>
      <button className="btn btn-pri btn-lg" style={{ width: '100%', fontSize: 17 }} onClick={() => router.push(`/checkout/${productId}`)}>Comprar</button>
    </div>
  );
}
