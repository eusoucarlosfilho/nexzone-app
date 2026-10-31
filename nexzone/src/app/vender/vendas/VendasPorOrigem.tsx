'use client';
import { useMemo, useState } from 'react';
import { rotuloOrigem, temOrigemMarketing, type OrigemVenda } from '@/lib/rastreioVenda';

// Vendas → Vendas por origem (Sprint 1): agrupa as vendas pagas por fonte / campanha / anúncio (UTM).
const money = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
type Venda = { total: number; status: string; origem: OrigemVenda | null };

export default function VendasPorOrigem({ vendas }: { vendas: Venda[] }) {
  const [nivel, setNivel] = useState<'fonte' | 'campanha' | 'conteudo'>('campanha');
  const linhas = useMemo(() => {
    const m = new Map<string, { chave: string; fonte: string; campanha: string; conteudo: string; vendas: number; valor: number }>();
    for (const v of vendas) {
      if (!['pago', 'entregue'].includes(v.status)) continue;
      const r = rotuloOrigem(v.origem);
      const chave = nivel === 'fonte' ? r.fonte : nivel === 'campanha' ? `${r.fonte}|${r.campanha}` : `${r.fonte}|${r.campanha}|${r.conteudo}`;
      const a = m.get(chave) || { chave, ...r, vendas: 0, valor: 0 };
      a.vendas++; a.valor += Number(v.total) || 0;
      m.set(chave, a);
    }
    return Array.from(m.values()).sort((a, b) => b.valor - a.valor);
  }, [vendas, nivel]);
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const comOrigem = vendas.some((v) => temOrigemMarketing(v.origem));

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 19, fontWeight: 900, margin: 0 }}>Vendas por origem</h2>
          <p className="muted" style={{ fontSize: 13, margin: '2px 0 0' }}>De qual fonte, campanha e anúncio vieram suas vendas pagas (UTM do link de checkout).</p>
        </div>
        <select value={nivel} onChange={(e) => setNivel(e.target.value as any)} aria-label="Agrupar por" style={{ height: 38, borderRadius: 10 }}>
          <option value="fonte">Por fonte</option>
          <option value="campanha">Por campanha</option>
          <option value="conteudo">Por anúncio</option>
        </select>
      </div>
      {!comOrigem && <p className="muted" style={{ fontSize: 13 }}>Ainda sem vendas com origem. Use o <b>link de checkout com UTM</b> em Produtos → Checkout e order bump → Tráfego pago.</p>}
      {linhas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--sub)', fontSize: 12 }}>
              <th style={{ padding: '6px 8px' }}>Fonte</th>
              {nivel !== 'fonte' && <th style={{ padding: '6px 8px' }}>Campanha</th>}
              {nivel === 'conteudo' && <th style={{ padding: '6px 8px' }}>Anúncio</th>}
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Vendas</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Faturamento</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>%</th>
            </tr></thead>
            <tbody>{linhas.map((l) => (
              <tr key={l.chave} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px' }}>{l.fonte}</td>
                {nivel !== 'fonte' && <td style={{ padding: '8px' }}>{l.campanha}</td>}
                {nivel === 'conteudo' && <td style={{ padding: '8px' }}>{l.conteudo}</td>}
                <td style={{ padding: '8px', textAlign: 'right' }}>{l.vendas}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>{money(l.valor)}</td>
                <td style={{ padding: '8px', textAlign: 'right' }} className="muted">{total ? Math.round((l.valor / total) * 100) : 0}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
