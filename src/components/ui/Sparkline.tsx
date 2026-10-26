// Barras simples em SVG/CSS (sem biblioteca). Mostra rótulos espaçados para caber no celular.
export default function Sparkline({ pontos, rotulo }: { pontos: { rotulo: string; valor: number }[]; rotulo: string }) {
  const max = Math.max(1, ...pontos.map((p) => p.valor));
  const passo = Math.max(1, Math.ceil(pontos.length / 8));
  return (
    <figure className="ui-spark" aria-label={rotulo}>
      <div className="ui-spark-bars">
        {pontos.map((p, i) => (
          <div key={p.rotulo + i} className="ui-spark-col" title={`${p.rotulo}: ${p.valor}`}>
            <span className="ui-spark-b" style={{ height: `${(p.valor / max) * 100}%` }} />
            <span className="ui-spark-l" aria-hidden="true">{i % passo === 0 ? p.rotulo : ''}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{rotulo}: {pontos.map((p) => `${p.rotulo} ${p.valor}`).join(', ')}</figcaption>
    </figure>
  );
}
