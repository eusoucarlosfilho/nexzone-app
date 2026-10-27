'use client';
import Icon from './Icon';

export default function BotaoImprimir({ rotulo = 'Imprimir', className = 'btn btn-pri btn-sm' }: { rotulo?: string; className?: string }) {
  return <button type="button" className={className} onClick={() => window.print()}><Icon name="printer" size={16} /> {rotulo}</button>;
}
