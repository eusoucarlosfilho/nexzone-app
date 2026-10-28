'use client';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import {
  PRESETS, type PresetId, type Periodo, type Agrupamento, type Filtro, type VendaDash,
  periodoDoPreset, periodoDoMes, periodoPersonalizado, periodoAnterior, agrupamentoAutomatico, diasDoPeriodo,
  resumir, variacao, serie, mesAMes, ranking, mesesDisponiveis, somarDias, pago, dataVenda,
} from '@/lib/dashboardVendas';

// Painel do lojista: o que entrou para ele por período (padrão 30 dias), mês fechado ou datas livres.
// "Você recebeu" = valor do vendedor (já sem a comissão). "Faturamento bruto" = o que os clientes pagaram.
// Tudo calculado no navegador a partir dos pedidos da própria loja.

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (v: number) => (v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1).replace('.', ',')} mi` : v >= 1e4 ? `R$ ${(v / 1e3).toFixed(1).replace('.', ',')} mil` : brl(v));
const num = (v: number) => v.toLocaleString('pt-BR');
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0).replace('.', ',')}%`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dataBR = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

type Props = { vendas: VendaDash[]; produtos: Record<string, string>; temForma: boolean };

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  const v = variacao(atual, anterior);
  if (v === null) return <span className="pl-d nv">novo</span>;
  if (Math.abs(v) < 0.5) return <span className="pl-d eq">= anterior</span>;
  return <span className={`pl-d ${v > 0 ? 'up' : 'dn'}`}>{v > 0 ? '▲' : '▼'} {Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0).replace('.', ',')}%</span>;
}

