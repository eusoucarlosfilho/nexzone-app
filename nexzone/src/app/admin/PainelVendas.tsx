'use client';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import {
  PRESETS, type PresetId, type Periodo, type Agrupamento, type Filtro, type VendaDash, type ExtraDash,
  periodoDoPreset, periodoDoMes, periodoPersonalizado, periodoAnterior, agrupamentoAutomatico, diasDoPeriodo,
  resumir, variacao, serie, mesAMes, ranking, quandoVende, somaExtras, contarNoPeriodo, mesesDisponiveis, csvVendas, somarDias,
} from '@/lib/dashboardVendas';

// Dashboard do admin: período (padrão 30 dias), mês fechado, datas livres, loja e forma de pagamento.
// Tudo calculado aqui no navegador a partir dos pedidos que o servidor já carrega para o painel.

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (v: number) => (v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1).replace('.', ',')} mi` : v >= 1e4 ? `R$ ${(v / 1e3).toFixed(1).replace('.', ',')} mil` : brl(v));
const num = (v: number) => v.toLocaleString('pt-BR');
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0).replace('.', ',')}%`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dataBR = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

type Props = {
  vendas: VendaDash[];
  destaques: ExtraDash[];
  saques: ExtraDash[];
  cadastros: string[];
  lojasCriadas: string[];
  nomes: { lojas: Record<string, string>; produtos: Record<string, string> };
  comissao: number;
  temForma: boolean;   // SQL 17 aplicado (forma_pagamento existe)
};

function Delta({ atual, anterior, inverso = false }: { atual: number; anterior: number; inverso?: boolean }) {
  const v = variacao(atual, anterior);
  if (v === null) return <span className="pv-d nv">novo</span>;
  if (Math.abs(v) < 0.5) return <span className="pv-d eq">= anterior</span>;
  const bom = inverso ? v < 0 : v > 0;
  return <span className={`pv-d ${bom ? 'up' : 'dn'}`}>{v > 0 ? '▲' : '▼'} {Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0).replace('.', ',')}%</span>;
}

