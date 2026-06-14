'use client';
import { useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';

export default function BuyerNotifier() {
  const since = useRef(new Date().toISOString());
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/my-questions/answered?since=${encodeURIComponent(since.current)}`, { credentials: 'include' });
        if (!r.ok) return;
        const d = await r.json();
        if (d.respostas?.length) {
          since.current = new Date().toISOString();
          for (const x of d.respostas) {
            toast(`✅ Sua pergunta sobre "${x.titulo}" foi respondida!`, 'success');
          }
        }
      } catch {}
    }, 25000);
    return () => clearInterval(t);
  }, []);
  return null;
}
