// Funil horizontal. Cada etapa mostra o valor e a % em relação à primeira etapa.
export default function Funnel({ etapas, rodape }: { etapas: { etapa: string; valor: number }[]; rodape?: string }) {
  const base = etapas[0]?.valor || 0;
  return (
    <div className="ui-funnel">
      <ol>
        {etapas.map((e, i) => {
          const pct = base > 0 ? Math.round((e.valor / base) * 100) : 0;
          return (
            <li key={e.etapa}>
              <div className="ui-funnel-top"><span>{e.etapa}</span><b>{e.valor}</b></div>
              <div className="ui-funnel-bar" aria-hidden="true"><span style={{ width: `${base > 0 ? Math.max(pct, e.valor > 0 ? 3 : 0) : 0}%` }} /></div>
              {i > 0 && <small>{base > 0 ? `${pct}% da primeira etapa` : '—'}</small>}
            </li>
          );
        })}
      </ol>
      {rodape && <p className="ui-funnel-foot">{rodape}</p>}
    </div>
  );
}
