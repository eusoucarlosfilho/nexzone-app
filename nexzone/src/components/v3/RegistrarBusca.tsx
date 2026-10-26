'use client';
// Registra o evento "busca" uma vez por resultado exibido (termo + total de resultados).
// O termo é limpo e encurtado no envio (lib/eventos.ts); se parecer dado pessoal, é descartado.
import { useEffect } from 'react';
import { trackEvento } from '@/lib/rastreio-cliente';

export default function RegistrarBusca({ termo, resultados, categoria }: { termo: string; resultados: number; categoria?: string | null }) {
  useEffect(() => {
    const t = (termo || '').trim();
    if (!t) return;
    trackEvento('busca', { termo: t, resultados: Math.max(0, Math.floor(resultados || 0)), ...(categoria ? { categoria } : {}) });
  }, [termo, resultados, categoria]);
  return null;
}
