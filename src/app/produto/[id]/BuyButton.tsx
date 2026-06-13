'use client';
import { useRouter } from 'next/navigation';

export default function BuyButton({ productId }: { productId: string }) {
  const router = useRouter();
  return (
    <div style={{ textAlign: 'right' }}>
      <button className="btn btn-pri btn-lg" onClick={() => router.push(`/checkout/${productId}`)}>⚡ Comprar agora</button>
    </div>
  );
}
