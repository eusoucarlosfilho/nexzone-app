'use client';
import { useCallback, useEffect, useState } from 'react';
import { UFS } from '@/lib/brasil';
import { Aviso, Barras, Bloqueado, Chips, Kpi, Rank, V3_CSS, diaCurto, fmt, pct } from './ui';

type Periodo = '7d' | '30d' | '90d';

export default function GrowthPanel() {
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch('/api/admin/crescimento?periodo=' + periodo, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error || 'Falha ao carregar'); setD(null); } else { setErro(null); setD(j); }
    } catch { setErro('Falha de conexão'); }
    finally { setCarregando(false); }
  }, [periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const a = d?.atual; const c = d?.comparacao || {};
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <h2 className="adm-ct" style={{ marginTop: 26 }}>Visitas, cadastros e ativação</h2>
      <p className="adm-sub">Comparado com o período anterior equivalente. O dinheiro está em Financeiro.</p>
      <Chips<Periodo> valor={periodo} onChange={setPeriodo} opcoes={[['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias']]} />
      {erro && (/bloquead|C1/i.test(erro) ? <Bloqueado mensagem={erro} /> : <Aviso>{erro}</Aviso>)}
      {!d && !erro && <div className="adm-empty">Carregando…</div>}
      {d && (
        <div style={{ opacity: carregando ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="v3-kpis">
            <Kpi valor={fmt(a.visitantes)} rotulo="Visitantes (estimados)" delta={c.visitantes} />
            <Kpi valor={fmt(a.novosCadastros)} rotulo="Novos cadastros" delta={c.novosCadastros} />
            <Kpi valor={fmt(a.novosCompradores)} rotulo="Novos compradores" delta={c.novosCompradores} />
            <Kpi valor={fmt(a.novosVendedores)} rotulo="Novos vendedores" delta={c.novosVendedores} nota="Lojas criadas no período" />
            <Kpi valor={fmt(a.vendedoresQuePublicaram)} rotulo="Vendedores que publicaram" delta={c.vendedoresQuePublicaram} nota={d.publicacoesAproximadas ? 'Aproximado até o SQL V3 03' : undefined} />
            <Kpi valor={fmt(a.produtosPublicados)} rotulo="Produtos publicados" delta={c.produtosPublicados} nota={d.publicacoesAproximadas ? 'Aproximado até o SQL V3 03' : undefined} />
            <Kpi valor={fmt(a.produtosVisualizados)} rotulo="Produtos visualizados" delta={c.produtosVisualizados} />
            <Kpi valor={a.cliquesCompra === null ? 'indisponível' : fmt(a.cliquesCompra)} rotulo="Cliques em Comprar" nota={a.cliquesCompra === null ? 'Depende dos eventos de funil' : undefined} />
            <Kpi valor={a.cliquesExternos === null ? 'indisponível' : fmt(a.cliquesExternos)} rotulo="Cliques para sites parceiros" delta={c.cliquesExternos} />
            <Kpi valor={pct(a.conversaoVisitanteCadastro)} rotulo="Conversão visitante → cadastro" />
            <Kpi valor={pct(d.conversaoVendedor)} rotulo="Vendedor cadastrado → ativo" nota={`${fmt(d.vendedoresAtivos)} de ${fmt(d.vendedoresCadastrados)} têm produto publicado`} />
          </div>

          <div className="adm-card">
            <h3 className="adm-ct">Insights</h3>
            {d.insights.length ? (
              <div className="v3-insights">
                {d.insights.map((x: any, i: number) => (
                  <div key={i} className={`v3-insight ${x.tipo}`}>{x.texto}<small>Base: {x.base}</small></div>
                ))}
              </div>
            ) : <p style={{ color: 'var(--sub)', fontSize: 13, margin: 0 }}>Ainda não há dados suficientes para conclusões (mínimo de {d.amostraMinima} visitas ou cadastros por comparação). Nenhum insight é gerado com amostras pequenas.</p>}
          </div>

          <div className="v3-grid">
            <div className="adm-card">
              <h3 className="adm-ct">Evolução diária</h3>
              <Barras pontos={d.serie.map((s: any) => ({ rotulo: diaCurto(s.dia), a: s.visitantes, b: s.cadastros }))} a="Visitantes" b="Cadastros" />
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Principais fontes de tráfego</h3>
              <Rank linhas={d.fontes.map((x: any) => ({ rotulo: x.chave, valor: x.valor }))} vazio="Sem sessões no período." rodape="Sessões por canal (UTM ou site de origem)." />
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Novos cadastros por estado</h3>
              <Rank linhas={d.estados.grupos.map((g: any) => ({ rotulo: UFS.find((u) => u.sigla === g.chave)?.nome || g.chave, valor: g.valor }))}
                vazio="Ainda sem estados com pelo menos 3 cadastros no período."
                rodape={d.estados.ocultos ? `${d.estados.ocultos} cadastro(s) em grupos menores que 3 não aparecem.` : 'Declarado ou aproximado pela rede.'} />
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Novos cadastros por cidade</h3>
              <Rank linhas={d.cidades.grupos.map((g: any) => ({ rotulo: g.chave, valor: g.valor }))}
                vazio="Ainda sem cidades com pelo menos 3 cadastros no período."
                rodape={d.cidades.ocultos ? `${d.cidades.ocultos} cadastro(s) em cidades com menos de 3 não aparecem.` : undefined} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
