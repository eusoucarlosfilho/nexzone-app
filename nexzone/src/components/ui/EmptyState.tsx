import type { ReactNode } from 'react';
import Icon from '@/components/Icon';

// Estado vazio padronizado: ícone, título, explicação e (opcional) uma ação.
export default function EmptyState({ icon = 'package', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="ui-empty" role="status">
      <span className="ui-empty-ic" aria-hidden="true"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
