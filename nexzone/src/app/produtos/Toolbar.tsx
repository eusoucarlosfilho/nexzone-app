'use client';
// Barra do catálogo: total de resultados, ordenação e (no celular) o botão que abre os filtros.
// A busca por texto fica no campo do topo do site (NavSearch), para não haver dois campos de busca na tela.
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { ORDENS, type Ordem } from './busca';
import { EVENTO_ABRIR_FILTROS } from './Filters';

export default function Toolbar({ total, ordem, nFiltros = 0 }: { total: number; ordem: Ordem; nFiltros?: number }) {
  const router = useRouter(); const sp = useSearchParams(); const pathname = usePathname();

  function ordenar(v: string) {
    const p = new URLSearchParams(sp.toString());
    if (v && v !== 'relevancia') p.set('sort', v); else p.delete('sort');
    p.delete('page'); // ordem nova recomeça da primeira página
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  return (
    <div className="v3-bar">
      <span className="v3-bar-n" role="status">{total.toLocaleString('pt-BR')} {total === 1 ? 'resultado' : 'resultados'}</span>
      <div className="v3-bar-acoes">
        <button type="button" className="btn btn-ghost btn-sm v3-bar-flt" aria-controls="flt-painel"
          onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_FILTROS))}>
          <Icon name="settings" size={16} />Filtros{nFiltros > 0 && <span className="v3-bar-badge" aria-label={`${nFiltros} ativo${nFiltros === 1 ? '' : 's'}`}>{nFiltros}</span>}
        </button>
        <label className="v3-ordem">
          <span className="sr-only">Ordenar por</span>
          <select value={ordem} onChange={(e) => ordenar(e.target.value)} aria-label="Ordenar por">
            {ORDENS.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
