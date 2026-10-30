'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { rotuloMotivo } from '@/lib/garantia';

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const PAINEL_MISTIC = 'https://app.misticpay.com/dashboard/relatorios/extrato';
const DEV: Record<string, [string, string]> = { aguardando: ['#B7791F', 'Devolução: aguardando a MisticPay'], confirmada: ['#00B87A', 'Devolução confirmada'], manual: ['#00B87A', 'Devolução confirmada à mão'], recusada: ['#E23B3B', 'Devolução RECUSADA pelo banco'] };
const COR: Record<string, string> = { aberto: '#B7791F', aprovado: '#00B87A', recusado: '#E23B3B', cancelado: '#8A8AA0' };

// Admin → Reembolsos: pedidos feitos pelos compradores dentro da garantia.
export default function Reembolsos({ onContagem }: { onContagem?: (n: number) => void }) {
  const [filtro, setFiltro] = useState<'aberto' | 'todos'>('aberto');
  const [itens, setItens] = useState<any[]>([]);
  const [sql18, setSql18] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [decidindo, setDecidindo] = useState<{ id: number; acao: 'aprovar' | 'recusar' } | null>(null);
  const [resposta, setResposta] = useState('');
  const [devolvido, setDevolvido] = useState(false);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/admin/reembolsos?status=${filtro}`, { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      setSql18(d.sql18 !== false); setItens(d.itens ?? []); onContagem?.(d.abertos ?? 0);
    } catch { toast('Falha ao carregar.', 'error'); }
    finally { setCarregando(false); }
  }, [filtro, onContagem]);
  useEffect(() => { carregar(); }, [carregar]);

  async function acao(id: number, a: 'conferir' | 'confirmar_manual') {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/reembolsos', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, acao: a }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível.', 'error'); return; }
      toast(d.mensagem || 'Feito.', d.devolvido === false ? 'info' : 'success'); carregar();
    } finally { setBusy(false); }
  }
  const copiar = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Copiado.', 'success')).catch(() => toast('Não deu para copiar.', 'error'));

  async function decidir() {
    if (!decidindo) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/reembolsos', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: decidindo.id, acao: decidindo.acao, resposta }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível salvar.', 'error'); return; }
      toast(decidindo.acao === 'aprovar' ? (itens.find((x) => x.id === decidindo.id)?.pedido?.forma === 'cartao' ? 'Reembolso aprovado.' : 'Reembolso aprovado. Agora devolva o Pix na MisticPay: o site confirma sozinho.') : 'Reembolso recusado. O cliente foi avisado.', 'success');
      setDecidindo(null); setResposta(''); setDevolvido(false); carregar();
    } finally { setBusy(false); }
  }

  if (!sql18) return <div className="adm-card"><b>Rode o SQL 18</b> no Supabase para ativar os pedidos de reembolso pelo site.</div>;
  return (
    <>
      <div className="adm-filters">
        <button className={`adm-fb ${filtro === 'aberto' ? 'on' : ''}`} onClick={() => setFiltro('aberto')}>Em análise</button>
        <button className={`adm-fb ${filtro === 'todos' ? 'on' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
      </div>
      {carregando ? <div className="adm-empty">Carregando…</div> : !itens.length ? (
        <div className="adm-card adm-empty">{filtro === 'aberto' ? 'Nenhum pedido de reembolso em análise.' : 'Nenhum pedido de reembolso ainda.'}</div>
      ) : itens.map((r) => {
        const p = r.pedido || {};
        const dias = p.pago_em ? Math.floor((new Date(r.created_at).getTime() - new Date(p.pago_em).getTime()) / 86400000) : null;
        return (
          <div key={r.id} className="adm-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontFamily: 'Outfit', fontSize: 16 }}>{p.produto || 'Produto'}</b>
                <div style={{ color: 'var(--sub)', fontSize: 13, marginTop: 2 }}>
                  {p.loja} · {brl(p.total)}{p.pago > p.total ? ` + taxa ${brl(p.pago - p.total)}` : ''} · {p.forma === 'pix' ? 'Pix' : p.forma === 'cartao' ? 'Cartão' : 'forma não registrada'} · pago em {dt(p.pago_em)}
                </div>
                <div style={{ color: 'var(--sub)', fontSize: 13 }}>Pedido #{String(r.order_id).slice(0, 8)}{p.comprador_nome ? ` · ${p.comprador_nome}` : ''}{p.comprador_email ? ` · ${p.comprador_email}` : ''}</div>
                {p.gateway_ref && p.forma !== 'cartao' && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: 13 }}>
                    <span>Compra na {String(p.gateway_ref).startsWith('mp:') ? 'Mercado Pago' : 'MisticPay'}: <b style={{ fontFamily: 'monospace' }}>{String(p.gateway_ref).replace(/^mp:/, '')}</b></span>
                    <button type="button" className="adm-btn rp" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => copiar(String(p.gateway_ref).replace(/^mp:/, ''))}>Copiar</button>
                    {!String(p.gateway_ref).startsWith('mp:') && <a className="adm-btn rp" style={{ padding: '3px 10px', fontSize: 12, textDecoration: 'none' }} href={PAINEL_MISTIC} target="_blank" rel="noopener noreferrer">Abrir extrato da MisticPay ↗</a>}
                  </div>
                )}
              </div>
              <span className="adm-pill" style={{ background: `${COR[r.status]}22`, color: COR[r.status] }}>{r.status === 'aberto' ? 'Em análise' : r.status === 'aprovado' ? 'Aprovado' : r.status === 'recusado' ? 'Recusado' : 'Cancelado pelo cliente'}</span>
            </div>
            <div style={{ marginTop: 12, background: 'var(--panel2)', borderRadius: 12, padding: '10px 12px', fontSize: 14 }}>
              <b>{rotuloMotivo(r.motivo)}</b> <span style={{ color: 'var(--sub)', fontSize: 12.5 }}>· pedido em {dt(r.created_at)}{dias !== null ? ` (${dias} dia${dias === 1 ? '' : 's'} após o pagamento)` : ''}</span>
              {r.detalhe && <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{r.detalhe}</div>}
              {r.resposta && <div style={{ marginTop: 8, color: 'var(--sub)' }}>Resposta: {r.resposta}</div>}
            </div>
            {r.status === 'aprovado' && (
              <div style={{ marginTop: 10, fontSize: 13.5, display: 'grid', gap: 6 }}>
                <div style={{ color: 'var(--sub)' }}>{r.aprovado_por_nome ? <>Aprovado por <b style={{ color: 'var(--tx)' }}>{r.aprovado_por_nome}</b> em {dt(r.decidido_em)}</> : <>Aprovado automaticamente em {dt(r.decidido_em)} (devolução feita direto no gateway)</>}</div>
                {r.devolucao_status && DEV[r.devolucao_status] && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="adm-pill" style={{ background: `${DEV[r.devolucao_status][0]}22`, color: DEV[r.devolucao_status][0] }}>{DEV[r.devolucao_status][1]}</span>
                    {(r.devolucao_status === 'confirmada' || r.devolucao_status === 'manual') && (
                      <span style={{ color: 'var(--sub)' }}>
                        {r.devolucao_valor ? `${brl(r.devolucao_valor)} · ` : ''}{dt(r.devolucao_em)}
                        {r.devolucao_status === 'manual' && r.devolucao_por_nome ? ` · por ${r.devolucao_por_nome}` : r.devolucao_origem === 'webhook' ? ' · aviso automático da MisticPay' : r.devolucao_origem === 'conferencia' ? ' · conferido na MisticPay' : ''}
                        {r.devolucao_ref ? ` · id ${r.devolucao_ref}` : ''}
                      </span>
                    )}
                    {(r.devolucao_status === 'aguardando' || r.devolucao_status === 'recusada') && (
                      p.forma === 'cartao'
                        ? <button className="adm-btn ap" disabled={busy} onClick={() => acao(r.id, 'confirmar_manual')}>Já devolvi na Stripe</button>
                        : <>
                            <button className="adm-btn ap" disabled={busy} onClick={() => acao(r.id, 'conferir')}>Conferir na MisticPay</button>
                            <button className="adm-btn rp" disabled={busy} onClick={() => { if (confirm('Confirmar que você devolveu o valor ao cliente? Fica registrado no seu nome.')) acao(r.id, 'confirmar_manual'); }}>Confirmar à mão</button>
                          </>
                    )}
                  </div>
                )}
                {r.devolucao_status === 'aguardando' && p.forma !== 'cartao' && <small style={{ color: 'var(--sub)' }}>Devolva na MisticPay (extrato → busque a transação acima → Devolver {brl(p.pago ?? p.total)}). Quando a MisticPay devolver, o site confirma sozinho e avisa o cliente.</small>}
              </div>
            )}
            {r.status === 'aberto' && (decidindo && decidindo.id === r.id ? (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {decidindo.acao === 'aprovar' && (
                  <div style={{ fontSize: 13.5, background: '#FFB02E18', border: '1px solid #FFB02E55', borderRadius: 12, padding: '10px 12px' }}>
                    {p.forma === 'cartao' ? (
                      <><b>Devolva antes no Stripe:</b> Pagamentos → encontre o pagamento → Reembolsar {brl(p.pago ?? p.total)}.</>
                    ) : (
                      <>
                        <b>Como devolver o Pix ({brl(p.pago ?? p.total)}):</b>
                        <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                          <li>Abra o <a href={PAINEL_MISTIC} target="_blank" rel="noopener noreferrer">extrato da MisticPay ↗</a> e busque pela compra {p.gateway_ref ? <b style={{ fontFamily: 'monospace' }}>{String(p.gateway_ref).replace(/^mp:/, '')}</b> : ''}{p.comprador_nome ? <> ou pelo nome <b>{p.comprador_nome}</b></> : ''}.</li>
                          <li>Abra a transação e clique em <b>Devolver</b>: o Pix volta para a conta de onde saiu, sem precisar de chave.</li>
                          <li>A MisticPay avisa o site e este reembolso fecha sozinho. Pode aprovar antes ou depois de devolver.</li>
                        </ol>
                      </>
                    )}
                    <div style={{ marginTop: 6, color: 'var(--sub)' }}>Aprovar marca o pedido como reembolsado, encerra o acesso do comprador, tira o valor do saldo do vendedor e fica registrado no seu nome.</div>
                    {p.forma === 'cartao' && (
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontWeight: 800, cursor: 'pointer' }}>
                        <input type="checkbox" checked={devolvido} onChange={(e) => setDevolvido(e.target.checked)} /> Já devolvi {brl(p.pago ?? p.total)} no Stripe
                      </label>
                    )}
                  </div>
                )}
                <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} maxLength={2000}
                  placeholder={decidindo.acao === 'aprovar' ? 'Mensagem ao cliente (opcional)' : 'Explique ao cliente por que o reembolso não foi aprovado (obrigatório)'}
                  style={{ width: '100%', borderRadius: 11, border: '1.5px solid var(--bd2)', background: 'var(--panel2)', color: 'var(--tx)', padding: 10, fontSize: 14 }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="adm-btn ap" disabled={busy || (decidindo.acao === 'aprovar' ? (p.forma === 'cartao' && !devolvido) : resposta.trim().length < 10)} onClick={decidir}>
                    {busy ? 'Salvando…' : decidindo.acao === 'aprovar' ? 'Aprovar reembolso' : 'Recusar reembolso'}
                  </button>
                  <button className="adm-btn rp" onClick={() => { setDecidindo(null); setResposta(''); setDevolvido(false); }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="adm-btn ap" onClick={() => { setDecidindo({ id: r.id, acao: 'aprovar' }); setResposta(''); setDevolvido(false); }}><Icon name="check" size={15} /> Aprovar</button>
                <button className="adm-btn rp" onClick={() => { setDecidindo({ id: r.id, acao: 'recusar' }); setResposta(''); }}><Icon name="x" size={15} /> Recusar</button>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
