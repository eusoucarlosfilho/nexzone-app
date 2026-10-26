'use client';
// Link com evento de funil anônimo no clique (V3 · experiência do comprador).
// Serve para componentes de servidor (cards, rodapé, faixas) registrarem cliques sem importar
// o rastreio no servidor. O clique nunca é bloqueado: o evento sai por sendBeacon e nunca lança.
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { trackEvento } from '@/lib/rastreio-cliente';
import type { NomeEvento, PropsEvento } from '@/lib/eventos';

type Origem = 'home' | 'busca' | 'categoria' | 'catalogo' | 'relacionados' | 'loja' | 'outro';

/** De onde veio o clique, pela página atual (usado quando o card não recebe a origem). */
export function origemDaPagina(): Origem {
  try {
    const p = window.location.pathname || '/';
    const sp = new URLSearchParams(window.location.search || '');
    if (p === '/') return 'home';
    if (p.startsWith('/busca')) return 'busca';
    if (p === '/produtos') return sp.get('q') ? 'busca' : sp.get('cat') ? 'categoria' : 'catalogo';
    if (p.startsWith('/categoria/')) return sp.get('q') ? 'busca' : 'categoria';
    if (p.startsWith('/loja/')) return 'loja';
    if (p.startsWith('/produto/') || p.startsWith('/oferta/')) return 'relacionados';
  } catch {}
  return 'outro';
}

type Props = Omit<ComponentProps<typeof Link>, 'onClick'> & {
  evento: NomeEvento;
  dados?: PropsEvento;
  /** Preenche `origem` pela página atual quando `dados.origem` não vier. */
  origemAuto?: boolean;
};

export default function LinkRastreado({ evento, dados, origemAuto, ...rest }: Props) {
  return (
    <Link
      {...rest}
      onClick={() => {
        const d: PropsEvento = { ...(dados || {}) };
        if (origemAuto && !d.origem) d.origem = origemDaPagina();
        trackEvento(evento, d);
      }}
    />
  );
}
