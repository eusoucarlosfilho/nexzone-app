import Link from 'next/link';
import Icon from '@/components/Icon';

// Card de indicador. Só exibe o número recebido — quem chama é responsável por usar dados reais.
type Props = {
  label: string;
  value: string | number;
  icon?: string;
  hint?: string;
  href?: string;
};

export default function StatCard({ label, value, icon, hint, href }: Props) {
  const body = (
    <>
      {icon && <span className="ui-stat-ic" aria-hidden="true"><Icon name={icon} size={18} /></span>}
      <b>{value}</b>
      <small>{label}</small>
      {hint && <span className="ui-stat-hint">{hint}</span>}
    </>
  );
  if (href) return <Link href={href} className="ui-stat">{body}</Link>;
  return <div className="ui-stat">{body}</div>;
}
