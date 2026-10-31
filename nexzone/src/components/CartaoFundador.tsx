import { brlCurto, type SituacaoFundador } from '@/lib/campanhas';

// Painel do vendedor: situação de Lojista Fundador (comissão reduzida, selo, prazo e teto). Sem estado: servidor.
export default function CartaoFundador({ f, vagas }: { f: SituacaoFundador; vagas: { restantes: number; total: number } | null }) {
  const dataBR = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
  const caixa: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'flex-start', borderRadius: 18, padding: '16px 18px', marginBottom: 18, background: 'linear-gradient(135deg,#FFF6E8,#FFE9D6)', border: '1px solid #FFD2A6' };
  if (!f.fundador) {
    if (!vagas || vagas.restantes <= 0) return null;
    return (
      <div style={caixa} role="note">
        <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">🏅</span>
        <div>
          <b style={{ fontFamily: 'Outfit', fontSize: 16 }}>{vagas.restantes <= 10 ? "Últimas vagas de Lojista Fundador" : "Vagas limitadas de Lojista Fundador"}</b>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>Publique seu primeiro produto: quando ele for aprovado você garante a vaga, com comissão reduzida no começo, selo de Fundador para sempre e destaque grátis no anúncio.</p>
        </div>
      </div>
    );
  }
  return (
    <div style={caixa} role="note">
      <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">🏅</span>
      <div style={{ flex: 1 }}>
        <b style={{ fontFamily: 'Outfit', fontSize: 16 }}>Você é Lojista Fundador #{f.numero}</b>
        {f.ativo ? (
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            <b style={{ color: 'var(--green)' }}>{String(f.pct ?? 3).replace('.', ',')}% de comissão</b> até {dataBR(f.ate)}{f.restante >= 0 ? ` ou até completar ${brlCurto(f.vendido + f.restante)} em vendas (faltam ${brlCurto(f.restante)})` : ''}. Depois, volta para a taxa do seu plano.
          </p>
        ) : (
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            O período de comissão reduzida terminou{f.motivoFim === 'teto' ? ` ao completar ${brlCurto(f.vendido)} em vendas` : f.motivoFim === 'prazo' ? ` em ${dataBR(f.ate)}` : ''}. O selo de Fundador continua na sua loja para sempre.
          </p>
        )}
      </div>
    </div>
  );
}
