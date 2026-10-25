'use client';
// Filtro de período em "pílulas" (rádio acessível).
export default function PeriodFilter<T extends string>({ valor, opcoes, onChange, rotulo = 'Período' }: {
  valor: T; opcoes: { valor: T; rotulo: string }[]; onChange: (v: T) => void; rotulo?: string;
}) {
  return (
    <div className="ui-period" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor}
          className={valor === o.valor ? 'on' : ''} onClick={() => onChange(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
