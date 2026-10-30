'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIAS, rotuloCategoria, valorNoMes, csvMes, type Custo, type MesFin, type ConfigFin } from '@/lib/financeiro';

// Admin › Financeiro: receita da plataforma (automática, só o que é dela), custos lançados, imposto e resultado.
// O dinheiro dos vendedores aparece separado ("de terceiros"), nunca como faturamento.
type Painel = { sql27: boolean; cfg: ConfigFin; meses: MesFin[]; acumulado: { receita: number; custos: number; resultado: number; gmv: number; lancados: number }; custos: Custo[]; custodia: number; fixoMensal: number; gastoTotal: number };

const brl = (v: number) => (v < 0 ? '−' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string, ano = true) => `${MESES[Number(m.slice(5)) - 1]}${ano ? `/${m.slice(2, 4)}` : ''}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const VAZIO = { id: 0, descricao: '', categoria: 'infraestrutura', valor: '', tipo: 'mensal', data: hoje(), fim: '', pago_por: 'Empresa', observacao: '' };

export default function FinanceiroPainel() {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState('');
  const [mes, setMes] = useState('');
  const [form, setForm] = useState<typeof VAZIO | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ajustes, setAjustes] = useState<Record<string, string> | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/financeiro', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setP(j); setMes((m) => m || j.meses[j.meses.length - 1].mes);
    } catch (e: any) { setErro(e?.message || 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const atual = useMemo(() => p?.meses.find((m) => m.mes === mes) ?? null, [p, mes]);
  const doMes = useMemo(() => (p && atual ? p.custos.filter((c) => valorNoMes(c, atual.mes) > 0) : []), [p, atual]);
  const recorrentes = useMemo(() => (p ? p.custos.filter((c) => c.tipo !== 'avulso' && (!c.fim || c.fim >= hoje())) : []), [p]);
  const max = useMemo(() => Math.max(1, ...(p?.meses ?? []).flatMap((m) => [m.receita.total, m.custoTotal])), [p]);

  async function subir(f: File): Promise<{ path: string; nome: string }> {
    const r = await fetch('/api/admin/financeiro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'upload', tipo: f.type, tamanho: f.size }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.path) throw new Error(d.error || 'Não foi possível enviar o comprovante.');
    const { error } = await createClient().storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, f, { contentType: f.type });
    if (error) throw new Error('Não foi possível enviar o comprovante.');
    return { path: d.path, nome: f.name };
  }

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    try {
      const comprovante = arquivo ? await subir(arquivo) : null;
      const r = await fetch('/api/admin/financeiro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, acao: form.id ? 'editar' : 'criar', fim: form.fim || null, comprovante }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível salvar.');
      toast(form.id ? 'Custo atualizado.' : 'Custo lançado.', 'success');
      setForm(null); setArquivo(null); carregar();
    } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'error'); }
    finally { setSalvando(false); }
  }

  async function acao(corpo: any, ok: string, pergunta?: string) {
    if (pergunta && !confirm(pergunta)) return;
    const r = await fetch('/api/admin/financeiro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || 'Não foi possível salvar.', 'error'); return; }
    toast(ok, 'success'); carregar();
  }

  function exportar() {
    if (!p || !atual) return;
    const blob = new Blob(['﻿' + csvMes(atual, p.custos)], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `financeiro-compreibarato-${atual.mes}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  if (erro) return <div className="adm-card">{erro}</div>;
  if (!p || !atual) return <div className="adm-card" style={{ color: 'var(--sub)' }}>Carregando o financeiro…</div>;
  const res = atual.resultado;

  return (
    <div className="fin">
      <style dangerouslySetInnerHTML={{ __html: `
        .fin{--rec:#E8660A;--cus:#5A7AF5}
        .adm.light .fin{--cus:#4A6CF0}
        .fin-meses{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px}
        .fin-m{border:1px solid var(--bd2);background:var(--panel2);color:var(--sub);border-radius:50px;padding:6px 12px;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap}
        .fin-m.on{background:var(--tx);color:var(--panel);border-color:var(--tx)}
        .fin-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:12px}
        .fin-k{background:var(--panel);border:1px solid var(--bd2);border-radius:16px;padding:14px 16px}
        .fin-k small{display:block;color:var(--sub);font-size:12px;font-weight:700}
        .fin-k b{display:block;font-family:Outfit;font-size:22px;font-weight:900;margin-top:4px;font-variant-numeric:tabular-nums}
        .fin-k span{display:block;color:var(--sub);font-size:11.5px;margin-top:3px;line-height:1.4}
        .fin-k.sec b{font-size:17px}
        .fin-g{display:flex;align-items:flex-end;gap:6px;height:150px;padding:8px 0 0;border-bottom:1px solid var(--bd2)}
        .fin-c{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:2px;height:100%;cursor:pointer;border-radius:8px;position:relative}
        .fin-c:hover,.fin-c.on{background:var(--panel2)}
        .fin-c i{display:block;width:38%;max-width:16px;border-radius:4px 4px 0 0;min-height:2px}
        .fin-c .tip{display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--tx);color:var(--panel);font-size:11.5px;padding:6px 9px;border-radius:8px;white-space:nowrap;z-index:2;font-style:normal;line-height:1.5}
        .fin-c:hover .tip{display:block}
        .fin-ls{display:flex;gap:6px}
        .fin-ls span{flex:1;text-align:center;font-size:10.5px;color:var(--sub);font-weight:700;padding-top:4px}
        .fin-leg{display:flex;gap:14px;font-size:12px;color:var(--sub);font-weight:700;margin-bottom:4px}
        .fin-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
        .fin-tab{width:100%;border-collapse:collapse;font-size:13.5px}
        .fin-tab td{padding:8px 4px;border-top:1px solid var(--bd2);vertical-align:top}
        .fin-tab td.v{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:800}
        .fin-tab small{display:block;color:var(--sub);font-size:11.5px}
        .fin-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
        .fin-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
        .fin-form label{display:block;font-size:12px;font-weight:800;color:var(--sub);margin-bottom:4px}
        .fin-form input,.fin-form select{width:100%;height:40px;border-radius:10px;border:1px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 10px;font-size:16px}
        .fin-aviso{font-size:12.5px;color:var(--sub);line-height:1.5;margin:0}
        .fin-lk{background:none;border:0;color:var(--or2);font-weight:800;cursor:pointer;font-size:12.5px;padding:0}
      ` }} />

      {!p.sql27 && <div className="adm-card" style={{ marginBottom: 12, borderColor: '#F5B83D' }}>Falta rodar o <b>SQL 27</b> para lançar custos. A receita automática já aparece.</div>}

      <div className="fin-meses" role="tablist" aria-label="Mês">
        {p.meses.slice().reverse().map((m) => <button key={m.mes} type="button" role="tab" aria-selected={m.mes === mes} className={`fin-m ${m.mes === mes ? 'on' : ''}`} onClick={() => setMes(m.mes)}>{nomeMes(m.mes)}</button>)}
      </div>

      <div className="fin-kpis">
        <div className="fin-k"><small>Receita da plataforma</small><b>{brl(atual.receita.total)}</b><span>Só o que é do Comprei Barato</span></div>
        <div className="fin-k"><small>Custos</small><b>{brl(atual.custoTotal)}</b><span>Lançados {brl(atual.custosLancados)} · tarifas {brl(atual.gatewayAuto)}</span></div>
        <div className="fin-k"><small>Imposto {atual.imposto.real ? '(DAS lançado)' : `(estimado ${p.cfg.aliquotaDas}%)`}</small><b>{brl(atual.imposto.usado)}</b><span>{atual.imposto.real ? 'Valor real do mês' : 'Lance o DAS real em Impostos para substituir'}</span></div>
        <div className="fin-k"><small>Resultado do mês</small><b style={{ color: res >= 0 ? '#3DDC97' : '#FF5C5C' }}>{brl(res)}</b><span>{res >= 0 ? 'Lucro' : 'Prejuízo'} · receita − custos − imposto</span></div>
      </div>
      <div className="fin-kpis">
        <div className="fin-k sec"><small>Vendido pelos lojistas</small><b>{brl(atual.gmv)}</b><span>Dinheiro de terceiros, não é faturamento · {atual.pedidos} pedidos</span></div>
        <div className="fin-k sec"><small>Em custódia (a repassar)</small><b>{brl(p.custodia)}</b><span>Saldo dos vendedores ainda não sacado</span></div>
        <div className="fin-k sec"><small>Custo fixo por mês</small><b>{brl(p.fixoMensal)}</b><span>Assinaturas ativas (as anuais divididas por 12)</span></div>
        <div className="fin-k sec"><small>Gasto desde o início</small><b>{brl(p.gastoTotal)}</b><span>Tudo que foi lançado até hoje</span></div>
      </div>

      <div className="adm-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h3 className="adm-ct" style={{ margin: 0 }}>Últimos 12 meses</h3>
          <div className="fin-leg"><span><i style={{ background: 'var(--rec)' }} />Receita</span><span><i style={{ background: 'var(--cus)' }} />Custos</span></div>
        </div>
        <div className="fin-g" role="img" aria-label="Receita e custos por mês nos últimos 12 meses">
          {p.meses.map((m) => (
            <div key={m.mes} className={`fin-c ${m.mes === mes ? 'on' : ''}`} onClick={() => setMes(m.mes)}>
              <i style={{ height: `${(m.receita.total / max) * 100}%`, background: 'var(--rec)' }} />
              <i style={{ height: `${(m.custoTotal / max) * 100}%`, background: 'var(--cus)' }} />
              <em className="tip">{nomeMes(m.mes)} · Receita {brl(m.receita.total)}<br />Custos {brl(m.custoTotal)} · Resultado {brl(m.resultado)}</em>
            </div>
          ))}
        </div>
        <div className="fin-ls">{p.meses.map((m) => <span key={m.mes}>{nomeMes(m.mes, false)}</span>)}</div>
        <p className="fin-aviso" style={{ marginTop: 10 }}>Acumulado em 12 meses: receita {brl(p.acumulado.receita)} · custos {brl(p.acumulado.custos)} · resultado <b>{brl(p.acumulado.resultado)}</b>. Vendido pelos lojistas no período: {brl(p.acumulado.gmv)}.</p>
      </div>

      <div className="fin-2" style={{ marginBottom: 12 }}>
        <div className="adm-card">
          <h3 className="adm-ct">Receita de {nomeMes(atual.mes)}</h3>
          <table className="fin-tab"><tbody>
            <tr><td>Comissões dos planos<small>Parte da plataforma em cada venda</small></td><td className="v">{brl(atual.receita.comissao)}</td></tr>
            <tr><td>Taxa de serviço do comprador<small>Pix e cartão</small></td><td className="v">{brl(atual.receita.taxaComprador)}</td></tr>
            <tr><td>Saques extras</td><td className="v">{brl(atual.receita.saques)}</td></tr>
            <tr><td>Destaques pagos</td><td className="v">{brl(atual.receita.destaques)}</td></tr>
            <tr><td><b>Total</b></td><td className="v">{brl(atual.receita.total)}</td></tr>
          </tbody></table>
        </div>
        <div className="adm-card">
          <h3 className="adm-ct">Custos de {nomeMes(atual.mes)}</h3>
          <table className="fin-tab"><tbody>
            <tr><td>Tarifas de pagamento<small>Calculadas por pedido e saque (ajuste em Ajustes)</small></td><td className="v">{brl(atual.gatewayAuto)}</td></tr>
            {Object.entries(atual.porCategoria).sort((a, b) => b[1] - a[1]).map(([c, v]) => <tr key={c}><td>{rotuloCategoria(c)}</td><td className="v">{brl(v)}</td></tr>)}
            <tr><td>Imposto<small>{atual.imposto.real ? 'DAS lançado' : `Estimado em ${p.cfg.aliquotaDas}% da receita`}</small></td><td className="v">{brl(atual.imposto.usado)}</td></tr>
            <tr><td><b>Total</b></td><td className="v">{brl(atual.custoTotal)}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="adm-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          <h3 className="adm-ct" style={{ margin: 0 }}>Lançamentos de {nomeMes(atual.mes)}</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="adm-btn rp" onClick={exportar}>Planilha para a contadora</button>
            {p.sql27 && <button type="button" className="adm-btn ap" onClick={() => { setForm({ ...VAZIO, data: atual.mes === hoje().slice(0, 7) ? hoje() : `${atual.mes}-01` }); setArquivo(null); }}>+ Lançar custo</button>}
          </div>
        </div>

        {form && (
          <div style={{ border: '1px solid var(--bd2)', borderRadius: 14, padding: 14, margin: '10px 0 14px' }}>
            <div className="fin-form">
              <div style={{ gridColumn: '1 / -1' }}><label htmlFor="fd">O que foi</label><input id="fd" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Vercel, Supabase, Contadora, Anúncio Meta" maxLength={120} /></div>
              <div><label htmlFor="fc">Categoria</label><select id="fc" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}</select></div>
              <div><label htmlFor="fv">Valor (R$)</label><input id="fv" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" /></div>
              <div><label htmlFor="ft">Frequência</label><select id="ft" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="avulso">Uma vez</option><option value="mensal">Todo mês</option><option value="anual">Todo ano</option></select></div>
              <div><label htmlFor="fdt">{form.tipo === 'avulso' ? 'Data do gasto' : 'Começou em'}</label><input id="fdt" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              {form.tipo !== 'avulso' && <div><label htmlFor="ff">Terminou em (opcional)</label><input id="ff" type="date" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} /></div>}
              <div><label htmlFor="fp">Quem pagou</label><input id="fp" list="fin-quem" value={form.pago_por} onChange={(e) => setForm({ ...form, pago_por: e.target.value })} maxLength={40} /><datalist id="fin-quem"><option value="Empresa" /><option value="Carlos" /><option value="César" /></datalist></div>
              <div style={{ gridColumn: '1 / -1' }}><label htmlFor="fo">Observação (opcional)</label><input id="fo" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} maxLength={300} placeholder="Ex.: plano Pro, nota 123" /></div>
              <div style={{ gridColumn: '1 / -1' }}><label htmlFor="fa">Comprovante (imagem ou PDF, opcional)</label><input id="fa" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} style={{ height: 'auto', padding: 8 }} /></div>
            </div>
            {form.categoria === 'impostos' && <p className="fin-aviso" style={{ marginTop: 8 }}>O DAS lançado aqui substitui a estimativa de imposto do mês.</p>}
            {form.pago_por && form.pago_por !== 'Empresa' && <p className="fin-aviso" style={{ marginTop: 8 }}>Pago do bolso de {form.pago_por}: fica registrado para a contadora tratar como aporte ou reembolso.</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="adm-btn ap" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : form.id ? 'Salvar alterações' : 'Lançar'}</button>
              <button type="button" className="adm-btn rp" onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {doMes.length ? (
          <table className="fin-tab"><tbody>
            {doMes.map((c) => (
              <tr key={c.id}>
                <td>{c.descricao}<small>{rotuloCategoria(c.categoria)}{c.tipo !== 'avulso' ? ` · ${c.tipo === 'mensal' ? 'todo mês' : 'todo ano'}` : ` · ${c.data.split('-').reverse().join('/')}`}{c.pago_por ? ` · pago por ${c.pago_por}` : ''}{c.observacao ? ` · ${c.observacao}` : ''}</small>
                  <span style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    {c.tem_comprovante && <a className="fin-lk" href={`/api/admin/financeiro?comprovante=${c.id}`} target="_blank" rel="noreferrer">Comprovante</a>}
                    <button type="button" className="fin-lk" onClick={() => { setForm({ id: c.id, descricao: c.descricao, categoria: c.categoria, valor: String(c.valor).replace('.', ','), tipo: c.tipo, data: c.data, fim: c.fim || '', pago_por: c.pago_por || '', observacao: c.observacao || '' }); setArquivo(null); }}>Editar</button>
                    <button type="button" className="fin-lk" style={{ color: '#FF5C5C' }} onClick={() => acao({ acao: 'excluir', id: c.id }, 'Custo excluído.', `Excluir "${c.descricao}"${c.tipo !== 'avulso' ? ' de todos os meses' : ''}? Se só cancelou a assinatura, use "Encerrar" em Assinaturas ativas.`)}>Excluir</button>
                  </span>
                </td>
                <td className="v">{brl(valorNoMes(c, atual.mes))}</td>
              </tr>
            ))}
          </tbody></table>
        ) : <p className="fin-aviso">Nenhum custo lançado neste mês.{p.sql27 ? ' Comece pelos fixos: Vercel, Supabase, servidor do WhatsApp, domínio e contadora.' : ''}</p>}
      </div>

      <div className="fin-2">
        <div className="adm-card">
          <h3 className="adm-ct">Assinaturas ativas</h3>
          {recorrentes.length ? (
            <table className="fin-tab"><tbody>
              {(verTodos ? recorrentes : recorrentes.slice(0, 8)).map((c) => (
                <tr key={c.id}><td>{c.descricao}<small>{c.tipo === 'mensal' ? 'Todo mês' : 'Todo ano'} desde {c.data.split('-').reverse().join('/')}{c.fim ? ` · termina ${c.fim.split('-').reverse().join('/')}` : ''}</small>
                  <button type="button" className="fin-lk" style={{ marginTop: 4 }} onClick={() => acao({ acao: 'encerrar', id: c.id, fim: hoje() }, 'Assinatura encerrada a partir de hoje.', `Encerrar "${c.descricao}" a partir de hoje? O histórico dos meses anteriores continua.`)}>Encerrar</button></td>
                  <td className="v">{brl(c.valor)}</td></tr>
              ))}
            </tbody></table>
          ) : <p className="fin-aviso">Nenhuma assinatura lançada.</p>}
          {recorrentes.length > 8 && <button type="button" className="fin-lk" onClick={() => setVerTodos((v) => !v)}>{verTodos ? 'Ver menos' : `Ver todas (${recorrentes.length})`}</button>}
        </div>

        <div className="adm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="adm-ct" style={{ margin: 0 }}>Ajustes das contas</h3>
            <button type="button" className="fin-lk" onClick={() => setAjustes(ajustes ? null : { custoPixPct: String(p.cfg.custoPixPct ?? 0), custoPixEntrada: String(p.cfg.custoPixEntrada), custoPixSaida: String(p.cfg.custoPixSaida), custoCartaoPct: String(p.cfg.custoCartaoPct), custoCartaoFixo: String(p.cfg.custoCartaoFixo), aliquotaDas: String(p.cfg.aliquotaDas) })}>{ajustes ? 'Fechar' : 'Editar'}</button>
          </div>
          {!ajustes ? (
            <p className="fin-aviso" style={{ marginTop: 8 }}>Pix recebido: {(p.cfg.custoPixPct || 0) > 0 ? `${String(p.cfg.custoPixPct).replace('.', ',')}% + ` : ''}{brl(p.cfg.custoPixEntrada)} · saque (Pix enviado): {brl(p.cfg.custoPixSaida)} · cartão: {String(p.cfg.custoCartaoPct).replace('.', ',')}% + {brl(p.cfg.custoCartaoFixo)} · DAS estimado: {String(p.cfg.aliquotaDas).replace('.', ',')}% da receita. Confira as tarifas no contrato da MisticPay e da Stripe e a alíquota com a contadora.</p>
          ) : (
            <>
              <div className="fin-form" style={{ marginTop: 10 }}>
                {([['custoPixPct', 'Tarifa por Pix recebido (%)'], ['custoPixEntrada', 'Tarifa por Pix recebido (R$)'], ['custoPixSaida', 'Tarifa por saque pago (R$)'], ['custoCartaoPct', 'Cartão (%)'], ['custoCartaoFixo', 'Cartão fixo (R$)'], ['aliquotaDas', 'Alíquota do DAS (%)']] as const).map(([k, l]) => (
                  <div key={k}><label htmlFor={`aj-${k}`}>{l}</label><input id={`aj-${k}`} inputMode="decimal" value={ajustes[k]} onChange={(e) => setAjustes({ ...ajustes, [k]: e.target.value })} /></div>
                ))}
              </div>
              <button type="button" className="adm-btn ap" style={{ marginTop: 10 }} onClick={() => { const n = (x: string) => Number(String(x).replace(',', '.')); acao({ acao: 'ajustes', custoPixPct: n(ajustes.custoPixPct), custoPixEntrada: n(ajustes.custoPixEntrada), custoPixSaida: n(ajustes.custoPixSaida), custoCartaoPct: n(ajustes.custoCartaoPct), custoCartaoFixo: n(ajustes.custoCartaoFixo), aliquotaDas: n(ajustes.aliquotaDas) }, 'Ajustes salvos.'); setAjustes(null); }}>Salvar ajustes</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
