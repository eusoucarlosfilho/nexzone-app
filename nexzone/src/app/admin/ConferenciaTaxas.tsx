'use client';
import { useState } from 'react';
import { ROTULO_ALERTA, type Alerta } from '@/lib/financeiro';

// Admin › Financeiro › Conferência das taxas: confere cada pedido pago (divisão vendedor × plataforma,
// % do plano, taxa do comprador e se sobrou dinheiro depois da MisticPay/Stripe). Só leitura.
type Linha = { id: string; data: string; titulo: string | null; loja: string | null; forma: string | null; total: number; pct: number | null; taxa: number; vendedor: number; taxaComprador: number; gateway: number; liquido: number; alertas: Alerta[]; grave: boolean };
type Resp = { pedidos: number; graves: number; porAlerta: Record<string, number>; totais: { faturamento: number; vendedores: number; comissao: number; taxaComprador: number; gateway: number; liquido: number }; linhas: Linha[] };

const brl = (v: number) => (v < 0 ? '−' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ConferenciaTaxas() {
  const [d, setD] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [so, setSo] = useState<'alertas' | 'todos'>('alertas');

  async function conferir() {
    setBusy(true); setErro('');
    try {
      const r = await fetch('/api/admin/financeiro?auditoria=1', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setD(j);
    } catch (e: any) { setErro(e?.message || 'Falha ao conferir.'); }
    setBusy(false);
  }

  const linhas = d ? (so === 'alertas' ? d.linhas.filter((l) => l.alertas.some((a) => a !== 'sem_taxa_comprador' && a !== 'modelo_antigo') ) : d.linhas) : [];
  return (
    <div className="adm-card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 className="adm-ct" style={{ margin: 0 }}>Conferência das taxas, pedido a pedido</h3>
          <small style={{ color: 'var(--sub)' }}>Confere em cada venda paga: taxa + vendedor = total, % do plano, taxa do comprador e o que sobrou depois da MisticPay/Stripe.</small>
        </div>
        <button type="button" className="adm-btn ap" disabled={busy} onClick={conferir}>{busy ? 'Conferindo…' : d ? 'Conferir de novo' : 'Conferir agora'}</button>
      </div>
      {erro && <p style={{ color: '#C81E1E', marginTop: 10 }}>{erro}</p>}
      {d && (
        <>
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: d.graves ? '#FDECEC' : '#E3F6EE', fontWeight: 700 }}>
            {d.graves ? `⚠ ${d.graves} de ${d.pedidos} pedidos com erro grave — veja abaixo.` : `✓ ${d.pedidos} pedidos pagos conferidos: nenhuma divisão errada, nenhuma cobrança acima do plano, nenhum prejuízo.`}
          </div>
          <table className="adm-table" style={{ marginTop: 12 }}><tbody>
            <tr><td>Faturamento (preço dos produtos)</td><td>{brl(d.totais.faturamento)}</td></tr>
            <tr><td>Parte dos vendedores</td><td>{brl(d.totais.vendedores)}</td></tr>
            <tr><td>Comissão dos planos</td><td>{brl(d.totais.comissao)}</td></tr>
            <tr><td>Taxa de serviço paga pelos compradores</td><td>{brl(d.totais.taxaComprador)}</td></tr>
            <tr><td>Tarifas MisticPay/Stripe (estimadas)</td><td>− {brl(d.totais.gateway)}</td></tr>
            <tr><td><b>O que sobrou para a plataforma</b></td><td><b style={{ color: d.totais.liquido < 0 ? '#C81E1E' : '#0E9F6E' }}>{brl(d.totais.liquido)}</b></td></tr>
          </tbody></table>
          {Object.keys(d.porAlerta).length > 0 && (
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
              {Object.entries(d.porAlerta).map(([a, n]) => <li key={a}><b>{n}</b> · {ROTULO_ALERTA[a as Alerta] || a}</li>)}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 8, margin: '14px 0 8px' }}>
            <button type="button" className={`adm-fb ${so === 'alertas' ? 'on' : ''}`} onClick={() => setSo('alertas')}>Só os que precisam de atenção</button>
            <button type="button" className={`adm-fb ${so === 'todos' ? 'on' : ''}`} onClick={() => setSo('todos')}>Todos ({d.pedidos})</button>
          </div>
          {linhas.length === 0 ? <p style={{ color: 'var(--sub)' }}>Nada para olhar aqui.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="adm-table" style={{ fontSize: 13 }}>
                <thead><tr><th>Data</th><th>Produto / loja</th><th>Forma</th><th>Total</th><th>% plano</th><th>Plataforma</th><th>Vendedor</th><th>Taxa comprador</th><th>Gateway</th><th>Sobrou</th><th>Alertas</th></tr></thead>
                <tbody>
                  {linhas.slice(0, 300).map((l) => (
                    <tr key={l.id} style={l.grave ? { background: '#FFF5F5' } : undefined}>
                      <td>{new Date(l.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}<br /><small style={{ color: 'var(--sub)' }}>#{l.id.slice(0, 8)}</small></td>
                      <td>{l.titulo || 'Produto'}<br /><small style={{ color: 'var(--sub)' }}>{l.loja || ''}</small></td>
                      <td>{l.forma === 'cartao' ? 'Cartão' : l.forma === 'pix' ? 'Pix' : '—'}</td>
                      <td>{brl(l.total)}</td>
                      <td>{l.pct === null ? '—' : `${String(l.pct).replace('.', ',')}%`}</td>
                      <td>{brl(l.taxa)}</td>
                      <td>{brl(l.vendedor)}</td>
                      <td>{brl(l.taxaComprador)}</td>
                      <td>− {brl(l.gateway)}</td>
                      <td><b style={{ color: l.liquido < 0 ? '#C81E1E' : undefined }}>{brl(l.liquido)}</b></td>
                      <td style={{ fontSize: 12 }}>{l.alertas.map((a) => ROTULO_ALERTA[a]).join(' · ') || '✓'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
