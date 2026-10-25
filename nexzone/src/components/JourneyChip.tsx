import Link from 'next/link';
import JourneyBadge from './JourneyBadge';
import { brl } from '@/lib/journey';

// Resumo compacto da Jornada do Vendedor, para o topo do painel.
// Só exibe o resultado de computeJourney (lib/journey.ts): não calcula nem altera níveis.
type Tier = { id: string; nome: string } | null;

export default function JourneyChip({ atual, proximo, progresso, falta }: {
  atual: Tier; proximo: Tier; progresso: number; falta: number;
}) {
  const nivel = atual?.nome ?? 'Sem selo ainda';
  const pct = Math.round(Math.max(0, Math.min(1, progresso)) * 100);
  const temBarra = !!proximo && proximo.id !== 'estreia';
  const dica = !proximo
    ? 'Todos os selos conquistados'
    : proximo.id === 'estreia'
      ? 'Primeira venda: selo Estreia'
      : `Faltam ${brl(falta)} para ${proximo.nome}`;

  return (
    <Link href="/vender/jornada" className="jchip" aria-label={`Minha jornada: ${nivel}. ${dica}. Ver minha jornada`}>
      <JourneyBadge tierId={atual?.id ?? 'estreia'} size={34} locked={!atual} />
      <span className="jchip-tx">
        <span className="jchip-l1"><b>Minha jornada</b> · {nivel}</span>
        {temBarra && (
          <span className="jchip-bar" aria-hidden="true"><span style={{ width: `${Math.max(3, pct)}%` }} /></span>
        )}
        <span className="jchip-l2">{dica}</span>
      </span>
      <span className="jchip-cta" aria-hidden="true">Ver detalhes ›</span>
    </Link>
  );
}
