'use client';
import { useState } from 'react';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const STATUS: Record<string, [string, string]> = {
  pago: ['act', 'Pago'], entregue: ['act', 'Entregue'], reembolsado: ['rej', 'Reembolsado'],
};

export default function VendasClient({ vendas }: any) {
  const [filtro, setFiltro] = useState('vendas');
  const [aberta, setAberta] = useState<string | null>(null);

  const lista = vendas.filter((v: any) => {
    if (filtro === 'vendas') return v.status === 'pago' || v.status === 'entregue';
    if (filtro === 'reembolsadas') return v.status === 'reembolsado';
    return true;
  });

  const concretizadas = vendas.filter((v: any) => v.status === 'pago' || v.status === 'entregue');
  const totalLiquido = concretizadas.reduce((s: number, v: any) => s + Number(v.valor_vendedor), 0);
  const totalBruto = concretizadas.reduce((s: number, v: any) => s + Number(v.total), 0);

  function exportarCSV() {
    const headers = ['Data', 'Produto', 'Cliente', 'Status', 'Valor Bruto', 'Taxa', 'Valor Liquido'];
    const linhas = lista.map((v: any) => [
      new Date(v.created_at).toLocaleString('pt-BR'),
      v.products?.titulo ?? 'Produto',
      v.comprador_email ?? '',
      (STATUS[v.status]?.[1] ?? v.status),
      money(v.total), money(v.taxa), money(v.valor_vendedor),
    ]);
    const csv = [headers, ...linhas]
      .map((r: string[]) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vendas-nexzone-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Vendas</h1>
          <p className="muted">Histórico completo das suas vendas.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportarCSV} disabled={!lista.length}>⬇ Exportar CSV</button>
      </div>

      <div className="sd-stats" style={{ marginTop: 18 }}>
        <div className="sd-stat"><div className="ic">🧾</div><b>{concretizadas.length}</b><small>Vendas concretizadas</small></div>
        <div className="sd-stat"><div className="ic">💰</div><b>{money(totalBruto)}</b><small>Faturamento bruto</small></div>
        <div className="sd-stat"><div className="ic">💚</div><b>{money(totalLiquido)}</b><small>Líquido (já com a taxa)</small></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['vendas', 'Vendas'], ['reembolsadas', 'Reembolsadas'], ['todas', 'Todas']].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className="btn btn-sm"
            style={filtro === k
              ? { background: 'var(--soft)', color: 'var(--orange)', border: '1px solid var(--orange)' }
              : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            {l}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {lista.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={th}>Data</th><th style={th}>Produto</th><th style={th}>Cliente</th>
                <th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Valor líquido</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v: any) => {
                const st = STATUS[v.status] || ['rev', v.status];
                const open = aberta === v.id;
                return (
                  <>
                    <tr key={v.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setAberta(open ? null : v.id)}>
                      <td style={td}>{new Date(v.created_at).toLocaleDateString('pt-BR')}</td>
                      <td style={td}><span style={{ marginRight: 6 }}>{v.products?.emoji ?? '📦'}</span>{v.products?.titulo ?? 'Produto'}</td>
                      <td style={{ ...td, color: 'var(--muted)' }}>{v.comprador_email ?? '—'}</td>
                      <td style={td}><span className={`pill ${st[0]}`}>{st[1]}</span></td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)' }}>{money(v.valor_vendedor)}</td>
                      <td style={{ ...td, color: 'var(--muted)', textAlign: 'center' }}>{open ? '▲' : '▼'}</td>
                    </tr>
                    {open && (
                      <tr style={{ background: 'var(--surface)' }}>
                        <td colSpan={6} style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13 }}>
                            <span className="muted">Pedido: <strong style={{ color: 'var(--text)' }}>#{String(v.id).slice(0, 8)}</strong></span>
                            <span className="muted">Bruto: <strong style={{ color: 'var(--text)' }}>{money(v.total)}</strong></span>
                            <span className="muted">Taxa plataforma (3%): <strong style={{ color: 'var(--text)' }}>{money(v.taxa)}</strong></span>
                            <span className="muted">Líquido p/ você: <strong style={{ color: 'var(--green)' }}>{money(v.valor_vendedor)}</strong></span>
                            <span className="muted">Data/hora: <strong style={{ color: 'var(--text)' }}>{new Date(v.created_at).toLocaleString('pt-BR')}</strong></span>
                            {v.comprador_email && <span className="muted">Cliente: <strong style={{ color: 'var(--text)' }}>{v.comprador_email}</strong></span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        ) : <div style={{ padding: 28 }} className="muted">Nenhuma venda nesse filtro ainda.</div>}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' };
const td: React.CSSProperties = { padding: '13px 16px' };
