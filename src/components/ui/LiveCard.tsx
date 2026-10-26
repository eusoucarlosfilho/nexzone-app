// Cartão "ao vivo". Só exibe o que recebe; quem chama controla a atualização.
export default function LiveCard({ ativos, janelaMin, detalhe, carregando, erro }: {
  ativos: number | null; janelaMin: number; detalhe?: string; carregando?: boolean; erro?: boolean;
}) {
  return (
    <div className="ui-live" aria-live="polite">
      <span className={`ui-live-dot ${ativos ? 'on' : ''}`} aria-hidden="true" />
      <div>
        <b>{erro ? '—' : ativos === null || carregando ? '…' : ativos}</b>
        <small>{erro ? 'Ao vivo indisponível agora' : `ativos nos últimos ${janelaMin} min`}</small>
        {detalhe && !erro && <span className="ui-live-det">{detalhe}</span>}
      </div>
    </div>
  );
}
