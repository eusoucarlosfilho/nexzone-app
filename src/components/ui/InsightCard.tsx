import Link from 'next/link';
import Icon from '@/components/Icon';

// Oportunidade explicável: título, o motivo (com os números e a regra usada) e uma ação opcional.
export default function InsightCard({ tipo, titulo, motivo, acao }: {
  tipo: 'atencao' | 'positivo' | 'info'; titulo: string; motivo: string; acao?: { rotulo: string; href: string };
}) {
  const icone = tipo === 'atencao' ? 'alert' : tipo === 'positivo' ? 'growth' : 'info';
  return (
    <div className={`ui-insight ${tipo}`}>
      <span className="ui-insight-ic" aria-hidden="true"><Icon name={icone} size={18} /></span>
      <div>
        <strong>{titulo}</strong>
        <p>{motivo}</p>
        {acao && <Link href={acao.href} className="btn btn-ghost btn-sm">{acao.rotulo}</Link>}
      </div>
    </div>
  );
}
