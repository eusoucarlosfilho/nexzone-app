'use client';
import { useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';

export default function SellerNotifier() {
  const sinceSale = useRef(new Date().toISOString());
  const sinceQ = useRef(new Date().toISOString());
  const sinceMsg = useRef(new Date().toISOString());

  useEffect(() => {
    const t = setInterval(async () => {
      // Novas vendas
      try {
        const r = await fetch(`/api/seller/recent-sales?since=${encodeURIComponent(sinceSale.current)}`, { credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          if (d.vendas?.length) {
            sinceSale.current = new Date().toISOString();
            for (const v of d.vendas) {
              toast(`🎉 Nova venda: ${v.titulo} +R$ ${Number(v.valor).toFixed(2).replace('.', ',')}`, 'success');
            }
          }
        }
      } catch {}

      // Novas perguntas
      try {
        const r = await fetch(`/api/seller/recent-questions?since=${encodeURIComponent(sinceQ.current)}`, { credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          if (d.perguntas?.length) {
            sinceQ.current = new Date().toISOString();
            for (const p of d.perguntas) {
              toast(`❓ Nova pergunta em "${p.titulo}". Responda no painel.`, 'success');
            }
          }
        }
      } catch {}

      // Novas mensagens do comprador no chat do pedido
      try {
        const r = await fetch(`/api/seller/recent-messages?since=${encodeURIComponent(sinceMsg.current)}`, { credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          if (d.mensagens?.length) {
            sinceMsg.current = new Date().toISOString();
            for (const m of d.mensagens) {
              toast(`💬 Mensagem do cliente em "${m.titulo}". Responda na conversa.`, 'success');
            }
          }
        }
      } catch {}
    }, 20000);
    return () => clearInterval(t);
  }, []);
  return null;
}
