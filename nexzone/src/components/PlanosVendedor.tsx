import { PLANOS, brl, pctTexto, type ConfigTaxas } from '@/lib/taxas';

// Tabela pública dos planos do vendedor + taxa de serviço do comprador + prazos de liberação.
// Os números vêm de settings (Admin › Configurações › Planos e taxas). Sem promessa que o site não cumpre.
export default function PlanosVendedor({ cfg, escuro = false }: { cfg: ConfigTaxas; escuro?: boolean }) {
  const pct = { basico: cfg.planoBasico, destaque: cfg.planoDestaque, topo: cfg.planoTopo } as const;
  const venda = 100;
  return (
    <div className={`pv ${escuro ? 'pv-escuro' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .pv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
        .pv-card{position:relative;background:#fff;border:1.5px solid var(--border);border-radius:20px;padding:24px 22px;box-shadow:var(--sh);color:var(--text)}
        .pv-card.pv-top{border-color:#FF6B00;box-shadow:0 10px 30px rgba(255,107,0,.18)}
        .pv-card h3{font-family:'Outfit';font-weight:900;font-size:19px;margin:0 0 4px}
        .pv-card .pv-pct{font-family:'Outfit';font-weight:900;font-size:40px;letter-spacing:-1.5px;line-height:1;margin:10px 0 2px}
        .pv-card .pv-pct small{font-size:14px;font-weight:700;letter-spacing:0;color:var(--sub)}
        .pv-card .pv-ex{font-size:13px;color:var(--sub);margin-bottom:12px}
        .pv-card ul{list-style:none;padding:0;margin:0;display:grid;gap:7px}
        .pv-card li{font-size:14px;line-height:1.45;padding-left:22px;position:relative}
        .pv-card li:before{content:'✓';position:absolute;left:0;color:#0E9F6E;font-weight:900}
        .pv-tag{position:absolute;top:-11px;right:18px;background:#16162A;color:#fff;font-size:11.5px;font-weight:800;border-radius:30px;padding:4px 10px;font-family:'Outfit'}
        .pv-tag.laranja{background:linear-gradient(135deg,#FF6B00,#FFB067);color:#16162A}
        .pv-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:18px}
        .pv-box{background:var(--soft,#F6F6FA);border-radius:16px;padding:18px 20px;color:var(--text)}
        .pv-box h4{font-family:'Outfit';font-weight:800;font-size:15px;margin:0 0 8px}
        .pv-box p{font-size:13.5px;line-height:1.6;color:var(--sub);margin:0}
        .pv-box b{color:var(--text)}
        .pv-escuro .pv-box{background:rgba(255,255,255,.06);color:#fff}
        .pv-escuro .pv-box h4,.pv-escuro .pv-box b{color:#fff}
        .pv-escuro .pv-box p{color:rgba(255,255,255,.78)}
      ` }} />
      <div className="pv-grid">
        {PLANOS.map((p) => {
          const emBreve = p.id !== 'basico' && !cfg.planosPagosAtivos;
          return (
            <div key={p.id} className={`pv-card ${p.id === 'topo' ? 'pv-top' : ''}`}>
              {p.id === 'basico' && <span className="pv-tag">Todo anúncio começa aqui</span>}
              {p.id === 'topo' && <span className="pv-tag laranja">{emBreve ? 'Em breve' : `${cfg.topoVagas} vagas por categoria`}</span>}
              {p.id === 'destaque' && emBreve && <span className="pv-tag">Em breve</span>}
              <h3>{p.nome}</h3>
              <div style={{ fontSize: 13.5, color: 'var(--sub)' }}>{p.resumo}</div>
              <div className="pv-pct">{pctTexto(pct[p.id])} <small>por venda</small></div>
              <div className="pv-ex">Venda de {brl(venda)} → você recebe {brl(venda - venda * pct[p.id] / 100)}</div>
              <ul>{p.beneficios.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          );
        })}
      </div>
      <div className="pv-info">
        <div className="pv-box">
          <h4>Taxa de serviço do comprador</h4>
          <p>Quem compra paga <b>{brl(cfg.compradorPix)} no Pix</b> ou <b>{pctTexto(cfg.compradorCartaoPct)} + {brl(cfg.compradorCartaoFixo)} no cartão</b>, mostrado antes de pagar. Ela cobre o meio de pagamento e não sai do seu valor.</p>
        </div>
        <div className="pv-box">
          <h4>Quando o dinheiro libera</h4>
          <p><b>Contas de jogo: {cfg.liberaContaDias} dias</b>. Itens, moedas, gift cards, serviços e produtos digitais: <b>{cfg.liberaPadraoDias} dias</b>. Vendas no cartão: <b>{cfg.liberaCartaoDias} dias</b>. Contado a partir da entrega, se não houver reclamação.</p>
        </div>
        <div className="pv-box">
          <h4>Saque no Pix</h4>
          <p><b>1 saque grátis por semana</b>. Os extras na mesma semana custam {brl(cfg.saqueExtraTaxa)}. Sem mensalidade e sem fidelidade.</p>
        </div>
      </div>
    </div>
  );
}
