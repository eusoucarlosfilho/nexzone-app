'use client';
import { useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';

export default function SellerNotifier() {
  const since = useRef(new Date().toISOString());
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/seller/recent-sales?since=${encodeURIComponent(since.current)}`, { credentials: 'include' });
        if (!r.ok) return;
        const d = await r.json();
        if (d.vendas?.length) {
          since.current = new Date().toISOString();
          for (const v of d.vendas) {
            toast(`🎉 Nova venda: ${v.titulo} +R$ ${Number(v.valor).toFixed(2).replace('.', ',')}`, 'success');
          }
        }
      } catch {}
    }, 20000);
    return () => clearInterval(t);
  }, []);
  return null;
}
