'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { trackEvento } from '@/lib/rastreio-cliente';

// Mede a vitrine OFERTAS DO DIA sem mexer nos cards: 1 "vista" quando a seção aparece na tela
// e 1 clique por produto (posição 1, 2, 3…). Os cards marcam data-oferta / data-pos.
export default function OfertasDoDiaVitrine({ itens, children }: { itens: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visto = false;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((ents) => {
      if (!visto && ents.some((e) => e.isIntersecting)) { visto = true; trackEvento('oferta_dia_vista', { itens }); io?.disconnect(); }
    }, { threshold: 0.35 }) : null;
    io?.observe(el);
    const clique = (ev: MouseEvent) => {
      const card = (ev.target as HTMLElement)?.closest?.('[data-oferta]') as HTMLElement | null;
      if (!card) return;
      trackEvento('oferta_dia_clique', { produto: card.dataset.oferta || '', posicao: Number(card.dataset.pos) || 0 });
    };
    el.addEventListener('click', clique, true);
    return () => { io?.disconnect(); el.removeEventListener('click', clique, true); };
  }, [itens]);
  return <div ref={ref}>{children}</div>;
}