export default function PainelVendas({ vendas, destaques, saques, cadastros, lojasCriadas, nomes, comissao, temForma }: Props) {
  const [pronto, setPronto] = useState(false);   // datas dependem do fuso do navegador: calcula só depois de abrir
  const [preset, setPreset] = useState<PresetId | 'mesx' | 'livre'>('30d');
  const [mesEscolhido, setMesEscolhido] = useState('');
  const [livreDe, setLivreDe] = useState('');
  const [livreAte, setLivreAte] = useState('');
  const [loja, setLoja] = useState('todas');
  const [forma, setForma] = useState<Filtro['forma']>('todas');
  const [agrup, setAgrup] = useState<Agrupamento | 'auto'>('auto');
  const [metrica, setMetrica] = useState<'total' | 'receita' | 'vendas'>('total');
  const [foco, setFoco] = useState<number | null>(null);
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    const a = new Date(); setAgora(a); setPronto(true);
    setLivreDe(iso(somarDias(a, -29))); setLivreAte(iso(a));
    try { const s = JSON.parse(localStorage.getItem('cb_admin_dash') || '{}'); if (s.metrica) setMetrica(s.metrica); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('cb_admin_dash', JSON.stringify({ metrica })); } catch {} }, [metrica]);

  const primeira = useMemo(() => vendas.reduce<Date | undefined>((m, v) => { const d = new Date(v.c); return !m || d < m ? d : m; }, undefined), [vendas]);
  const meses = useMemo(() => (agora ? mesesDisponiveis(vendas, agora) : []), [vendas, agora]);

  const periodo: Periodo | null = useMemo(() => {
    if (!agora) return null;
    if (preset === 'mesx') return periodoDoMes(mesEscolhido) ?? periodoDoPreset('mes', agora);
    if (preset === 'livre') return periodoPersonalizado(livreDe, livreAte) ?? periodoDoPreset('30d', agora);
    return periodoDoPreset(preset, agora, primeira);
  }, [agora, preset, mesEscolhido, livreDe, livreAte, primeira]);

  const filtro: Filtro = { loja, forma };
  const dados = useMemo(() => {
    if (!periodo || !agora) return null;
    const ant = periodoAnterior(periodo);
    const g: Agrupamento = agrup === 'auto' ? agrupamentoAutomatico(periodo) : agrup;
    return {
      ant, g,
      r: resumir(vendas, periodo, filtro),
      ra: resumir(vendas, ant, filtro),
      serie: serie(vendas, periodo, g, filtro),
      meses: mesAMes(vendas, agora, filtro, 12),
      lojas: ranking(vendas, periodo, filtro, 'l', 10),
      produtos: ranking(vendas, periodo, filtro, 'd', 10),
      quando: quandoVende(vendas, periodo, filtro),
      dest: somaExtras(destaques, periodo, 'pago'), destA: somaExtras(destaques, ant, 'pago'),
      saq: somaExtras(saques, periodo, 'pago'),
      cad: contarNoPeriodo(cadastros, periodo), cadA: contarNoPeriodo(cadastros, ant),
      lojasN: contarNoPeriodo(lojasCriadas, periodo),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendas, destaques, saques, cadastros, lojasCriadas, periodo, agora, agrup, loja, forma]);

  function baixarCsv() {
    if (!periodo) return;
    const blob = new Blob([csvVendas(vendas, periodo, filtro, nomes)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vendas_${iso(periodo.de)}_a_${iso(somarDias(periodo.ate, -1))}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const lojasOrdenadas = useMemo(() => Object.entries(nomes.lojas).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')), [nomes.lojas]);

  if (!pronto || !periodo || !dados) {
    return <div className="adm-card pv-carregando">Carregando o painel…</div>;
  }
  const { r, ra } = dados;
  const valorDe = (b: any) => (metrica === 'vendas' ? b.vendas : metrica === 'receita' ? b.receita : b.total);
  const maxSerie = Math.max(1, ...dados.serie.map(valorDe));
  const passoRotulo = Math.max(1, Math.ceil(dados.serie.length / 12));
  const passoCelular = Math.max(1, Math.ceil(dados.serie.length / 5));
  const totalForma = r.pix.valor + r.cartao.valor + r.semForma.valor;
  const maxSemana = Math.max(1, ...dados.quando.semana.map((d) => d.faturamento));
  const maxHora = Math.max(1, ...dados.quando.horas.map((d) => d.vendas));
  const fimPeriodo = somarDias(periodo.ate, -1);
  const textoPeriodo = diasDoPeriodo(periodo) === 1 ? dataBR(periodo.de) : `${dataBR(periodo.de)} – ${dataBR(fimPeriodo)}`;
  const textoAnterior = `${dataBR(dados.ant.de)} – ${dataBR(somarDias(dados.ant.ate, -1))}`;
  const melhorDia = [...dados.quando.semana].sort((a, b) => b.faturamento - a.faturamento)[0];
  const melhorHora = [...dados.quando.horas].sort((a, b) => b.vendas - a.vendas)[0];
  const b = foco !== null ? dados.serie[foco] : null;

  return (
    <div className="pv">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ---------- filtros ---------- */}
      <div className="adm-card pv-filtros">
        <div className="pv-chips" role="group" aria-label="Período">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={`adm-fb ${preset === p.id ? 'on' : ''}`} onClick={() => setPreset(p.id)}>{p.rotulo}</button>
          ))}
          <button type="button" className={`adm-fb ${preset === 'livre' ? 'on' : ''}`} onClick={() => setPreset('livre')}><Icon name="calendar" size={14} /> Datas</button>
        </div>
        <div className="pv-linha">
          <label className="pv-campo">
            <span>Mês</span>
            <select value={preset === 'mesx' ? mesEscolhido : ''} onChange={(e) => { if (e.target.value) { setMesEscolhido(e.target.value); setPreset('mesx'); } }}>
              <option value="">Escolher mês…</option>
              {meses.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
            </select>
          </label>
          {preset === 'livre' && (
            <>
              <label className="pv-campo"><span>De</span><input type="date" value={livreDe} max={livreAte || undefined} onChange={(e) => setLivreDe(e.target.value)} /></label>
              <label className="pv-campo"><span>Até</span><input type="date" value={livreAte} min={livreDe || undefined} onChange={(e) => setLivreAte(e.target.value)} /></label>
            </>
          )}
          <label className="pv-campo">
            <span>Loja</span>
            <select value={loja} onChange={(e) => setLoja(e.target.value)}>
              <option value="todas">Todas as lojas</option>
              {lojasOrdenadas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </label>
          <label className="pv-campo">
            <span>Pagamento</span>
            <select value={forma} onChange={(e) => setForma(e.target.value as Filtro['forma'])}>
              <option value="todas">Pix e cartão</option>
              <option value="pix">Só Pix</option>
              <option value="cartao">Só cartão</option>
            </select>
          </label>
          <button type="button" className="adm-btn rp pv-csv" onClick={baixarCsv} disabled={!r.vendas}><Icon name="download" size={15} /> Baixar CSV</button>
        </div>
        <div className="pv-info">
          <b>{textoPeriodo}</b> · comparando com {textoAnterior}
          {(loja !== 'todas' || forma !== 'todas') && <> · <button type="button" className="pv-limpar" onClick={() => { setLoja('todas'); setForma('todas'); }}>limpar filtros</button></>}
        </div>
      </div>

      {/* ---------- números principais ---------- */}
      <div className="pv-kpis">
        <div className="pv-k destaque">
          <small>Faturamento (vendas pagas)</small><b>{brl(r.faturamento)}</b>
          <Delta atual={r.faturamento} anterior={ra.faturamento} /><em>antes: {brl(ra.faturamento)}</em>
        </div>
        <div className="pv-k">
          <small>Sua receita (comissão {String(comissao).replace('.', ',')}%)</small><b>{brl(r.receita)}</b>
          <Delta atual={r.receita} anterior={ra.receita} /><em>+ destaques: {brl(dados.dest.valor)}</em>
        </div>
        <div className="pv-k">
          <small>Vendas pagas</small><b>{num(r.vendas)}</b>
          <Delta atual={r.vendas} anterior={ra.vendas} /><em>{num(r.compradores)} comprador{r.compradores === 1 ? '' : 'es'} · {num(r.compradoresNovos)} novo{r.compradoresNovos === 1 ? '' : 's'}</em>
        </div>
        <div className="pv-k">
          <small>Ticket médio</small><b>{brl(r.ticket)}</b>
          <Delta atual={r.ticket} anterior={ra.ticket} /><em>antes: {brl(ra.ticket)}</em>
        </div>
      </div>

      <div className="pv-grid2">
        {/* Pix x cartão */}
        <div className="adm-card">
          <h3 className="adm-ct">Como entrou o dinheiro</h3>
          <div className="pv-barra" aria-hidden="true">
            {totalForma > 0 ? (
              <>
                <i className="pv-pix" style={{ width: `${(r.pix.valor / totalForma) * 100}%` }} />
                <i className="pv-car" style={{ width: `${(r.cartao.valor / totalForma) * 100}%` }} />
                <i className="pv-out" style={{ width: `${(r.semForma.valor / totalForma) * 100}%` }} />
              </>
            ) : <i className="pv-vaz" style={{ width: '100%' }} />}
          </div>
          <div className="pv-formas">
            <div><span className="pt pv-pix" /> <b>Pix</b><strong>{brl(r.pix.valor)}</strong><small>{num(r.pix.qtd)} venda{r.pix.qtd === 1 ? '' : 's'} · {totalForma ? pct(r.pix.valor / totalForma) : '0%'}</small><Delta atual={r.pix.valor} anterior={ra.pix.valor} /></div>
            <div><span className="pt pv-car" /> <b>Cartão</b><strong>{brl(r.cartao.valor)}</strong><small>{num(r.cartao.qtd)} venda{r.cartao.qtd === 1 ? '' : 's'} · {totalForma ? pct(r.cartao.valor / totalForma) : '0%'}</small><Delta atual={r.cartao.valor} anterior={ra.cartao.valor} /></div>
            {r.semForma.qtd > 0 && (
              <div><span className="pt pv-out" /> <b>Não identificado</b><strong>{brl(r.semForma.valor)}</strong><small>{num(r.semForma.qtd)} venda{r.semForma.qtd === 1 ? '' : 's'} anteriores ao registro da forma de pagamento</small></div>
            )}
          </div>
          {!temForma && <p className="pv-nota">Rode o SQL 17 para o site começar a registrar se cada venda foi no Pix ou no cartão.</p>}
        </div>

        {/* Saúde do funil */}
        <div className="adm-card">
          <h3 className="adm-ct">Funil e operação</h3>
          <div className="pv-mini">
            <div><small>Pedidos criados</small><b>{num(r.pedidosCriados)}</b><Delta atual={r.pedidosCriados} anterior={ra.pedidosCriados} /></div>
            <div><small>Conversão (pagos ÷ criados)</small><b>{pct(r.conversao)}</b><Delta atual={r.conversao} anterior={ra.conversao} /></div>
            <div><small>Aguardando pagamento</small><b>{num(r.pendentes.qtd)}</b><em>{brl(r.pendentes.valor)} na mesa</em></div>
            <div><small>Reembolsos</small><b>{num(r.reembolsos.qtd)}</b><em>{brl(r.reembolsos.valor)}</em></div>
            <div><small>Repasse aos vendedores</small><b>{brlCurto(r.repasse)}</b><em>saques pagos: {brl(dados.saq.valor)}</em></div>
            <div><small>Novos cadastros</small><b>{num(dados.cad)}</b><Delta atual={dados.cad} anterior={dados.cadA} /></div>
            <div><small>Novas lojas</small><b>{num(dados.lojasN)}</b></div>
            <div><small>Destaques vendidos</small><b>{num(dados.dest.qtd)}</b><em>{brl(dados.dest.valor)}</em></div>
          </div>
        </div>
      </div>

      {/* ---------- gráfico ---------- */}
      <div className="adm-card">
        <div className="pv-cab">
          <h3 className="adm-ct" style={{ margin: 0 }}>{metrica === 'vendas' ? 'Vendas' : metrica === 'receita' ? 'Sua receita' : 'Faturamento'} por {dados.g === 'dia' ? 'dia' : dados.g === 'semana' ? 'semana' : 'mês'}</h3>
          <div className="pv-tog">
            {([['total', 'Faturamento'], ['receita', 'Receita'], ['vendas', 'Nº de vendas']] as const).map(([k, l]) => (
              <button key={k} type="button" className={metrica === k ? 'on' : ''} onClick={() => setMetrica(k)}>{l}</button>
            ))}
          </div>
          <div className="pv-tog">
            {([['auto', 'Auto'], ['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']] as const).map(([k, l]) => (
              <button key={k} type="button" className={agrup === k ? 'on' : ''} onClick={() => setAgrup(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="pv-leg">
          {metrica === 'total' ? <><span><i className="pt pv-pix" /> Pix</span><span><i className="pt pv-car" /> Cartão</span>{dados.serie.some((x) => x.outro > 0) && <span><i className="pt pv-out" /> Não identificado</span>}</> : <span>&nbsp;</span>}
          <span className="pv-foco">{b ? <><b>{b.dica}</b>: {brl(b.total)} · {num(b.vendas)} venda{b.vendas === 1 ? '' : 's'} · receita {brl(b.receita)}{b.total > 0 && <> · Pix {brl(b.pix)} · Cartão {brl(b.cartao)}</>}</> : 'Passe o mouse (ou toque) numa barra para ver o detalhe.'}</span>
        </div>
        <div className="pv-graf" onMouseLeave={() => setFoco(null)}>
          <div className="pv-eixo" aria-hidden="true">
            {[1, 0.5, 0].map((f) => <span key={f}>{metrica === 'vendas' ? num(Math.round(maxSerie * f)) : brlCurto(maxSerie * f)}</span>)}
          </div>
          <div className="pv-barras" style={{ ['--n' as any]: dados.serie.length }}>
            {dados.serie.map((x, i) => {
              const h = (valorDe(x) / maxSerie) * 100;
              return (
                <button key={x.chave} type="button" className={`pv-col ${foco === i ? 'on' : ''}`} onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} onClick={() => setFoco(i)}
                  aria-label={`${x.dica}: ${brl(x.total)}, ${x.vendas} vendas`}>
                  <span className="pv-pilha" style={{ height: `${h}%` }}>
                    {metrica === 'total' && x.total > 0 ? (
                      <>
                        <i className="pv-out" style={{ height: `${(x.outro / x.total) * 100}%` }} />
                        <i className="pv-car" style={{ height: `${(x.cartao / x.total) * 100}%` }} />
                        <i className="pv-pix" style={{ height: `${(x.pix / x.total) * 100}%` }} />
                      </>
                    ) : <i className={valorDe(x) > 0 ? 'pv-uni' : 'pv-vaz'} style={{ height: '100%' }} />}
                  </span>
                  <span className={`pv-rot${i % passoCelular === 0 ? ' m' : ''}`}>{i % passoRotulo === 0 || i % passoCelular === 0 ? x.rotulo : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- rankings ---------- */}
      <div className="pv-grid2">
        <div className="adm-card">
          <h3 className="adm-ct">Vendedores que mais venderam</h3>
          {dados.lojas.length ? (
            <ol className="pv-rank">
              {dados.lojas.map((x, i) => (
                <li key={x.id}>
                  <span className={`pv-pos p${i + 1}`}>{i + 1}</span>
                  <div className="pv-rk">
                    <div className="pv-rk-l"><b>{nomes.lojas[x.id] ?? 'Loja removida'}</b><strong>{brl(x.faturamento)}</strong></div>
                    <div className="pv-trilha"><i style={{ width: `${(x.faturamento / dados.lojas[0].faturamento) * 100}%` }} /></div>
                    <small>{num(x.vendas)} venda{x.vendas === 1 ? '' : 's'} · ticket {brl(x.ticket)} · {pct(x.parte)} do total · comissão {brl(x.receita)}</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : <div className="adm-empty">Nenhuma venda paga neste período.</div>}
        </div>
        <div className="adm-card">
          <h3 className="adm-ct">Produtos que mais venderam</h3>
          {dados.produtos.length ? (
            <ol className="pv-rank">
              {dados.produtos.map((x, i) => (
                <li key={x.id}>
                  <span className={`pv-pos p${i + 1}`}>{i + 1}</span>
                  <div className="pv-rk">
                    <div className="pv-rk-l"><b>{nomes.produtos[x.id] ?? 'Produto removido'}</b><strong>{brl(x.faturamento)}</strong></div>
                    <div className="pv-trilha"><i style={{ width: `${(x.faturamento / dados.produtos[0].faturamento) * 100}%` }} /></div>
                    <small>{num(x.vendas)} venda{x.vendas === 1 ? '' : 's'} · {pct(x.parte)} do total</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : <div className="adm-empty">Nenhuma venda paga neste período.</div>}
        </div>
      </div>

      {/* ---------- quando vende ---------- */}
      <div className="pv-grid2">
        <div className="adm-card">
          <h3 className="adm-ct">Dia da semana</h3>
          {r.vendas ? <p className="pv-sub">Melhor dia: <b>{melhorDia.rotulo}</b> ({brl(melhorDia.faturamento)})</p> : <p className="pv-sub">Sem vendas no período.</p>}
          <div className="pv-hbar">
            {dados.quando.semana.map((d) => (
              <div key={d.rotulo}><span>{d.rotulo}</span><div className="pv-trilha"><i style={{ width: `${(d.faturamento / maxSemana) * 100}%` }} /></div><small>{d.vendas ? `${num(d.vendas)} · ${brlCurto(d.faturamento)}` : '—'}</small></div>
            ))}
          </div>
        </div>
        <div className="adm-card">
          <h3 className="adm-ct">Horário do pagamento</h3>
          {r.vendas ? <p className="pv-sub">Pico: <b>{melhorHora.rotulo}</b> ({num(melhorHora.vendas)} venda{melhorHora.vendas === 1 ? '' : 's'}). Bom horário para anúncios e avisos.</p> : <p className="pv-sub">Sem vendas no período.</p>}
          <div className="pv-horas">
            {dados.quando.horas.map((h, i) => (
              <span key={h.rotulo} title={`${h.rotulo}: ${h.vendas} venda(s), ${brl(h.faturamento)}`} style={{ opacity: h.vendas ? 0.25 + 0.75 * (h.vendas / maxHora) : 0.08 }}>
                {i % 3 === 0 ? h.rotulo : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- mês a mês ---------- */}
      <div className="adm-card">
        <h3 className="adm-ct">Mês a mês (últimos 12 meses)</h3>
        <div className="pv-tabela">
          <table className="adm-table">
            <thead><tr><th>Mês</th><th>Vendas</th><th>Faturamento</th><th>Pix</th><th>Cartão</th><th>Sua receita</th><th>Ticket</th><th>vs. mês anterior</th><th /></tr></thead>
            <tbody>
              {dados.meses.map((m) => (
                <tr key={m.chave}>
                  <td style={{ fontWeight: 800, textTransform: 'capitalize' }}>{m.rotulo}</td>
                  <td>{num(m.vendas)}</td>
                  <td style={{ fontWeight: 800 }}>{brl(m.faturamento)}</td>
                  <td>{brl(m.pix)}</td>
                  <td>{brl(m.cartao)}{m.outro > 0 && <small className="pv-ni" title="Não identificado"> +{brlCurto(m.outro)}</small>}</td>
                  <td>{brl(m.receita)}</td>
                  <td>{brl(m.ticket)}</td>
                  <td>{m.variacao === null ? <span className="pv-d nv">—</span> : <span className={`pv-d ${m.variacao >= 0 ? 'up' : 'dn'}`}>{m.variacao >= 0 ? '▲' : '▼'} {Math.abs(m.variacao).toFixed(0)}%</span>}</td>
                  <td><button type="button" className="pv-ver" onClick={() => { setMesEscolhido(m.chave); setPreset('mesx'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>ver mês</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.pv-carregando{color:var(--sub);text-align:center;padding:40px}
.pv-filtros{padding:16px 18px}
.pv-chips{display:flex;gap:6px;flex-wrap:wrap}
.pv-chips .adm-fb{min-height:36px;padding:6px 13px;display:inline-flex;align-items:center;gap:6px}
.pv-linha{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:12px}
.pv-campo{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;min-width:150px;flex:1 1 150px;max-width:240px}
.pv-campo select,.pv-campo input{height:40px;border-radius:11px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 10px;font-size:14px;font-weight:700;text-transform:none;letter-spacing:0;color-scheme:dark}
.adm.light .pv-campo select,.adm.light .pv-campo input{color-scheme:light}
.pv-csv{margin-left:auto;display:inline-flex;align-items:center;gap:6px}
.pv-info{margin-top:12px;font-size:13px;color:var(--sub)}
.pv-info b{color:var(--tx)}
.pv-limpar{background:none;border:0;color:var(--or2);font-weight:800;cursor:pointer;padding:0;text-decoration:underline}
.pv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px}
.pv-k{background:var(--panel);border:1px solid var(--bd2);border-radius:20px;padding:18px 20px;display:flex;flex-direction:column;gap:4px;min-width:0}
.pv-k.destaque{background:linear-gradient(135deg,#FF6B00,#FF9A3C);border-color:transparent;color:#fff}
.pv-k.destaque small,.pv-k.destaque em{color:rgba(255,255,255,.85)}
.pv-k.destaque .pv-d{background:rgba(255,255,255,.22);color:#fff}
.pv-k small{color:var(--sub);font-size:12px;font-weight:800}
.pv-k b{font-family:'Outfit';font-size:28px;font-weight:900;letter-spacing:-.8px;overflow-wrap:anywhere}
.pv-k em{font-style:normal;font-size:12px;color:var(--sub);font-weight:700}
.pv-d{display:inline-flex;align-self:flex-start;font-size:11.5px;font-weight:900;padding:2px 8px;border-radius:50px;white-space:nowrap}
.pv-d.up{background:#00B87A22;color:#20C98A}.pv-d.dn{background:#E23B3B22;color:#FF6B6B}
.pv-d.eq,.pv-d.nv{background:var(--panel2);color:var(--sub)}
.adm.light .pv-d.up{color:#0A8A5A}.adm.light .pv-d.dn{color:#C62828}
.pv-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:20px}
.pv-grid2>.adm-card{min-width:0}
.pv-barra{display:flex;height:14px;border-radius:50px;overflow:hidden;background:var(--panel2);margin-bottom:16px}
.pv-barra i{display:block;height:100%}
.pv i.pv-pix,.pv .pt.pv-pix{background:#20C98A}.pv i.pv-car,.pv .pt.pv-car{background:#7C6CFF}.pv i.pv-out,.pv .pt.pv-out{background:#8A8AA0}.pv i.pv-vaz{background:var(--panel2)}.pv i.pv-uni{background:#FF8A3D}
.pt{display:inline-block;width:10px;height:10px;border-radius:3px;vertical-align:middle}
.pv-formas{display:grid;gap:12px}
.pv-formas>div{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center}
.pv-formas b{font-size:14px}
.pv-formas strong{font-family:'Outfit';font-size:20px;font-weight:900;text-align:right}
.pv-formas small{grid-column:2/3;color:var(--sub);font-size:12px;font-weight:700}
.pv-formas .pv-d{grid-column:3/4;justify-self:end}
.pv-nota{margin:14px 0 0;font-size:12.5px;color:var(--sub);background:var(--panel2);border-radius:10px;padding:8px 10px}
.pv-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px}
.pv-mini>div{display:flex;flex-direction:column;gap:3px;padding:12px;border-radius:14px;background:var(--panel2);min-width:0}
.pv-mini small{font-size:11.5px;color:var(--sub);font-weight:800}
.pv-mini b{font-family:'Outfit';font-size:21px;font-weight:900}
.pv-mini em{font-style:normal;font-size:12px;color:var(--sub);font-weight:700}
.pv-cab{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.pv-cab h3{margin-right:auto!important}
.pv-tog{display:inline-flex;background:var(--panel2);border:1px solid var(--bd2);border-radius:50px;padding:3px}
.pv-tog button{border:0;background:none;color:var(--sub);font-weight:800;font-size:12.5px;padding:6px 11px;border-radius:50px;cursor:pointer;min-height:32px}
.pv-tog button.on{background:var(--tx);color:var(--bg)}
.pv-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--sub);font-weight:700;margin-bottom:10px;align-items:center}
.pv-leg>span{display:inline-flex;gap:6px;align-items:center}
.pv-foco{margin-left:auto;color:var(--tx)!important;font-weight:600!important}
.pv-graf{display:flex;gap:8px;height:240px}
.pv-eixo{display:flex;flex-direction:column;justify-content:space-between;font-size:10.5px;color:var(--sub);font-weight:700;text-align:right;padding-bottom:22px;min-width:58px}
.pv-barras{flex:1;display:flex;align-items:stretch;gap:max(2px,min(10px,calc(240px / var(--n))));min-width:0;border-bottom:1px solid var(--bd2);background:linear-gradient(to bottom,var(--bd) 1px,transparent 1px) 0 0/100% 50% repeat-y}
.pv-col{flex:1;min-width:0;border:0;background:none;padding:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;cursor:pointer;position:relative}
.pv-pilha{width:100%;max-width:42px;display:flex;flex-direction:column;justify-content:flex-end;border-radius:6px 6px 2px 2px;overflow:hidden;min-height:2px;transition:filter .15s;animation:cb-grow .7s var(--ease) both;transform-origin:bottom}
.pv-pilha i{display:block;width:100%}
.pv-col:hover .pv-pilha,.pv-col.on .pv-pilha{filter:brightness(1.18)}
.pv-col.on::after{content:'';position:absolute;inset:0 0 22px;border-radius:8px;background:#FF8A3D14;pointer-events:none}
.pv-rot{height:22px;line-height:22px;font-size:10.5px;color:var(--sub);font-weight:700;white-space:nowrap;overflow:visible}
.pv-rank{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.pv-rank li{display:flex;gap:12px;align-items:flex-start}
.pv-pos{width:28px;height:28px;border-radius:9px;background:var(--panel2);display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:900;font-size:13px;flex:none}
.pv-pos.p1{background:linear-gradient(135deg,#FF6B00,#FF9A3C);color:#fff}.pv-pos.p2{background:#FF8A3D55}.pv-pos.p3{background:#FF8A3D33}
.pv-rk{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.pv-rk-l{display:flex;justify-content:space-between;gap:10px}
.pv-rk-l b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-rk-l strong{font-family:'Outfit';font-weight:900;white-space:nowrap}
.pv-rk small{color:var(--sub);font-size:12px;font-weight:700}
.pv-trilha{height:7px;border-radius:50px;background:var(--panel2);overflow:hidden;flex:1}
.pv-trilha i{display:block;height:100%;border-radius:50px;background:linear-gradient(90deg,#FF6B00,#FF9A3C);transform-origin:left;animation:cb-growx .8s var(--ease) both}
.pv-sub{margin:-8px 0 12px;font-size:13px;color:var(--sub)}
.pv-sub b{color:var(--tx)}
.pv-hbar{display:grid;gap:8px}
.pv-hbar>div{display:grid;grid-template-columns:36px 1fr 110px;gap:10px;align-items:center;font-size:12.5px;font-weight:800}
.pv-hbar small{color:var(--sub);font-weight:700;text-align:right}
.pv-horas{display:grid;grid-template-columns:repeat(24,1fr);gap:3px}
.pv-horas span{height:46px;border-radius:6px;background:#FF7A14;display:flex;align-items:flex-end;justify-content:center;font-size:9.5px;font-weight:800;color:var(--tx);padding-bottom:3px}
.pv-tabela{overflow-x:auto;-webkit-overflow-scrolling:touch}
.pv-tabela table{min-width:760px}
.pv-ni{color:var(--sub)}
.pv-ver{background:none;border:1px solid var(--bd2);color:var(--sub);border-radius:50px;font-size:12px;font-weight:800;padding:4px 10px;cursor:pointer;white-space:nowrap}
.pv-ver:hover{color:var(--tx);border-color:#FF8A3D}
@media(max-width:820px){
  .pv-campo{max-width:none}
  .pv-csv{margin-left:0;width:100%;justify-content:center}
  .pv-graf{height:200px}
  .pv-barras{gap:max(1px,min(6px,calc(90px / var(--n))))}
  .pv-rot:not(.m){visibility:hidden}
  .pv-col.on::after{inset:0 0 22px}
  .pv-eixo{min-width:48px}
  .pv-foco{margin-left:0;flex-basis:100%}
  .pv-k b{font-size:24px}
  .pv-hbar>div{grid-template-columns:34px 1fr 92px}
}
`;
