'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { ROTULO_STATUS, type StatusIndicacao } from '@/lib/indicacao';
import { Aviso, Bloqueado, Kpi, V3_CSS, dataHora, fmt } from './v3/ui';

// Admin › Indicações: liga/desliga, regras da recompensa (CB Points), acompanhamento e antifraude.
const FILTROS: [string, string][] = [['todas', 'Todas'], ['suspeitas', 'Com alerta'], ['bloqueada', 'Bloqueadas'], ['pendente', 'Pendentes'], ['liberada', 'Liberadas'], ['cadastrado', 'Só cadastro'], ['estornada', 'Estornadas'], ['cancelada', 'Não elegíveis']];
const SINAL: Record<string, string> = { mesmo_navegador: 'mesmo navegador de quem indicou', muitos_cadastros_24h: 'muitos cadastros em 24 h pelo código' };
const money = (v: number | null | undefined) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const paraCampo = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 16) : '');
const doCampo = (v: string) => (v ? new Date(`${v}:00-03:00`).toISOString() : null);

export default function IndicacoesAdmin() {
  const [d, setD] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [filtro, setFiltro] = useState('todas');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  const primeiraCarga = useRef(true);
  const lembrarRegras = (v: boolean) => { setRegrasAbertas(v); try { localStorage.setItem('cb_adm_ind_regras', v ? '1' : '0'); } catch {} };

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/admin/indicacoes?status=${filtro}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j.error || 'Falha ao carregar.'); return; }
    setErro(null); setD(j); setCfg((c: any) => c || j.cfg);
    // 1ª carga: abre só se ainda não está configurado (ou se o admin deixou aberto da última vez)
    if (primeiraCarga.current) { primeiraCarga.current = false; let salvo: string | null = null; try { salvo = localStorage.getItem('cb_adm_ind_regras'); } catch {} setRegrasAbertas(salvo !== null ? salvo === '1' : !(Number(j.cfg?.pontos) > 0)); }
  }, [filtro]);
  useEffect(() => { carregar(); }, [carregar]);

  const post = async (corpo: any, ok: string) => {
    const r = await fetch('/api/admin/indicacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return null; }
    toast(ok, 'success'); carregar(); return j;
  };
  async function salvarCfg() {
    if (cfg.ativo && !(Number(cfg.pontos) > 0)) { toast('Defina quantos pontos a indicação vale antes de ligar.', 'error'); return; }
    if (cfg.ativo && !(Number(cfg.tetoComissaoPct) > 0)) { toast('Defina o teto (% da comissão) antes de ligar.', 'error'); return; }
    if (cfg.ativo && !(Number(cfg.orcamentoMensal) > 0)) { toast('Defina o orçamento do mês antes de ligar.', 'error'); return; }
    if (cfg.ativo && !confirm(`Ligar o programa?\n\n• Até ${cfg.pontos} pontos por indicação (${reais(cfg.pontos)}), nunca mais que ${cfg.tetoComissaoPct}% da comissão do pedido\n• No máximo R$ ${Number(cfg.orcamentoMensal).toFixed(2).replace('.', ',')} liberados por mês`)) return;
    setSalvando(true);
    const j = await post({ acao: 'config', cfg }, 'Regras salvas.');
    if (j?.cfg) { setCfg(j.cfg); lembrarRegras(false); } // salvou: recolhe e mostra o resumo
    setSalvando(false);
  }
  const bloquear = (id: number) => { const motivo = prompt('Motivo do bloqueio (fica no registro):', 'Suspeita de conta criada para ganhar pontos.'); if (motivo !== null) post({ acao: 'bloquear', id, motivo }, 'Indicação bloqueada.'); };
  const set = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));
  const ppr = Number(d?.custo?.pontosPorReal) || 100;
  const reais = (pts: number) => money((Number(pts) || 0) / ppr);

  if (erro) return /bloquead|C1/i.test(erro) ? <Bloqueado mensagem={erro} /> : <Aviso>{erro}</Aviso>;
  if (!d) return <div className="adm-card"><p style={{ margin: 0, color: 'var(--sub)' }}>Carregando…</p></div>;

  return (
    <div className="ix">
      <style dangerouslySetInnerHTML={{ __html: V3_CSS + CSS }} />
      <p className="adm-sub" style={{ marginBottom: 16 }}>Comprador indica amigo pelo link pessoal; quando o amigo novo faz a primeira compra paga, quem indicou ganha CB Points depois do prazo de liberação.</p>
      {!d.sql37 && <Aviso><b>Falta rodar o SQL 37 (INDICACOES).</b> Sem ele os links funcionam como rastreio, mas nenhuma indicação é registrada.</Aviso>}

      <details className="adm-card ix-regras" open={regrasAbertas} onToggle={(e) => lembrarRegras((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>
          <span><b>Regras da recompensa</b>
            <small>{cfg.ativo ? 'Ligado' : 'Desligado'} · até {fmt(cfg.pontos)} pontos ({reais(cfg.pontos)}) · teto {cfg.tetoComissaoPct}% da comissão · {money(cfg.orcamentoMensal)}/mês · mínimo {money(cfg.minimo)} · libera em {cfg.prazoDias} dias</small>
          </span>
          <span className="ix-seta" aria-hidden="true">{regrasAbertas ? 'Fechar' : 'Editar'}</span>
        </summary>
        <label className="ix-sw"><input type="checkbox" checked={cfg.ativo} onChange={(e) => set('ativo', e.target.checked)} /> <b>Programa ligado</b></label>
        <div className="ix-campos">
          <label>Pontos por indicação convertida (máximo)<input type="number" min={0} value={cfg.pontos} onChange={(e) => set('pontos', Number(e.target.value))} /><small>= {reais(cfg.pontos)} em desconto</small></label>
          <label>Teto: % da comissão da plataforma no pedido<input type="number" min={0} max={100} value={cfg.tetoComissaoPct} onChange={(e) => set('tetoComissaoPct', Number(e.target.value))} /><small>a recompensa é o menor valor entre os pontos e este teto</small></label>
          <label>Orçamento do mês (R$ liberados em pontos)<input type="number" min={0} step="1" value={cfg.orcamentoMensal} onChange={(e) => set('orcamentoMensal', Number(e.target.value))} /><small>passou disso, o resto libera no mês seguinte</small></label>
          <label>Compra mínima do amigo (R$)<input type="number" min={0} step="0.01" value={cfg.minimo} onChange={(e) => set('minimo', Number(e.target.value))} /></label>
          <label>Liberar os pontos depois de (dias)<input type="number" min={0} max={90} value={cfg.prazoDias} onChange={(e) => set('prazoDias', Number(e.target.value))} /></label>
          <label>Limite de recompensas por pessoa (0 = sem limite)<input type="number" min={0} value={cfg.limitePorUsuario} onChange={(e) => set('limitePorUsuario', Number(e.target.value))} /></label>
          <label>Campanha começa<input type="datetime-local" value={paraCampo(cfg.inicio)} onChange={(e) => set('inicio', doCampo(e.target.value))} /></label>
          <label>Campanha termina<input type="datetime-local" value={paraCampo(cfg.fim)} onChange={(e) => set('fim', doCampo(e.target.value))} /></label>
          <label>Produtos que valem<select value={cfg.produtos} onChange={(e) => set('produtos', e.target.value)}><option value="todos">Todos</option><option value="lista">Só os IDs da lista</option></select></label>
          <label>Alerta: cadastros por código em 24 h<input type="number" min={1} value={cfg.alertaCadastrosDia} onChange={(e) => set('alertaCadastrosDia', Number(e.target.value))} /></label>
          {cfg.produtos === 'lista' && <label className="lg">IDs dos produtos (um por linha)<textarea rows={3} value={(cfg.produtosIds || []).join('\n')} onChange={(e) => set('produtosIds', e.target.value.split(/\s+/).filter(Boolean))} /></label>}
        </div>
        <div className="ix-exemplo">
          <b>Simulação</b>
          {[20, 50, 100].map((v) => {
            const com = v * 0.1; // exemplo: comissão de 10%
            const pts = Math.max(0, Math.min(Number(cfg.pontos) || 0, Math.floor(com * ((Number(cfg.tetoComissaoPct) || 0) / 100) * ppr + 1e-6)));
            return <span key={v}>Compra de {money(v)} com comissão de {money(com)} → {pts} pontos ({reais(pts)})</span>;
          })}
          <small>Exemplo com comissão de 10%. O cálculo real usa a comissão de cada pedido.</small>
        </div>
        <p className="ix-nota">Sugestão de prazo: igual ou maior que a garantia mais longa dos produtos, para o ponto só sair depois que o reembolso não for mais possível. Pontos são custo da plataforma: confira o valor do ponto em CB Points antes de ligar.</p>
        <button className="adm-btn" onClick={salvarCfg} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar regras'}</button>
      </details>

      {d.custo && (
        <div className="adm-card">
          <h3 className="adm-ct">Custo do programa</h3>
          <div className="ix-orc"><div style={{ width: `${Math.min(100, d.custo.orcamentoMes > 0 ? (d.custo.liberadoMes / d.custo.orcamentoMes) * 100 : 0)}%` }} /></div>
          <p className="ix-nota" style={{ marginTop: 6 }}>{money(d.custo.liberadoMes)} de {money(d.custo.orcamentoMes)} usados neste mês · restam {money(d.custo.restanteMes)}</p>
          <div className="v3-kpis">
            <Kpi valor={money(d.custo.liberadoMes)} rotulo="Liberado neste mês" />
            <Kpi valor={money(d.custo.pendenteReais)} rotulo="Em liberação (ainda não custou)" />
            <Kpi valor={money(d.custo.liberadoTotalReais)} rotulo="Liberado desde o início" />
            <Kpi valor={money(d.custo.descontosUsadosReais)} rotulo="Descontos com CB Points usados" nota="todo o site, todas as origens" />
          </div>
          <p className="ix-nota">O ponto só vira custo quando é usado como desconto numa compra, e o desconto nunca passa da comissão daquela compra. Ponto liberado e não usado não sai do caixa.</p>
        </div>
      )}

      {d.kpis && (
        <div className="adm-card">
          <h3 className="adm-ct">Indicadores</h3>
          <div className="v3-kpis">
            <Kpi valor={fmt(d.kpis.codigos)} rotulo="Links criados" />
            <Kpi valor={fmt(d.kpis.cadastros)} rotulo="Amigos cadastrados" />
            <Kpi valor={fmt(d.kpis.pendentes + d.kpis.liberadas)} rotulo="Primeiras compras" />
            <Kpi valor={fmt(d.kpis.pontosPendentes)} rotulo="Pontos em liberação" />
            <Kpi valor={fmt(d.kpis.pontosLiberados)} rotulo="Pontos já pagos" />
            <Kpi valor={fmt(d.kpis.bloqueadas)} rotulo="Em análise (bloqueadas)" />
          </div>
          {d.top?.length > 0 && <p className="ix-nota"><b>Quem mais indica:</b> {d.top.map((t: any) => `${t.nome} (${t.indicacoes})`).join(' · ')}</p>}
        </div>
      )}

      <div className="adm-card">
        <div className="ix-filtros">{FILTROS.map(([k, r]) => <button key={k} type="button" className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>{r}</button>)}</div>
        <div className="ix-tab">
          <table>
            <thead><tr><th>Quando</th><th>Quem indicou</th><th>Amigo</th><th>Situação</th><th>Pontos</th><th>Alertas / motivo</th><th></th></tr></thead>
            <tbody>
              {(d.itens || []).map((x: any) => {
                const cod = d.codigosBloqueados?.includes(x.indicador_id);
                return (
                  <tr key={x.id}>
                    <td>{dataHora(x.criado_em)}</td>
                    <td><b>{x.indicador}</b><small>{x.codigo}{cod ? ' · código bloqueado' : ''}</small></td>
                    <td>{x.indicado}{x.order_id && <small>pedido #{String(x.order_id).slice(0, 8)}</small>}</td>
                    <td><span className={`ix-st s-${x.status}`}>{ROTULO_STATUS[x.status as StatusIndicacao] || x.status}</span>{x.status === 'pendente' && x.libera_em && <small>libera {dataHora(x.libera_em)}</small>}</td>
                    <td>{fmt(x.pontos)}</td>
                    <td>{Object.keys(x.sinais || {}).map((k) => <small key={k} className="ix-alerta">{SINAL[k] || k}</small>)}{x.motivo && <small>{x.motivo}</small>}</td>
                    <td className="ix-acoes">
                      {['cadastrado', 'pendente'].includes(x.status) && <button type="button" onClick={() => bloquear(x.id)}>Bloquear</button>}
                      {x.status === 'bloqueada' && <button type="button" onClick={() => post({ acao: 'desbloquear', id: x.id }, 'Indicação liberada para seguir.')}>Desbloquear</button>}
                      <button type="button" onClick={() => post({ acao: cod ? 'desbloquear_codigo' : 'bloquear_codigo', userId: x.indicador_id }, cod ? 'Código liberado.' : 'Código bloqueado.')}>{cod ? 'Liberar código' : 'Bloquear código'}</button>
                    </td>
                  </tr>
                );
              })}
              {!(d.itens || []).length && <tr><td colSpan={7}>Nenhuma indicação neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="ix-nota">Toda ação aqui fica em Registro (quem fez). Pontos já liberados não são tirados por aqui: reembolso do pedido estorna automaticamente.</p>
      </div>
    </div>
  );
}

const CSS = `
.ix-regras>summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer}.ix-regras>summary::-webkit-details-marker{display:none}
.ix-regras>summary b{display:block;font-family:Outfit;font-size:16px}.ix-regras>summary small{display:block;color:var(--sub);font-size:12.5px;margin-top:3px;line-height:1.45}
.ix-regras[open]>summary{margin-bottom:14px}.ix-seta{flex-shrink:0;font-size:12.5px;font-weight:800;color:var(--or2);border:1px solid var(--bd2);border-radius:999px;padding:5px 12px}
.ix-sw{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.ix-campos{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.ix-campos .lg{grid-column:1/-1}
.ix-campos label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--sub)}
.ix-campos input,.ix-campos select,.ix-campos textarea{min-height:38px;border:1px solid var(--bd2);border-radius:10px;padding:6px 10px;font-size:14px;color:var(--tx);background:var(--panel2);font-family:inherit}
.ix-campos small{font-weight:500;font-size:11.5px;color:var(--sub)}
.ix-exemplo{display:flex;flex-direction:column;gap:3px;background:rgba(255,122,20,.08);color:var(--tx);border:1px solid rgba(255,122,20,.45);border-radius:12px;padding:10px 12px;margin-top:12px;font-size:12.5px}.ix-exemplo b{color:var(--or2)}.ix-exemplo small{color:var(--sub)}
.ix-orc{height:10px;border-radius:999px;background:var(--panel2);overflow:hidden}.ix-orc div{height:100%;background:linear-gradient(90deg,#FF7A00,#FFC83D)}
.ix-nota{color:var(--sub);font-size:12px;line-height:1.5;margin:10px 0}
.ix-filtros{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.ix-filtros button{border:1px solid var(--bd2);background:var(--panel2);color:var(--tx);border-radius:999px;padding:5px 12px;font-weight:700;font-size:12.5px;cursor:pointer}
.ix-filtros button.on{background:#0B0B0C;color:#fff;border-color:#0B0B0C}
.ix-tab{overflow-x:auto}.ix-tab table{width:100%;border-collapse:collapse;font-size:13px;min-width:820px}
.ix-tab th{text-align:left;font-size:11.5px;text-transform:uppercase;color:var(--sub);padding:8px;border-bottom:1px solid var(--bd2)}
.ix-tab td{padding:9px 8px;border-bottom:1px solid var(--bd2);vertical-align:top}.ix-tab td small{display:block;color:var(--sub);font-size:11.5px}
.ix-alerta{color:#B45309!important;font-weight:700}
.ix-st{font-size:11.5px;font-weight:800;border-radius:999px;padding:3px 9px;background:var(--panel2);color:var(--tx);white-space:nowrap}
.ix-st.s-pendente{background:#FFF1E6;color:#B45309}.ix-st.s-liberada{background:#E8F7EE;color:#15803D}.ix-st.s-bloqueada{background:#FEF3C7;color:#92400E}.ix-st.s-estornada,.ix-st.s-cancelada{background:#FEE2E2;color:#B91C1C}
.ix-acoes{display:flex;flex-direction:column;gap:4px}.ix-acoes button{border:1px solid var(--bd2);background:var(--panel2);color:var(--tx);border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer;white-space:nowrap}
@media(max-width:700px){.ix-campos{grid-template-columns:1fr}}
`;
