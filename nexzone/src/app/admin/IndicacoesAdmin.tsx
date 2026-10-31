'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { ROTULO_STATUS, type StatusIndicacao } from '@/lib/indicacao';
import { Aviso, Bloqueado, Kpi, V3_CSS, dataHora, fmt } from './v3/ui';

// Admin › Indicações: liga/desliga, regras da recompensa (CB Points), acompanhamento e antifraude.
const FILTROS: [string, string][] = [['todas', 'Todas'], ['suspeitas', 'Com alerta'], ['bloqueada', 'Bloqueadas'], ['pendente', 'Pendentes'], ['liberada', 'Liberadas'], ['cadastrado', 'Só cadastro'], ['estornada', 'Estornadas'], ['cancelada', 'Não elegíveis']];
const SINAL: Record<string, string> = { mesmo_navegador: 'mesmo navegador de quem indicou', muitos_cadastros_24h: 'muitos cadastros em 24 h pelo código' };
const paraCampo = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 16) : '');
const doCampo = (v: string) => (v ? new Date(`${v}:00-03:00`).toISOString() : null);

export default function IndicacoesAdmin() {
  const [d, setD] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [filtro, setFiltro] = useState('todas');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/admin/indicacoes?status=${filtro}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j.error || 'Falha ao carregar.'); return; }
    setErro(null); setD(j); setCfg((c: any) => c || j.cfg);
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
    if (cfg.ativo && !confirm(`Ligar o programa pagando ${cfg.pontos} CB Points por indicação convertida?`)) return;
    setSalvando(true);
    const j = await post({ acao: 'config', cfg }, 'Regras salvas.');
    if (j?.cfg) setCfg(j.cfg);
    setSalvando(false);
  }
  const bloquear = (id: number) => { const motivo = prompt('Motivo do bloqueio (fica no registro):', 'Suspeita de conta criada para ganhar pontos.'); if (motivo !== null) post({ acao: 'bloquear', id, motivo }, 'Indicação bloqueada.'); };
  const set = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));

  if (erro) return /bloquead|C1/i.test(erro) ? <Bloqueado mensagem={erro} /> : <Aviso>{erro}</Aviso>;
  if (!d) return <div className="adm-card"><p style={{ margin: 0, color: 'var(--sub)' }}>Carregando…</p></div>;

  return (
    <div className="ix">
      <style dangerouslySetInnerHTML={{ __html: V3_CSS + CSS }} />
      <h1 className="adm-h">Indicações</h1>
      <p className="adm-sub">Comprador indica amigo pelo link pessoal; quando o amigo novo faz a primeira compra paga, quem indicou ganha CB Points depois do prazo de liberação.</p>
      {!d.sql37 && <Aviso><b>Falta rodar o SQL 37 (INDICACOES).</b> Sem ele os links funcionam como rastreio, mas nenhuma indicação é registrada.</Aviso>}

      <div className="adm-card">
        <h3 className="adm-ct">Regras da recompensa</h3>
        <label className="ix-sw"><input type="checkbox" checked={cfg.ativo} onChange={(e) => set('ativo', e.target.checked)} /> <b>Programa ligado</b></label>
        <div className="ix-campos">
          <label>Pontos por indicação convertida<input type="number" min={0} value={cfg.pontos} onChange={(e) => set('pontos', Number(e.target.value))} /></label>
          <label>Compra mínima do amigo (R$)<input type="number" min={0} step="0.01" value={cfg.minimo} onChange={(e) => set('minimo', Number(e.target.value))} /></label>
          <label>Liberar os pontos depois de (dias)<input type="number" min={0} max={90} value={cfg.prazoDias} onChange={(e) => set('prazoDias', Number(e.target.value))} /></label>
          <label>Limite de recompensas por pessoa (0 = sem limite)<input type="number" min={0} value={cfg.limitePorUsuario} onChange={(e) => set('limitePorUsuario', Number(e.target.value))} /></label>
          <label>Campanha começa<input type="datetime-local" value={paraCampo(cfg.inicio)} onChange={(e) => set('inicio', doCampo(e.target.value))} /></label>
          <label>Campanha termina<input type="datetime-local" value={paraCampo(cfg.fim)} onChange={(e) => set('fim', doCampo(e.target.value))} /></label>
          <label>Produtos que valem<select value={cfg.produtos} onChange={(e) => set('produtos', e.target.value)}><option value="todos">Todos</option><option value="lista">Só os IDs da lista</option></select></label>
          <label>Alerta: cadastros por código em 24 h<input type="number" min={1} value={cfg.alertaCadastrosDia} onChange={(e) => set('alertaCadastrosDia', Number(e.target.value))} /></label>
          {cfg.produtos === 'lista' && <label className="lg">IDs dos produtos (um por linha)<textarea rows={3} value={(cfg.produtosIds || []).join('\n')} onChange={(e) => set('produtosIds', e.target.value.split(/\s+/).filter(Boolean))} /></label>}
        </div>
        <p className="ix-nota">Sugestão de prazo: igual ou maior que a garantia mais longa dos produtos, para o ponto só sair depois que o reembolso não for mais possível. Pontos são custo da plataforma: confira o valor do ponto em CB Points antes de ligar.</p>
        <button className="adm-btn" onClick={salvarCfg} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar regras'}</button>
      </div>

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
.ix-sw{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.ix-campos{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.ix-campos .lg{grid-column:1/-1}
.ix-campos label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--sub)}
.ix-campos input,.ix-campos select,.ix-campos textarea{min-height:38px;border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:14px;color:var(--ink)}
.ix-nota{color:var(--sub);font-size:12px;line-height:1.5;margin:10px 0}
.ix-filtros{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.ix-filtros button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;font-weight:700;font-size:12.5px;cursor:pointer}
.ix-filtros button.on{background:#0B0B0C;color:#fff;border-color:#0B0B0C}
.ix-tab{overflow-x:auto}.ix-tab table{width:100%;border-collapse:collapse;font-size:13px;min-width:820px}
.ix-tab th{text-align:left;font-size:11.5px;text-transform:uppercase;color:var(--sub);padding:8px;border-bottom:1px solid var(--line)}
.ix-tab td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}.ix-tab td small{display:block;color:var(--sub);font-size:11.5px}
.ix-alerta{color:#B45309!important;font-weight:700}
.ix-st{font-size:11.5px;font-weight:800;border-radius:999px;padding:3px 9px;background:#F4F4F5;white-space:nowrap}
.ix-st.s-pendente{background:#FFF1E6;color:#B45309}.ix-st.s-liberada{background:#E8F7EE;color:#15803D}.ix-st.s-bloqueada{background:#FEF3C7;color:#92400E}.ix-st.s-estornada,.ix-st.s-cancelada{background:#FEE2E2;color:#B91C1C}
.ix-acoes{display:flex;flex-direction:column;gap:4px}.ix-acoes button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer;white-space:nowrap}
@media(max-width:700px){.ix-campos{grid-template-columns:1fr}}
`;
