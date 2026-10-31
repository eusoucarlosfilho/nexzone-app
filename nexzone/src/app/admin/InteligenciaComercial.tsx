'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AoVivoV3 } from './v3/AudienciaV3';
import { Aviso, Barras, Bloqueado, Chips, Funil, Kpi, V3_CSS, diaCurto, fmt, pct } from './v3/ui';

// Admin › Inteligência Comercial: do visitante à compra aprovada, por origem, produto e vendedor.
// Funil em SESSÕES; compras = pedidos com pagamento confirmado pelo gateway; nada de número estimado sem aviso.
type P = 'hoje' | 'ontem' | '7d' | '30d' | 'periodo';
const OPCOES: [P, string][] = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['periodo', 'Personalizado']];
const money = (v: number | null | undefined) => (v === null || v === undefined ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export default function InteligenciaComercial() {
  const [p, setP] = useState<P>('7d');
  const [de, setDe] = useState(''); const [ate, setAte] = useState('');
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [cat, setCat] = useState('');
  const [aba, setAba] = useState<'produtos' | 'vendedores'>('produtos');

  const carregar = useCallback(async () => {
    if (p === 'periodo' && (!de || !ate)) return;
    setCarregando(true); setErro(null);
    try {
      const q = new URLSearchParams({ p, de, ate });
      const r = await fetch(`/api/admin/inteligencia?${q}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error || 'Falha ao carregar.'); setD(null); } else setD(j);
    } catch { setErro('Sem conexão. Tente de novo.'); }
    setCarregando(false);
  }, [p, de, ate]);
  useEffect(() => { carregar(); }, [carregar]);

  const g = d?.geral;
  const categorias = useMemo(() => Array.from(new Set(((d?.produtos || []) as any[]).map((x) => x.categoria).filter(Boolean))).sort() as string[], [d]);
  const produtos = useMemo(() => ((d?.produtos || []) as any[]).filter((x) => !cat || x.categoria === cat), [d, cat]);

  return (
    <div className="bi">
      <style dangerouslySetInnerHTML={{ __html: V3_CSS + CSS }} />
      <h1 className="adm-h">Inteligência Comercial</h1>
      <p className="adm-sub">Onde o visitante entra, onde ele desiste e o que vira venda. Compras = pagamentos confirmados pelo gateway, nunca a página de obrigado.</p>

      <div className="adm-card bi-filtros">
        <Chips valor={p} opcoes={OPCOES} onChange={setP} />
        {p === 'periodo' && (
          <div className="bi-datas">
            <label>De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
            <label>Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
          </div>
        )}
        <button className="adm-btn" onClick={carregar} disabled={carregando}>{carregando ? 'Atualizando…' : 'Atualizar'}</button>
      </div>

      {erro && (/bloquead|C1/i.test(erro) ? <Bloqueado mensagem={erro} /> : <Aviso>{erro}</Aviso>)}
      {!d && !erro && <div className="adm-card"><p style={{ color: 'var(--sub)', margin: 0 }}>{p === 'periodo' && (!de || !ate) ? 'Escolha as duas datas.' : 'Carregando…'}</p></div>}

      {d && (
        <>
          {d.cortes?.length > 0 && <Aviso>Período grande: a leitura parou no teto de {d.cortes.join(', ')}. Use um período menor para números completos.</Aviso>}
          {d.limitado && <Aviso>O período personalizado vai até 92 dias por consulta. Mostrando os últimos 92 dias do intervalo.</Aviso>}

          <div className="adm-card">
            <h3 className="adm-ct">Visão geral</h3>
            <div className="v3-kpis">
              <Kpi valor={fmt(g.visitantes)} rotulo="Visitantes únicos" nota="navegadores, não pessoas" />
              <Kpi valor={fmt(g.sessoes)} rotulo="Sessões" />
              <Kpi valor={fmt(g.pageviews)} rotulo="Páginas vistas" />
              <Kpi valor={fmt(g.viewsProduto)} rotulo="Visualizações de produto" />
              <Kpi valor={fmt(g.cliquesComprar)} rotulo="Cliques em comprar" nota={g.cliquesComprar === null ? 'liga em Audiência › eventos de funil' : undefined} />
              <Kpi valor={fmt(g.checkouts)} rotulo="Checkouts abertos" nota="sessões" />
              <Kpi valor={fmt(g.pedidosCriados)} rotulo="Pedidos criados" nota="Pix gerado ou cartão iniciado" />
              <Kpi valor={fmt(g.comprasAprovadas)} rotulo="Compras aprovadas" />
              <Kpi valor={money(g.receita)} rotulo="Receita bruta" nota="soma dos pedidos aprovados" />
              <Kpi valor={money(g.ticketMedio)} rotulo="Ticket médio" />
              <Kpi valor={pct(g.conversao, 2)} rotulo="Conversão" nota="sessões com compra ÷ sessões" />
              <Kpi valor={fmt(g.reembolsados)} rotulo="Reembolsados" nota="pedidos do período" />
            </div>
          </div>

          <div className="bi-2">
            <div className="adm-card">
              <h3 className="adm-ct">Funil de conversão · em sessões</h3>
              <Funil etapas={d.funil.map((x: any) => ({ etapa: x.etapa, valor: x.valor, nota: x.valor === null ? 'Eventos de funil desligados (Admin › Audiência).' : undefined }))}
                rodape={`Cada etapa conta sessões iniciadas no período. A compra liga à sessão pelo checkout${d.comprasSemSessao ? `; ${fmt(d.comprasSemSessao)} compra(s) aprovada(s) sem sessão ligada (pedidos antigos ou de outra visita) ficam só nos totais` : ''}.`} />
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Evolução por dia</h3>
              <Barras pontos={(d.serie || []).map((s: any) => ({ rotulo: diaCurto(s.dia), a: s.sessoes }))} a="Sessões" />
              <div className="bi-mini">
                {(d.serie || []).filter((s: any) => s.compras > 0).slice(-10).map((s: any) => (
                  <span key={s.dia}>{diaCurto(s.dia)}: <b>{s.compras}</b> compra{s.compras > 1 ? 's' : ''} · {money(s.receita)}</span>
                ))}
                {!(d.serie || []).some((s: any) => s.compras > 0) && <span>Nenhuma compra aprovada no período.</span>}
              </div>
            </div>
          </div>

          <div className="adm-card">
            <h3 className="adm-ct">Origem do tráfego</h3>
            <div className="bi-tab">
              <table>
                <thead><tr><th>Origem</th><th>Sessões</th><th>Visitantes</th><th>Compras</th><th>Receita</th><th>Conversão</th></tr></thead>
                <tbody>
                  {(d.origens || []).map((o: any) => (
                    <tr key={o.fonte}><td><b>{o.fonte}</b>{o.nota && <small>{o.nota}</small>}</td><td>{fmt(o.sessoes)}</td><td>{fmt(o.visitantes)}</td><td>{fmt(o.compras)}</td><td>{money(o.receita)}</td><td>{pct(o.conversao, 2)}</td></tr>
                  ))}
                  {!(d.origens || []).length && <tr><td colSpan={6}>Sem visitas no período.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="bi-nota">A origem vem da UTM do link e do site de onde a pessoa veio. Sem UTM, anúncio do Meta aparece como Instagram ou Facebook: use sempre UTM nos anúncios (utm_source=meta&amp;utm_medium=paid).</p>
          </div>

          <div className="adm-card">
            <div className="bi-cab">
              <Chips valor={aba} opcoes={[['produtos', 'Produtos mais acessados'], ['vendedores', 'Desempenho por vendedor']]} onChange={setAba} />
              {aba === 'produtos' && categorias.length > 0 && (
                <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
              )}
            </div>
            <div className="bi-tab">
              {aba === 'produtos' ? (
                <table>
                  <thead><tr><th>Produto</th><th>Vendedor</th><th>Visualizações</th><th>Visitantes</th><th>Cliques comprar</th><th>Checkouts</th><th>Compras</th><th>Conversão</th><th>Receita</th></tr></thead>
                  <tbody>
                    {produtos.slice(0, 50).map((x: any) => (
                      <tr key={x.id}><td><a href={`/produto/${x.id}`} target="_blank" rel="noreferrer">{x.titulo}</a></td><td>{x.loja}</td><td>{fmt(x.views)}</td><td>{fmt(x.visitantes)}</td><td>{fmt(x.cliques)}</td><td>{fmt(x.checkouts)}</td><td>{fmt(x.compras)}</td><td>{pct(x.conversao, 1)}</td><td>{money(x.receita)}</td></tr>
                    ))}
                    {!produtos.length && <tr><td colSpan={9}>Sem visitas a produtos no período.</td></tr>}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead><tr><th>Loja</th><th>Produtos ativos</th><th>Visitas aos produtos</th><th>Cliques comprar</th><th>Vendas</th><th>Receita</th><th>Conversão</th><th>Visitas pelos links da loja</th></tr></thead>
                  <tbody>
                    {(d.vendedores || []).slice(0, 50).map((x: any) => (
                      <tr key={x.storeId}><td><b>{x.loja}</b></td><td>{fmt(x.produtos)}</td><td>{fmt(x.views)}</td><td>{fmt(x.cliques)}</td><td>{fmt(x.compras)}</td><td>{money(x.receita)}</td><td>{pct(x.conversao, 1)}</td><td>{fmt(x.visitasLinks)}</td></tr>
                    ))}
                    {!(d.vendedores || []).length && <tr><td colSpan={8}>Sem movimento de vendedores no período.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            <p className="bi-nota">Conversão do produto = compras ÷ visitantes únicos do produto. Conversão do vendedor = vendas ÷ visitas aos produtos dele.</p>
          </div>
        </>
      )}

      <AoVivoV3 />
    </div>
  );
}

const CSS = `
.bi-filtros{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.bi-datas{display:flex;gap:8px;flex-wrap:wrap}.bi-datas label{font-size:12.5px;font-weight:700;color:var(--sub);display:flex;gap:6px;align-items:center}
.bi-datas input{height:36px;border:1px solid var(--line);border-radius:10px;padding:0 8px}
.bi-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.bi-2{grid-template-columns:1fr}}
.bi-mini{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:12px;color:var(--sub)}
.bi-tab{overflow-x:auto;-webkit-overflow-scrolling:touch}
.bi-tab table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
.bi-tab th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);padding:8px;border-bottom:1px solid var(--line);white-space:nowrap}
.bi-tab td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.bi-tab td small{display:block;color:var(--sub);font-size:11px;font-weight:500;max-width:260px}
.bi-tab td a{color:inherit;font-weight:700}
.bi-cab{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.bi-cab select{height:36px;border-radius:10px;border:1px solid var(--line);padding:0 8px}
.bi-nota{color:var(--sub);font-size:11.5px;margin:10px 0 0;line-height:1.45}
`;