export default function PainelLoja({ vendas, produtos, temForma }: Props) {
  const [agora, setAgora] = useState<Date | null>(null);   // datas no fuso do navegador: calcula só depois de abrir
  const [preset, setPreset] = useState<PresetId | 'mesx' | 'livre'>('30d');
  const [mesEscolhido, setMesEscolhido] = useState('');
  const [livreDe, setLivreDe] = useState('');
  const [livreAte, setLivreAte] = useState('');
  const [forma, setForma] = useState<Filtro['forma']>('todas');
  const [agrup, setAgrup] = useState<Agrupamento | 'auto'>('auto');
  const [metrica, setMetrica] = useState<'valor' | 'vendas'>('valor');
  const [foco, setFoco] = useState<number | null>(null);

  useEffect(() => {
    const a = new Date(); setAgora(a);
    setLivreDe(iso(somarDias(a, -29))); setLivreAte(iso(a));
    try { const s = JSON.parse(localStorage.getItem('cb_loja_dash') || '{}'); if (PRESETS.some((p) => p.id === s.preset)) setPreset(s.preset); } catch {}
  }, []);
  useEffect(() => { if (preset !== 'mesx' && preset !== 'livre') { try { localStorage.setItem('cb_loja_dash', JSON.stringify({ preset })); } catch {} } }, [preset]);

  // mesma lista em duas "lentes": líquido (o que o lojista recebe) e bruto (o que o cliente pagou)
  const liquido = useMemo(() => vendas.map((v) => ({ ...v, v: v.r })), [vendas]);
  const primeira = useMemo(() => vendas.reduce<Date | undefined>((m, v) => { const d = new Date(v.c); return !m || d < m ? d : m; }, undefined), [vendas]);
  const meses = useMemo(() => (agora ? mesesDisponiveis(vendas, agora) : []), [vendas, agora]);
  const totalGeral = useMemo(() => Math.round(vendas.reduce((s, v) => s + (pago(v.s) ? v.r : 0), 0) * 100) / 100, [vendas]);

  const periodo: Periodo | null = useMemo(() => {
    if (!agora) return null;
    if (preset === 'mesx') return periodoDoMes(mesEscolhido) ?? periodoDoPreset('mes', agora);
    if (preset === 'livre') return periodoPersonalizado(livreDe, livreAte) ?? periodoDoPreset('30d', agora);
    return periodoDoPreset(preset, agora, primeira);
  }, [agora, preset, mesEscolhido, livreDe, livreAte, primeira]);

  const dados = useMemo(() => {
    if (!periodo || !agora) return null;
    const f: Filtro = { loja: 'todas', forma };
    const ant = periodoAnterior(periodo);
    const g: Agrupamento = agrup === 'auto' ? agrupamentoAutomatico(periodo) : agrup;
    return {
      ant, g,
      r: resumir(liquido, periodo, f), ra: resumir(liquido, ant, f),
      b: resumir(vendas, periodo, f), ba: resumir(vendas, ant, f),
      serie: serie(liquido, periodo, g, f),
      meses: mesAMes(liquido, agora, f, 12),
      top: ranking(liquido, periodo, f, 'd', 8),
    };
  }, [vendas, liquido, periodo, agora, agrup, forma]);

  function baixarCsv() {
    if (!periodo) return;
    const esc = (s: unknown) => { const t = String(s ?? ''); return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const n2 = (n: number) => n.toFixed(2).replace('.', ',');
    const linhas = [['Data do pagamento', 'Pedido', 'Produto', 'Pagamento', 'Cliente pagou', 'Taxa da plataforma', 'Você recebe'].join(';')];
    vendas.filter((v) => pago(v.s) && (forma === 'todas' || v.f === forma) && dataVenda(v) >= periodo.de && dataVenda(v) < periodo.ate)
      .sort((a, b) => dataVenda(a).getTime() - dataVenda(b).getTime())
      .forEach((v) => {
        const d = dataVenda(v);
        linhas.push([`${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, v.i.slice(0, 8), esc(produtos[v.d] ?? '—'),
          v.f === 'pix' ? 'Pix' : v.f === 'cartao' ? 'Cartão' : 'Não identificado', n2(v.v), n2(Math.max(0, v.v - v.r)), n2(v.r)].join(';'));
      });
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `minhas_vendas_${iso(periodo.de)}_a_${iso(somarDias(periodo.ate, -1))}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (!periodo || !dados) return <div className="card pl-carregando">Carregando seus números…</div>;

  const { r, ra, b, ba } = dados;
  const valorDe = (x: any) => (metrica === 'vendas' ? x.vendas : x.total);
  const maxSerie = Math.max(1, ...dados.serie.map(valorDe));
  const passoRotulo = Math.max(1, Math.ceil(dados.serie.length / 12));
  const passoCelular = Math.max(1, Math.ceil(dados.serie.length / 5));
  const totalForma = r.pix.valor + r.cartao.valor + r.semForma.valor;
  const textoPeriodo = diasDoPeriodo(periodo) === 1 ? dataBR(periodo.de) : `${dataBR(periodo.de)} – ${dataBR(somarDias(periodo.ate, -1))}`;
  const textoAnterior = `${dataBR(dados.ant.de)} – ${dataBR(somarDias(dados.ant.ate, -1))}`;
  const sel = foco !== null ? dados.serie[foco] : null;
  const nomePeriodo = preset === 'mesx' ? 'no mês' : preset === 'hoje' ? 'hoje' : 'no período';

  return (
    <div className="pl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ---------- filtros ---------- */}
      <div className="card pl-filtros">
        <div className="pl-chips" role="group" aria-label="Período">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={`pl-chip ${preset === p.id ? 'on' : ''}`} onClick={() => setPreset(p.id)}>{p.rotulo}</button>
          ))}
          <button type="button" className={`pl-chip ${preset === 'livre' ? 'on' : ''}`} onClick={() => setPreset('livre')}><Icon name="calendar" size={14} /> Escolher datas</button>
        </div>
        <div className="pl-linha">
          <label className="pl-campo">
            <span>Mês</span>
            <select value={preset === 'mesx' ? mesEscolhido : ''} onChange={(e) => { if (e.target.value) { setMesEscolhido(e.target.value); setPreset('mesx'); } }}>
              <option value="">Escolher mês…</option>
              {meses.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
            </select>
          </label>
          {preset === 'livre' && (
            <>
              <label className="pl-campo"><span>De</span><input type="date" value={livreDe} max={livreAte || undefined} onChange={(e) => setLivreDe(e.target.value)} /></label>
              <label className="pl-campo"><span>Até</span><input type="date" value={livreAte} min={livreDe || undefined} onChange={(e) => setLivreAte(e.target.value)} /></label>
            </>
          )}
          <label className="pl-campo">
            <span>Pagamento</span>
            <select value={forma} onChange={(e) => setForma(e.target.value as Filtro['forma'])}>
              <option value="todas">Pix e cartão</option>
              <option value="pix">Só Pix</option>
              <option value="cartao">Só cartão</option>
            </select>
          </label>
          <button type="button" className="btn btn-ghost btn-sm pl-csv" onClick={baixarCsv} disabled={!r.vendas}><Icon name="download" size={15} /> Baixar planilha</button>
        </div>
        <div className="pl-info"><b>{textoPeriodo}</b> · comparando com {textoAnterior}</div>
      </div>

      {/* ---------- números ---------- */}
      <div className="pl-kpis">
        <div className="pl-k destaque">
          <small>Você recebeu {nomePeriodo}</small><b>{brl(r.faturamento)}</b>
          <Delta atual={r.faturamento} anterior={ra.faturamento} /><em>antes: {brl(ra.faturamento)} · desde o início: {brl(totalGeral)}</em>
        </div>
        <div className="pl-k">
          <small>Vendas pagas</small><b>{num(r.vendas)}</b>
          <Delta atual={r.vendas} anterior={ra.vendas} /><em>{num(r.compradores)} cliente{r.compradores === 1 ? '' : 's'} · {num(r.compradoresNovos)} novo{r.compradoresNovos === 1 ? '' : 's'}</em>
        </div>
        <div className="pl-k">
          <small>Ticket médio (cliente pagou)</small><b>{brl(b.ticket)}</b>
          <Delta atual={b.ticket} anterior={ba.ticket} /><em>você recebe {brl(r.ticket)} por venda</em>
        </div>
        <div className="pl-k">
          <small>Faturamento bruto</small><b>{brl(b.faturamento)}</b>
          <Delta atual={b.faturamento} anterior={ba.faturamento} /><em>taxas da plataforma: {brl(Math.max(0, b.faturamento - r.faturamento))}</em>
        </div>
      </div>

      {/* ---------- gráfico ---------- */}
      <div className="card pl-card">
        <div className="pl-cab">
          <strong className="pl-tt">{metrica === 'vendas' ? 'Vendas' : 'Quanto você recebeu'} por {dados.g === 'dia' ? 'dia' : dados.g === 'semana' ? 'semana' : 'mês'}</strong>
          <div className="pl-tog">
            {([['valor', 'Valor'], ['vendas', 'Nº de vendas']] as const).map(([k, l]) => (
              <button key={k} type="button" className={metrica === k ? 'on' : ''} onClick={() => setMetrica(k)}>{l}</button>
            ))}
          </div>
          <div className="pl-tog">
            {([['auto', 'Auto'], ['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']] as const).map(([k, l]) => (
              <button key={k} type="button" className={agrup === k ? 'on' : ''} onClick={() => setAgrup(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="pl-leg">
          {metrica === 'valor' ? <><span><i className="pt pl-pix" /> Pix</span><span><i className="pt pl-car" /> Cartão</span>{dados.serie.some((x) => x.outro > 0) && <span><i className="pt pl-out" /> Não identificado</span>}</> : <span>&nbsp;</span>}
          <span className="pl-foco">{sel ? <><b>{sel.dica}</b>: {brl(sel.total)} · {num(sel.vendas)} venda{sel.vendas === 1 ? '' : 's'}{sel.total > 0 && <> · Pix {brl(sel.pix)} · Cartão {brl(sel.cartao)}</>}</> : 'Toque numa barra para ver o detalhe.'}</span>
        </div>
        <div className="pl-graf" onMouseLeave={() => setFoco(null)}>
          <div className="pl-eixo" aria-hidden="true">
            {[1, 0.5, 0].map((f) => <span key={f}>{metrica === 'vendas' ? num(Math.round(maxSerie * f)) : brlCurto(maxSerie * f)}</span>)}
          </div>
          <div className="pl-barras" style={{ ['--n' as any]: dados.serie.length }}>
            {dados.serie.map((x, i) => (
              <button key={x.chave} type="button" className={`pl-col ${foco === i ? 'on' : ''}`} onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} onClick={() => setFoco(i)}
                aria-label={`${x.dica}: ${brl(x.total)}, ${x.vendas} vendas`}>
                <span className="pl-pilha" style={{ height: `${(valorDe(x) / maxSerie) * 100}%` }}>
                  {metrica === 'valor' && x.total > 0 ? (
                    <>
                      <i className="pl-out" style={{ height: `${(x.outro / x.total) * 100}%` }} />
                      <i className="pl-car" style={{ height: `${(x.cartao / x.total) * 100}%` }} />
                      <i className="pl-pix" style={{ height: `${(x.pix / x.total) * 100}%` }} />
                    </>
                  ) : <i className={valorDe(x) > 0 ? 'pl-uni' : 'pl-vaz'} style={{ height: '100%' }} />}
                </span>
                <span className={`pl-rot${i % passoCelular === 0 ? ' m' : ''}`}>{i % passoRotulo === 0 || i % passoCelular === 0 ? x.rotulo : ''}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pl-grid2">
        {/* Pix x cartão */}
        <div className="card pl-card">
          <strong className="pl-tt">Como o dinheiro entrou</strong>
          <div className="pl-barra" aria-hidden="true">
            {totalForma > 0 ? (
              <>
                <i className="pl-pix" style={{ width: `${(r.pix.valor / totalForma) * 100}%` }} />
                <i className="pl-car" style={{ width: `${(r.cartao.valor / totalForma) * 100}%` }} />
                <i className="pl-out" style={{ width: `${(r.semForma.valor / totalForma) * 100}%` }} />
              </>
            ) : <i className="pl-vaz" style={{ width: '100%' }} />}
          </div>
          <div className="pl-formas">
            <div><span className="pt pl-pix" /><b>Pix</b><strong>{brl(r.pix.valor)}</strong><small>{num(r.pix.qtd)} venda{r.pix.qtd === 1 ? '' : 's'} · {totalForma ? pct(r.pix.valor / totalForma) : '0%'}</small><Delta atual={r.pix.valor} anterior={ra.pix.valor} /></div>
            <div><span className="pt pl-car" /><b>Cartão</b><strong>{brl(r.cartao.valor)}</strong><small>{num(r.cartao.qtd)} venda{r.cartao.qtd === 1 ? '' : 's'} · {totalForma ? pct(r.cartao.valor / totalForma) : '0%'}</small><Delta atual={r.cartao.valor} anterior={ra.cartao.valor} /></div>
            {r.semForma.qtd > 0 && (
              <div><span className="pt pl-out" /><b>Não identificado</b><strong>{brl(r.semForma.valor)}</strong><small>{num(r.semForma.qtd)} venda{r.semForma.qtd === 1 ? '' : 's'} de antes do registro da forma de pagamento</small></div>
            )}
          </div>
          <div className="pl-mini">
            <div><small>Aguardando pagamento</small><b>{num(r.pendentes.qtd)}</b><em>{brl(b.pendentes.valor)} em pedidos abertos</em></div>
            <div><small>Conversão</small><b>{pct(r.conversao)}</b><em>pedidos pagos ÷ criados</em></div>
            <div><small>Reembolsos</small><b>{num(r.reembolsos.qtd)}</b><em>{brl(b.reembolsos.valor)}</em></div>
          </div>
          {!temForma && <p className="pl-nota">A separação Pix × cartão aparece para as vendas novas.</p>}
        </div>

        {/* produtos */}
        <div className="card pl-card">
          <strong className="pl-tt">Produtos que mais venderam</strong>
          {dados.top.length ? (
            <ol className="pl-rank">
              {dados.top.map((x, i) => (
                <li key={x.id}>
                  <span className={`pl-pos p${i + 1}`}>{i + 1}</span>
                  <div className="pl-rk">
                    <div className="pl-rk-l"><b>{produtos[x.id] ?? 'Produto removido'}</b><strong>{brl(x.faturamento)}</strong></div>
                    <div className="pl-trilha"><i style={{ width: `${(x.faturamento / dados.top[0].faturamento) * 100}%` }} /></div>
                    <small>{num(x.vendas)} venda{x.vendas === 1 ? '' : 's'} · {pct(x.parte)} do que você recebeu</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Nenhuma venda paga neste período.</p>}
        </div>
      </div>

      {/* ---------- mês a mês ---------- */}
      <div className="card pl-card">
        <strong className="pl-tt">Mês a mês (últimos 12 meses)</strong>
        <div className="pl-tabela">
          <table>
            <thead><tr><th>Mês</th><th>Vendas</th><th>Você recebeu</th><th>Pix</th><th>Cartão</th><th>Por venda</th><th>vs. mês anterior</th><th /></tr></thead>
            <tbody>
              {dados.meses.map((m) => (
                <tr key={m.chave}>
                  <td style={{ fontWeight: 800, textTransform: 'capitalize' }}>{m.rotulo}</td>
                  <td>{num(m.vendas)}</td>
                  <td style={{ fontWeight: 900 }}>{brl(m.faturamento)}</td>
                  <td>{brl(m.pix)}</td>
                  <td>{brl(m.cartao)}{m.outro > 0 && <small className="muted" title="Não identificado"> +{brlCurto(m.outro)}</small>}</td>
                  <td>{brl(m.ticket)}</td>
                  <td>{m.variacao === null ? <span className="pl-d nv">—</span> : <span className={`pl-d ${m.variacao >= 0 ? 'up' : 'dn'}`}>{m.variacao >= 0 ? '▲' : '▼'} {Math.abs(m.variacao).toFixed(0)}%</span>}</td>
                  <td><button type="button" className="pl-ver" onClick={() => { setMesEscolhido(m.chave); setPreset('mesx'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>ver mês</button></td>
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
.pl{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;margin:18px 0 20px}
.pl>*{min-width:0}
.pl .card{margin:0}
.pl-carregando{color:var(--sub);text-align:center;padding:40px;margin:18px 0}
.pl-filtros{padding:16px 18px}
.pl-chips{display:flex;gap:6px;flex-wrap:wrap}
.pl-chip{min-height:36px;padding:6px 14px;border-radius:50px;border:1.5px solid var(--border2);background:#fff;color:var(--sub);font-weight:800;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.pl-chip:hover{border-color:var(--orange);color:var(--text)}
.pl-chip.on{background:var(--text);border-color:var(--text);color:#fff}
.pl-linha{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:12px}
.pl-campo{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;min-width:150px;flex:1 1 150px;max-width:240px;margin:0}
.pl-campo select,.pl-campo input{height:40px;min-height:40px;width:100%;border-radius:11px;border:1.5px solid var(--border2);background:#fff;color:var(--text);padding:0 10px;font-size:14px;font-weight:700;text-transform:none;letter-spacing:0;font-family:inherit;box-shadow:none;margin:0}
.pl-campo select:focus,.pl-campo input:focus{outline:none;border-color:var(--orange)}
.pl-csv{margin-left:auto;display:inline-flex;align-items:center;gap:6px;height:40px}
.pl-info{margin-top:12px;font-size:13px;color:var(--sub)}
.pl-info b{color:var(--text)}
.pl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}
.pl-k{background:#fff;border:1px solid #EDE6DF;border-radius:20px;padding:18px 20px;display:flex;flex-direction:column;gap:4px;min-width:0;animation:cb-up .5s var(--ease) both}
.pl-k.destaque{background:linear-gradient(135deg,#FF6B00,#FF9A3C);border-color:transparent;color:#16162A}
.pl-k.destaque small,.pl-k.destaque em{color:rgba(22,22,42,.78)}
.pl-k.destaque .pl-d{background:rgba(255,255,255,.4);color:#16162A}
.pl-k small{color:var(--sub);font-size:12.5px;font-weight:800}
.pl-k b{font-family:'Outfit';font-size:28px;font-weight:900;letter-spacing:-.8px;overflow-wrap:anywhere}
.pl-k em{font-style:normal;font-size:12px;color:var(--muted);font-weight:700}
.pl-d{display:inline-flex;align-self:flex-start;font-size:11.5px;font-weight:900;padding:2px 8px;border-radius:50px;white-space:nowrap}
.pl-d.up{background:var(--green-bg);color:var(--green)}.pl-d.dn{background:var(--red-bg);color:var(--red)}
.pl-d.eq,.pl-d.nv{background:var(--bg2);color:var(--sub)}
.pl-card{padding:20px}
.pl-tt{font-family:'Outfit';font-size:16px;display:block}
.pl-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:20px}
.pl-grid2>.card{min-width:0}
.pl-barra{display:flex;height:14px;border-radius:50px;overflow:hidden;background:var(--bg2);margin:14px 0 16px}
.pl-barra i{display:block;height:100%}
.pl i.pl-pix,.pl .pt.pl-pix{background:#00B87A}.pl i.pl-car,.pl .pt.pl-car{background:#6C5CE7}.pl i.pl-out,.pl .pt.pl-out{background:#B5B5C3}.pl i.pl-vaz{background:var(--bg2)}.pl i.pl-uni{background:#FF8A3D}
.pl .pt{display:inline-block;width:10px;height:10px;border-radius:3px;vertical-align:middle}
.pl-formas{display:grid;gap:12px}
.pl-formas>div{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center}
.pl-formas b{font-size:14px}
.pl-formas strong{font-family:'Outfit';font-size:20px;font-weight:900;text-align:right}
.pl-formas small{grid-column:2/3;color:var(--sub);font-size:12px;font-weight:700}
.pl-formas .pl-d{grid-column:3/4;justify-self:end}
.pl-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:16px}
.pl-mini>div{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:14px;background:var(--surface);border:1px solid var(--border);min-width:0}
.pl-mini small{font-size:11.5px;color:var(--sub);font-weight:800}
.pl-mini b{font-family:'Outfit';font-size:19px;font-weight:900}
.pl-mini em{font-style:normal;font-size:11.5px;color:var(--muted);font-weight:700}
.pl-nota{margin:14px 0 0;font-size:12.5px;color:var(--sub);background:var(--bg2);border-radius:10px;padding:8px 10px}
.pl-cab{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.pl-cab .pl-tt{margin-right:auto}
.pl-tog{display:inline-flex;background:var(--bg2);border:1px solid var(--border);border-radius:50px;padding:3px}
.pl-tog button{border:0;background:none;color:var(--sub);font-weight:800;font-size:12.5px;padding:6px 11px;border-radius:50px;cursor:pointer;min-height:32px;font-family:inherit}
.pl-tog button.on{background:var(--text);color:#fff}
.pl-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--sub);font-weight:700;margin-bottom:10px;align-items:center}
.pl-leg>span{display:inline-flex;gap:6px;align-items:center}
.pl-foco{margin-left:auto;color:var(--text)!important;font-weight:600!important}
.pl-graf{display:flex;gap:8px;height:230px}
.pl-eixo{display:flex;flex-direction:column;justify-content:space-between;font-size:10.5px;color:var(--muted);font-weight:700;text-align:right;padding-bottom:22px;min-width:58px}
.pl-barras{flex:1;display:flex;align-items:stretch;gap:max(2px,min(10px,calc(240px / var(--n))));min-width:0;border-bottom:1px solid var(--border2);background:linear-gradient(to bottom,var(--border) 1px,transparent 1px) 0 0/100% 50% repeat-y}
.pl-col{flex:1;min-width:0;border:0;background:none;padding:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;cursor:pointer;position:relative;box-shadow:none;min-height:0}
.pl-pilha{width:100%;max-width:42px;display:flex;flex-direction:column;justify-content:flex-end;border-radius:6px 6px 2px 2px;overflow:hidden;min-height:2px;transition:filter .15s;animation:cb-grow .7s var(--ease) both;transform-origin:bottom}
.pl-pilha i{display:block;width:100%}
.pl-col:hover .pl-pilha,.pl-col.on .pl-pilha{filter:brightness(1.1)}
.pl-col.on::after{content:'';position:absolute;inset:0 0 22px;border-radius:8px;background:#FF8A3D1A;pointer-events:none}
.pl-rot{height:22px;line-height:22px;font-size:10.5px;color:var(--muted);font-weight:700;white-space:nowrap;overflow:visible}
.pl-rank{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:12px}
.pl-rank li{display:flex;gap:12px;align-items:flex-start}
.pl-pos{width:28px;height:28px;border-radius:9px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:900;font-size:13px;flex:none}
.pl-pos.p1{background:linear-gradient(135deg,#FF6B00,#FF9A3C)}.pl-pos.p2{background:#FFD3B0}.pl-pos.p3{background:#FFE6D2}
.pl-rk{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.pl-rk-l{display:flex;justify-content:space-between;gap:10px}
.pl-rk-l b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-rk-l strong{font-family:'Outfit';font-weight:900;white-space:nowrap}
.pl-rk small{color:var(--sub);font-size:12px;font-weight:700}
.pl-trilha{height:7px;border-radius:50px;background:var(--bg2);overflow:hidden}
.pl-trilha i{display:block;height:100%;border-radius:50px;background:linear-gradient(90deg,#FF6B00,#FF9A3C)}
.pl-tabela{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:12px}
.pl-tabela table{width:100%;min-width:720px;border-collapse:collapse;font-size:13.5px}
.pl-tabela th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:900;padding:8px 10px;border-bottom:1px solid var(--border2);white-space:nowrap}
.pl-tabela td{padding:10px;border-bottom:1px solid var(--border);white-space:nowrap}
.pl-tabela tr:last-child td{border-bottom:0}
.pl-ver{background:#fff;border:1px solid var(--border2);color:var(--sub);border-radius:50px;font-size:12px;font-weight:800;padding:4px 10px;cursor:pointer;white-space:nowrap;font-family:inherit;min-height:0}
.pl-ver:hover{color:var(--text);border-color:var(--orange)}
@media(max-width:820px){
  .pl-campo{max-width:none}
  .pl-csv{margin-left:0;width:100%;justify-content:center}
  .pl-graf{height:190px}
  .pl-barras{gap:max(1px,min(6px,calc(90px / var(--n))))}
  .pl-rot:not(.m){visibility:hidden}
  .pl-eixo{min-width:48px}
  .pl-foco{margin-left:0;flex-basis:100%}
  .pl-k b{font-size:24px}
  .pl-card{padding:16px}
}
`;
