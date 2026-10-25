'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import PeriodFilter from '@/components/ui/PeriodFilter';
import DeltaBadge from '@/components/ui/DeltaBadge';
import Funnel from '@/components/ui/Funnel';
import Sparkline from '@/components/ui/Sparkline';
import LiveCard from '@/components/ui/LiveCard';
import InsightCard from '@/components/ui/InsightCard';
import EmptyState from '@/components/ui/EmptyState';
import { PERIODOS, ROTULO_PERIODO, type Periodo } from '@/lib/audiencia';

const INTERVALO_AO_VIVO = 45000;

type Dados = {
  periodo: Periodo; anteriorRotulo: string; granularidade: 'hora' | 'dia';
  totais: { visualizacoes: number; visualizacoesLoja: number; visitas: number; visitantes: number; checkout: number };
  comparacao: { visualizacoes: number | null; visitas: number | null; checkout: number | null; anterior: { visualizacoes: number; visitas: number; checkout: number } };
  funil: { etapa: string; valor: number }[]; funilIndisponivel: string;
  serie: { rotulo: string; visualizacoes: number; checkout: number }[];
  ranking: { id: string; titulo: string; ativo: boolean; destaque: boolean; visualizacoes: number | null; visitas: number | null; checkout: number | null; taxa: number | null }[];
  canais: { canal: string; sessoes: number | null }[];
  oportunidades: { tipo: 'atencao' | 'positivo' | 'info'; titulo: string; motivo: string; acao?: { rotulo: string; href: string } }[];
  avisos: { produtosLimitados: boolean; cortado: boolean };
};
type AoVivo = { janelaMin: number; ativos: number; naLoja: number; noCheckout: number; produtos: { id: string; titulo: string; ativos: number | null }[] };

const n = (v: number | null) => (v === null ? 'menos de 3' : v.toLocaleString('pt-BR'));

