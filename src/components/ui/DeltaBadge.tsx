// Variação em relação ao período anterior. null = base pequena demais para comparar.
export default function DeltaBadge({ valor, rotulo }: { valor: number | null; rotulo?: string }) {
  if (valor === null) return <span className="ui-delta neutro" title={rotulo ? `Comparação com ${rotulo}` : undefined}>sem base para comparar</span>;
  const tipo = valor > 0 ? 'sobe' : valor < 0 ? 'desce' : 'neutro';
  const seta = valor > 0 ? '▲' : valor < 0 ? '▼' : '•';
  return (
    <span className={`ui-delta ${tipo}`} title={rotulo ? `Comparação com ${rotulo}` : undefined}>
      <span aria-hidden="true">{seta}</span> {valor > 0 ? '+' : ''}{valor}%{rotulo ? <span className="sr-only"> em relação a {rotulo}</span> : null}
    </span>
  );
}
