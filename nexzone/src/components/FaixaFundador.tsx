// Faixa "Lojista Fundador" das páginas de recrutamento. Só números reais de vagas (vêm do banco).
export type DadosFundador = { restantes: number; total: number; dias: number; teto: number; destaqueDias: number };

export default function FaixaFundador({ d, cta = '/seja-vendedor#comecar' }: { d: DadosFundador | null; cta?: string | null }) {
  if (!d || d.restantes <= 0) return null;
  const teto = d.teto > 0 ? ` ou até R$ ${Math.round(d.teto).toLocaleString('pt-BR')} em vendas` : '';
  return (
    <section aria-label="Lojista Fundador" style={{ padding: '26px 18px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', borderRadius: 22, padding: '22px 22px', background: 'linear-gradient(135deg,#16162A,#2A1A3A)', color: '#fff', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">🏅</span>
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'inline-block', background: '#FF6B00', color: '#16162A', borderRadius: 50, padding: '4px 12px', fontWeight: 900, fontSize: 12.5, fontFamily: 'Outfit', marginBottom: 8 }}>Restam {d.restantes} de {d.total} vagas</div>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 24, lineHeight: 1.15, margin: '0 0 6px', color: '#fff' }}>Entre como Lojista Fundador</h2>
          <p style={{ margin: 0, opacity: 0.9, fontSize: 15, lineHeight: 1.5 }}>
            <b>0% de comissão</b> nos primeiros {d.dias} dias{teto}, selo de Fundador na sua loja para sempre{d.destaqueDias > 0 ? ` e ${d.destaqueDias} dias de destaque grátis no primeiro anúncio` : ''}. A vaga é garantida quando seu primeiro produto é aprovado.
          </p>
        </div>
        {cta && <a href={cta} style={{ background: '#FF6B00', color: '#16162A', fontFamily: 'Outfit', fontWeight: 900, borderRadius: 50, padding: '13px 22px', textDecoration: 'none', whiteSpace: 'nowrap' }}>Quero minha vaga</a>}
      </div>
    </section>
  );
}