export default function AudienciaClient({ periodoInicial }: { periodoInicial: Periodo }) {
  const router = useRouter();
  const pathname = usePathname();
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [vivo, setVivo] = useState<AoVivo | null>(null);
  const [vivoErro, setVivoErro] = useState(false);
  const pedido = useRef(0);

  // Período: busca uma vez por troca (sem atualização automática)
  useEffect(() => {
    const id = ++pedido.current;
    setCarregando(true); setErro(null);
    fetch(`/api/seller/audience?periodo=${periodo}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (id !== pedido.current) return;
        if (!r.ok) { setErro(d.error || 'Não foi possível carregar a audiência.'); setDados(null); }
        else setDados(d as Dados);
      })
      .catch(() => { if (id === pedido.current) setErro('Sem conexão. Tente de novo.'); })
      .finally(() => { if (id === pedido.current) setCarregando(false); });
  }, [periodo]);

  // Ao vivo: só com a aba visível; pausa em segundo plano e atualiza ao voltar
  const carregarVivo = useCallback(async () => {
    try {
      const r = await fetch('/api/seller/audience/live', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) { setVivoErro(true); return; }
      setVivo(await r.json()); setVivoErro(false);
    } catch { setVivoErro(true); }
  }, []);
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const iniciar = () => { if (t) return; carregarVivo(); t = setInterval(carregarVivo, INTERVALO_AO_VIVO); };
    const parar = () => { if (t) { clearInterval(t); t = null; } };
    const aoMudar = () => (document.visibilityState === 'visible' ? iniciar() : parar());
    aoMudar();
    document.addEventListener('visibilitychange', aoMudar);
    return () => { parar(); document.removeEventListener('visibilitychange', aoMudar); };
  }, [carregarVivo]);

  function trocar(p: Periodo) {
    setPeriodo(p);
    router.replace(`${pathname}?periodo=${p}`, { scroll: false });
  }

  const semDados = dados && dados.totais.visualizacoes === 0 && dados.totais.checkout === 0;

  return (
    <div className="aud">
      <div className="aud-top">
        <LiveCard ativos={vivo ? vivo.ativos : null} janelaMin={vivo?.janelaMin ?? 5} erro={vivoErro}
          detalhe={vivo ? `${vivo.naLoja} na página da loja · ${vivo.noCheckout} no checkout` : undefined} />
        <PeriodFilter valor={periodo} onChange={trocar} opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: ROTULO_PERIODO[p] }))} />
      </div>

      {vivo && vivo.produtos.length > 0 && (
        <div className="card aud-card">
          <h2 className="aud-h2">Produtos com gente agora</h2>
          <ul className="aud-live-list">
            {vivo.produtos.map((p) => <li key={p.id}><span>{p.titulo}</span><b>{n(p.ativos)}</b></li>)}
          </ul>
        </div>
      )}

      {carregando && !dados && <div className="card aud-card muted" role="status">Carregando audiência…</div>}
      {erro && <div className="card aud-card" role="alert">{erro} <button type="button" className="btn btn-ghost btn-sm" onClick={() => trocar(periodo)}>Tentar de novo</button></div>}

      {dados && (
        <div style={{ opacity: carregando ? 0.6 : 1, transition: 'opacity .2s' }} aria-busy={carregando}>
          <div className="ui-stats aud-stats">
            <div className="ui-stat"><b>{n(dados.totais.visualizacoes)}</b><small>Visualizações</small>
              <DeltaBadge valor={dados.comparacao.visualizacoes} rotulo={dados.anteriorRotulo} />
              <span className="ui-stat-hint">{dados.totais.visualizacoesLoja} na página da loja</span></div>
            <div className="ui-stat"><b>{n(dados.totais.visitantes)}</b><small>Visitantes únicos (estimado)</small>
              <span className="ui-stat-hint">{dados.totais.visitas} visitas</span>
              <DeltaBadge valor={dados.comparacao.visitas} rotulo={dados.anteriorRotulo} /></div>
            <div className="ui-stat"><b>{n(dados.totais.checkout)}</b><small>Acessos ao checkout</small>
              <DeltaBadge valor={dados.comparacao.checkout} rotulo={dados.anteriorRotulo} /></div>
            <div className="ui-stat aud-k2"><b>—</b><small>Pedidos e receita</small>
              <span className="ui-stat-hint">Indisponível por enquanto. Veja seus pedidos em <Link href="/vender/vendas">Vendas</Link>.</span></div>
          </div>

          {semDados ? (
            <EmptyState icon="activity" title="Ainda não há visitas neste período"
              text="Divulgue o link da sua loja ou de um produto e volte aqui para ver quem chegou."
              action={<Link href="/vender/loja" className="btn btn-ghost btn-sm">Ver minha loja</Link>} />
          ) : (
            <>
              {dados.oportunidades.length > 0 && (
                <section className="aud-sec" aria-labelledby="aud-op">
                  <h2 id="aud-op" className="aud-h2">Oportunidades</h2>
                  <div className="aud-insights">{dados.oportunidades.map((o, i) => <InsightCard key={i} {...o} />)}</div>
                </section>
              )}

              <div className="aud-grid">
                <section className="card aud-card" aria-labelledby="aud-serie">
                  <h2 id="aud-serie" className="aud-h2">Visualizações por {dados.granularidade === 'hora' ? 'hora' : 'dia'}</h2>
                  <Sparkline rotulo="Visualizações" pontos={dados.serie.map((s) => ({ rotulo: s.rotulo, valor: s.visualizacoes }))} />
                </section>
                <section className="card aud-card" aria-labelledby="aud-funil">
                  <h2 id="aud-funil" className="aud-h2">Funil</h2>
                  <Funnel etapas={dados.funil} rodape={dados.funilIndisponivel} />
                </section>
              </div>

              <div className="aud-grid">
                <section className="card aud-card" aria-labelledby="aud-rank">
                  <h2 id="aud-rank" className="aud-h2">Produtos mais vistos</h2>
                  {dados.ranking.length === 0 ? <p className="muted">Nenhum produto visto neste período.</p> : (
                    <ol className="aud-rank">
                      {dados.ranking.map((p, i) => (
                        <li key={p.id}>
                          <span className="aud-pos">{i + 1}</span>
                          <div className="aud-rank-info">
                            <Link href={`/produto/${p.id}`} target="_blank" rel="noopener">{p.titulo}</Link>
                            <small>{n(p.visualizacoes)} visualizações · {n(p.checkout)} no checkout{p.taxa !== null ? ` · ${p.taxa}%` : ''}{p.destaque ? ' · em destaque' : ''}{!p.ativo ? ' · fora do ar' : ''}</small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <section className="card aud-card" aria-labelledby="aud-origem">
                  <h2 id="aud-origem" className="aud-h2">De onde vêm as visitas</h2>
                  {dados.canais.length === 0 ? <p className="muted">Sem dados de origem neste período.</p> : (
                    <ul className="aud-canais">
                      {dados.canais.map((c) => <li key={c.canal}><span>{c.canal}</span><b>{n(c.sessoes)}</b></li>)}
                    </ul>
                  )}
                  <p className="aud-nota">Baseado no site de onde o visitante chegou. Apps como WhatsApp e Instagram nem sempre informam isso: parte dessas visitas aparece como "Direto".</p>
                </section>
              </div>
            </>
          )}

          <details className="aud-sobre">
            <summary>Como estes números são calculados</summary>
            <ul>
              <li><b>Visualizações:</b> aberturas da página da sua loja e dos seus produtos. Recarregar conta de novo.</li>
              <li><b>Visitas:</b> sessões de navegação que passaram pela sua loja. <b>Visitantes únicos</b> é uma estimativa por navegador.</li>
              <li><b>Acessos ao checkout:</b> aberturas da página de pagamento dos seus produtos. Não significa compra.</li>
              <li><b>Ao vivo:</b> visitantes com a página aberta na sua loja nos últimos {vivo?.janelaMin ?? 5} minutos, atualizado a cada {INTERVALO_AO_VIVO / 1000} s enquanto esta aba estiver visível.</li>
              <li>Contagens de 1 ou 2 por produto ou canal aparecem como &quot;menos de 3&quot;.</li>
              <li>Todos os números são estimativas: bloqueadores, navegação anônima e robôs podem alterar a contagem.</li>
              <li>Pedidos e receita ainda não aparecem aqui porque o status dos pedidos está passando por uma correção de segurança.</li>
            </ul>
            {(dados.avisos.cortado || dados.avisos.produtosLimitados) && (
              <p className="aud-nota">Atenção: {dados.avisos.cortado ? 'o volume deste período passou do limite de leitura, então os números estão abaixo do real. ' : ''}{dados.avisos.produtosLimitados ? 'só os 300 produtos mais recentes entram na conta.' : ''}</p>
            )}
          </details>
        </div>
      )}
    </div>
  );
}
