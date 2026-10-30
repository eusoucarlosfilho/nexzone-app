'use client';
import { Fragment, useMemo, useState } from 'react';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { mensagemRecuperacao, linkWhatsapp, haQuanto, foneLegivel } from '@/lib/recuperacaoVenda';
import CarrinhosAbandonados from '@/components/CarrinhosAbandonados';
import RecuperacaoLoja from './RecuperacaoLoja';

const money = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
const STATUS: Record<string, [string, string]> = {
  pago: ['act', 'Pago'], entregue: ['act', 'Entregue'], reembolsado: ['rej', 'Reembolsado'],
  pendente: ['rev', 'Aguardando pagamento'], cancelado: ['rej', 'Expirado'],
};
const FILTROS: [string, string][] = [['vendas', 'Vendas'], ['aguardando', 'Aguardando pagamento'], ['abandonou', 'Abandonou o checkout'], ['reembolsadas', 'Reembolsadas'], ['todas', 'Todas']];
type Contato = { nome: string | null; whatsapp: string | null; avisos: boolean };

export default function VendasClient({ vendas, clientes = {}, loja = '', site = 'https://www.compreibarato.com.br', inicial = 'vendas', carrinhos = [] }: { vendas: any[]; clientes?: Record<string, Contato>; loja?: string; site?: string; inicial?: string; carrinhos?: any[] }) {
  const [filtro, setFiltro] = useState(inicial);
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const cliente = (v: any): Contato => clientes[v.comprador] || { nome: null, whatsapp: null, avisos: false };
  const concluida = (v: any) => v.status === 'pago' || v.status === 'entregue';

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return vendas.filter((v: any) => {
      const ok = filtro === 'vendas' ? concluida(v) : filtro === 'aguardando' ? v.status === 'pendente'
        : filtro === 'reembolsadas' ? v.status === 'reembolsado' : true;
      if (!ok) return false;
      if (!q) return true;
      const c = cliente(v);
      return [v.products?.titulo, v.comprador_email, c.nome, c.whatsapp].some((x) => String(x || '').toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendas, filtro, busca, clientes]);

  const concretizadas = vendas.filter(concluida);
  const totalLiquido = concretizadas.reduce((s: number, v: any) => s + Number(v.valor_vendedor), 0);
  const totalBruto = concretizadas.reduce((s: number, v: any) => s + Number(v.total), 0);
  const pendentes = vendas.filter((v: any) => v.status === 'pendente');
  const totalPendente = pendentes.reduce((s: number, v: any) => s + Number(v.total), 0);

  const mensagem = (v: any) => mensagemRecuperacao({ nome: cliente(v).nome, produto: v.products?.titulo || 'o produto', loja, link: `${site}/checkout/${v.product_id}` });
  async function copiar(v: any) {
    try { await navigator.clipboard.writeText(mensagem(v)); toast('Mensagem copiada. É só colar no WhatsApp ou no e-mail.', 'success'); } catch { toast('Não deu para copiar neste navegador.', 'error'); }
  }

  function exportarCSV() {
    const headers = ['Data', 'Produto', 'Cliente', 'E-mail', 'WhatsApp', 'Status', 'Valor Bruto', 'Taxa', 'Valor Liquido'];
    const linhas = lista.map((v: any) => {
      const c = cliente(v);
      return [
        new Date(v.created_at).toLocaleString('pt-BR'), v.products?.titulo ?? 'Produto', c.nome ?? '', v.comprador_email ?? '',
        c.whatsapp ? foneLegivel(c.whatsapp) : '', (STATUS[v.status]?.[1] ?? v.status), money(v.total), money(v.taxa), money(v.valor_vendedor),
      ];
    });
    const csv = [headers, ...linhas].map((r: string[]) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vendas-compreibarato-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        .vd-tab{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .vd-tab table{min-width:760px}
        .vd-acoes{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
        .vd-wa{display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#0B3D1E;border-radius:50px;padding:7px 12px;font-weight:800;font-size:12.5px;text-decoration:none;white-space:nowrap}
        .vd-bt{display:inline-flex;align-items:center;gap:6px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:50px;padding:7px 12px;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap;text-decoration:none}
        .vd-alerta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#FFF6E5;border:1px solid #FFD58A;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:14px}
        .vd-cli b{display:block;font-weight:800;color:var(--text)}
        .vd-cli small{color:var(--muted);font-size:12px}
      ` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Vendas</h1>
          <p className="muted">Vendas concluídas, pedidos aguardando pagamento e reembolsos, com o contato de cada cliente.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportarCSV} disabled={!lista.length}><Icon name="download" size={16} /> Exportar CSV</button>
      </div>

      <div className="sd-stats" style={{ marginTop: 18 }}>
        <div className="sd-stat"><div className="ic"><Icon name="receipt" size={20} /></div><b>{concretizadas.length}</b><small>Vendas concretizadas</small></div>
        <div className="sd-stat"><div className="ic"><Icon name="money" size={20} /></div><b>{money(totalBruto)}</b><small>Faturamento bruto</small></div>
        <div className="sd-stat"><div className="ic"><Icon name="wallet" size={20} /></div><b>{money(totalLiquido)}</b><small>Líquido (já com a taxa)</small></div>
        <div className="sd-stat"><div className="ic"><Icon name="clock" size={20} /></div><b>{pendentes.length}</b><small>Aguardando pagamento ({money(totalPendente)})</small></div>
      </div>

      {/* Recuperação: botão com a quantidade; abre com o status, o envio em massa e os atalhos para o contato um a um */}
      <RecuperacaoLoja pendentes={pendentes.length} carrinhos={carrinhos.length} onVer={setFiltro} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTROS.map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="btn btn-sm"
            style={filtro === k
              ? { background: 'var(--soft)', color: 'var(--orange-ink)', border: '1px solid var(--orange)' }
              : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            {l}{k === 'aguardando' && pendentes.length ? ` (${pendentes.length})` : ''}{k === 'abandonou' && carrinhos.length ? ` (${carrinhos.length})` : ''}
          </button>
        ))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, e-mail ou produto" aria-label="Buscar"
          style={{ marginLeft: 'auto', minWidth: 220, flex: '0 1 280px', padding: '9px 14px', borderRadius: 50, border: '1px solid var(--border)', fontSize: 14 }} />
      </div>

      {filtro === 'aguardando' && (
        <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
          Quem gerou o Pix ou abriu o checkout e não pagou. O site já manda lembrete automático quando a recuperação está ligada em Checkout do produto; o contato direto aqui é o reforço.
          O WhatsApp só aparece para clientes que aceitaram receber avisos.
        </p>
      )}

      {filtro === 'abandonou' ? <div className="card vd-tab" style={{ padding: 0 }}><CarrinhosAbandonados itens={carrinhos} site={site} /></div> : (
      <div className="card vd-tab" style={{ padding: 0 }}>
        {lista.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={th}>Data</th><th style={th}>Produto</th><th style={th}>Cliente</th>
                <th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>{filtro === 'aguardando' ? 'Valor' : 'Valor líquido'}</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v: any) => {
                const st = STATUS[v.status] || ['rev', v.status];
                const open = aberta === v.id;
                const c = cliente(v);
                const pend = v.status === 'pendente';
                const wa = pend && c.avisos ? linkWhatsapp(c.whatsapp, mensagem(v)) : null;
                return (
                  <Fragment key={v.id}>
                    <tr style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setAberta(open ? null : v.id)}>
                      <td style={td}>{new Date(v.created_at).toLocaleDateString('pt-BR')}<br /><small className="muted">{pend ? haQuanto(v.created_at) : new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></td>
                      <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ProductThumb capa_url={v.products?.capa_url} categoria={v.products?.categoria} titulo={v.products?.titulo} tamanho={28} raio={7} icone={16} />{v.products?.titulo ?? 'Produto'}</span></td>
                      <td style={td}><span className="vd-cli"><b>{c.nome || '—'}</b><small>{v.comprador_email ?? ''}</small>{c.whatsapp && <small><br />{foneLegivel(c.whatsapp)}</small>}</span></td>
                      <td style={td}><span className={`pill ${st[0]}`}>{st[1]}</span></td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'Outfit', fontWeight: 800, color: pend ? 'var(--text)' : 'var(--green)' }}>{money(pend ? v.total : v.valor_vendedor)}</td>
                      <td style={td} onClick={(e) => pend && e.stopPropagation()}>
                        {pend ? (
                          <div className="vd-acoes">
                            {wa && <a className="vd-wa" href={wa} target="_blank" rel="noreferrer"><Icon name="chat" size={14} /> WhatsApp</a>}
                            {v.comprador_email && <a className="vd-bt" href={`mailto:${v.comprador_email}?subject=${encodeURIComponent('Sua compra no Comprei Barato')}&body=${encodeURIComponent(mensagem(v))}`}><Icon name="mail" size={14} /> E-mail</a>}
                            <button className="vd-bt" onClick={() => copiar(v)}><Icon name="copy" size={14} /> Copiar</button>
                          </div>
                        ) : <span style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>}
                      </td>
                    </tr>
                    {open && !pend && (
                      <tr style={{ background: 'var(--surface)' }}>
                        <td colSpan={6} style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13 }}>
                            <span className="muted">Pedido: <strong style={{ color: 'var(--text)' }}>#{String(v.id).slice(0, 8)}</strong></span>
                            <span className="muted">Bruto: <strong style={{ color: 'var(--text)' }}>{money(v.total)}</strong></span>
                            <span className="muted">Taxa da plataforma: <strong style={{ color: 'var(--text)' }}>{money(v.taxa)}</strong></span>
                            <span className="muted">Líquido p/ você: <strong style={{ color: 'var(--green)' }}>{money(v.valor_vendedor)}</strong></span>
                            <span className="muted">Data/hora: <strong style={{ color: 'var(--text)' }}>{new Date(v.created_at).toLocaleString('pt-BR')}</strong></span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : <div style={{ padding: 28 }} className="muted">{filtro === 'aguardando' ? 'Nenhum pedido aguardando pagamento.' : 'Nenhuma venda nesse filtro ainda.'}</div>}
      </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' };
const td: React.CSSProperties = { padding: '13px 16px', verticalAlign: 'top' };
