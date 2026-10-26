'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { UFS } from '@/lib/brasil';
import { Aviso, Barras, Bloqueado, Chips, Funil, Kpi, Rank, V3_CSS, diaCurto, fmt, pct } from './ui';

type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | 'custom';

const ERRO_ROT: Record<string, string> = {
  senha_fraca: 'Senha fraca', email_existente: 'E-mail já cadastrado', email_invalido: 'E-mail inválido',
  campos_vazios: 'Campos obrigatórios vazios', muitas_tentativas: 'Muitas tentativas', outro: 'Outro erro',
};
const DISP_ROT: Record<string, string> = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet', desconhecido: 'Desconhecido' };

/** Painel ao vivo agregado. Atualiza a cada 45 s, só com a aba visível. */
export function AoVivoV3() {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      const r = await fetch('/api/admin/audiencia/ao-vivo', { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error || 'Falha ao carregar'); return; }
      setErro(null); setD(j);
    } catch { /* tenta de novo no próximo ciclo */ }
  }, []);
  useEffect(() => {
    carregar();
    const id = window.setInterval(carregar, 45000);
    const vis = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [carregar]);
  return (
    <div className="adm-card">
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <h3 className="adm-ct">Ao vivo · últimos 5 minutos</h3>
      {erro && (/bloquead|C1/i.test(erro) ? <Bloqueado mensagem={erro} /> : <Aviso>{erro}</Aviso>)}
      {!d && !erro && <p style={{ color: 'var(--sub)', fontSize: 13 }}>Carregando…</p>}
      {d && (
        <>
          <div className="v3-live">
            <div><b>{fmt(d.ativos)}</b><small>visitantes ativos (estimativa)</small></div>
            <div><b>{fmt(d.emProdutos)}</b><small>em páginas de produto</small></div>
            <div><b>{fmt(d.emCadastro)}</b><small>no cadastro/login</small></div>
            <div><b>{fmt(d.emCheckout)}</b><small>no checkout</small></div>
            <div><b>{fmt(d.naAreaVendedor)}</b><small>na área do vendedor</small></div>
            <div><b>{fmt(d.naAreaComprador)}</b><small>na área do comprador</small></div>
          </div>
          <h4 style={{ fontFamily: 'Outfit', fontSize: 14, margin: '16px 0 8px' }}>Categorias sendo vistas agora</h4>
          <Rank linhas={(d.categorias || []).map((c: any) => ({ rotulo: c.chave, valor: c.valor }))} vazio="Ninguém em página de produto neste momento." />
          <p style={{ color: 'var(--sub)', fontSize: 11.5, margin: '12px 0 0', lineHeight: 1.45 }}>
            Ativo = navegador que mandou sinal nos últimos 5 minutos (estimativa; uma pessoa pode ter várias abas).
            Só contagens agregadas: sem identidade, sem trajetória individual. Atualiza a cada 45 s com esta aba visível.
          </p>
        </>
      )}
    </div>
  );
}

export default function AudienciaV3() {
  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [de, setDe] = useState(''); const [ate, setAte] = useState('');
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const sp = new URLSearchParams({ periodo });
    if (periodo === 'custom') { if (de) sp.set('de', de); if (ate) sp.set('ate', ate); }
    try {
      const r = await fetch('/api/admin/audiencia/v3?' + sp, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error || 'Falha ao carregar'); setD(null); } else { setErro(null); setD(j); }
    } catch { setErro('Falha de conexão'); }
    finally { setCarregando(false); }
  }, [periodo, de, ate]);
  useEffect(() => { carregar(); }, [carregar]);

  async function alternarFunil(ativo: boolean) {
    if (ativo && !confirm('Ligar os eventos de funil (cadastro, cliques e buscas)? Confirme que a revisão de privacidade foi feita e que a Política de Privacidade descreve essa coleta.')) return;
    setSalvando(true);
    try {
      const r = await fetch('/api/admin/analytics-config', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha ao salvar', 'error'); return; }
      toast(ativo ? 'Eventos de funil ligados.' : 'Eventos de funil desligados.', 'success');
      setD((x: any) => x ? { ...x, funilLigado: j.ativo } : x);
    } finally { setSalvando(false); }
  }

  const i = d?.indicadores; const c = d?.comparacao || {};
  const t = d?.trafego;
  return (
    <div style={{ marginTop: 26 }}>
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <h2 className="adm-h" style={{ fontSize: 24 }}>Comportamento e conversão</h2>
      <p className="adm-sub">Chegam, navegam, se interessam, se cadastram? Números do período, comparados com o período anterior equivalente.</p>
      <Chips<Periodo> valor={periodo} onChange={setPeriodo} opcoes={[['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['custom', 'Personalizado']]} />
      {periodo === 'custom' && (
        <div className="v3-filtros" style={{ maxWidth: 420 }}>
          <label>DE<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label>ATÉ<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        </div>
      )}
      {erro && (/bloquead|C1/i.test(erro) ? <Bloqueado mensagem={erro} /> : <Aviso>{erro}</Aviso>)}
      {!d && !erro && <div className="adm-empty">Carregando…</div>}

      {d && (
        <div style={{ opacity: carregando ? 0.6 : 1, transition: 'opacity .2s' }}>
          <Aviso>
            <b>Eventos de funil: {d.funilLigado ? 'ligados' : 'desligados'}.</b>{' '}
            {d.funilLigado
              ? 'Cadastro, cliques em produto, cliques em Comprar e buscas estão sendo registrados de forma anônima.'
              : 'Sem eles, cliques, buscas e etapas do cadastro aparecem como indisponíveis. Ligue só depois da revisão de privacidade.'}
            {!d.eventosDisponiveis && ' A tabela de eventos ainda não existe (SQL V3 04).'}{' '}
            <button className="adm-btn rp" style={{ minHeight: 32, padding: '4px 12px', fontSize: 12, marginLeft: 6 }} disabled={salvando} onClick={() => alternarFunil(!d.funilLigado)}>
              {d.funilLigado ? 'Desligar' : 'Ligar eventos de funil'}
            </button>
          </Aviso>

          <div className="v3-kpis">
            <Kpi valor={fmt(i.ativos5min)} rotulo="Ativos nos últimos 5 min" nota="Estimativa por navegador" />
            <Kpi valor={fmt(i.sessoes)} rotulo="Sessões iniciadas" delta={c.sessoes} />
            <Kpi valor={fmt(i.visitantesUnicos)} rotulo="Visitantes únicos (estimados)" delta={c.visitantesUnicos} nota="Navegadores anônimos, não pessoas identificadas" />
            <Kpi valor={fmt(i.pageviews)} rotulo="Visualizações de página" delta={c.pageviews} />
            <Kpi valor={fmt(i.produtosVisualizados)} rotulo="Produtos visualizados" delta={c.produtosVisualizados} />
            <Kpi valor={i.cliquesProdutos === null ? 'indisponível' : fmt(i.cliquesProdutos)} rotulo="Cliques em produtos" />
            <Kpi valor={i.buscas === null ? 'indisponível' : fmt(i.buscas)} rotulo="Buscas realizadas" />
            <Kpi valor={fmt(i.visitasCadastro)} rotulo="Visitas ao cadastro/login" delta={c.visitasCadastro} nota="Sessões" />
            <Kpi valor={i.cadastrosIniciados === null ? 'indisponível' : fmt(i.cadastrosIniciados)} rotulo="Cadastros iniciados" />
            <Kpi valor={fmt(i.cadastrosConcluidos)} rotulo="Cadastros concluídos" delta={c.cadastrosConcluidos} nota="Contas criadas" />
            <Kpi valor={fmt(i.acessosVendedor)} rotulo="Acessos à área do vendedor" nota="Sessões" />
            <Kpi valor={fmt(i.acessosComprador)} rotulo="Acessos à área do comprador" nota="Sessões" />
            <Kpi valor={fmt(i.acessosCheckout)} rotulo="Acessos ao checkout" nota="Sessões" />
            <Kpi valor={i.cliquesCheckoutExterno === null ? 'indisponível' : fmt(i.cliquesCheckoutExterno)} rotulo="Cliques para checkout externo" nota="Ofertas de outros sites" />
            <Kpi valor={pct(i.taxaCadastro)} rotulo="Taxa de cadastro" nota="Contas criadas ÷ visitantes únicos" />
            <Kpi valor={pct(i.sessoesUmaPagina)} rotulo="Abandono estimado" nota="Sessões com uma página só. Não significa que a pessoa saiu." />
          </div>

          <div className="v3-grid">
            <div className="adm-card">
              <h3 className="adm-ct">Funil de aquisição</h3>
              <Funil etapas={d.funil} rodape="Cada etapa conta sessões, exceto “Concluiu cadastro” (contas criadas). Por isso a sequência não é estritamente decrescente." />
              <div className="v3-scroll" style={{ marginTop: 12 }}>
                <table className="v3-tabela">
                  <thead><tr><th>Etapa</th><th>Período</th><th>Anterior</th></tr></thead>
                  <tbody>{d.funil.map((e: any) => <tr key={e.etapa}><td>{e.etapa}</td><td>{e.valor === null ? '—' : fmt(e.valor)}</td><td>{e.anterior === null ? '—' : fmt(e.anterior)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>

            <div className="adm-card">
              <h3 className="adm-ct">Visitantes e cadastros por dia</h3>
              <Barras pontos={d.serie.map((s: any) => ({ rotulo: diaCurto(s.dia), a: s.visitantes, b: s.cadastros }))} a="Visitantes" b="Cadastros" />
            </div>

            <div className="adm-card">
              <h3 className="adm-ct">Onde o cadastro perde gente</h3>
              {!d.abandono ? <Aviso>Disponível quando os eventos de funil estiverem ligados (e o SQL V3 04 aplicado).</Aviso> : (
                <>
                  <Funil etapas={d.abandono.etapas} rodape={d.abandono.maiorPerda ? `Maior perda: ${d.abandono.maiorPerda.etapa} (${fmt(d.abandono.maiorPerda.perda)} sessões).` : undefined} />
                  <p style={{ fontSize: 12.5, color: 'var(--sub)', margin: '10px 0' }}>Cadastros interrompidos (começaram há mais de 30 min e não concluíram na mesma sessão): <b style={{ color: 'var(--tx)' }}>{fmt(d.abandono.interrompidos)}</b></p>
                  <div className="v3-scroll">
                    <table className="v3-tabela">
                      <thead><tr><th>Grupo</th><th>Iniciaram</th><th>Concluíram</th><th>Conclusão</th></tr></thead>
                      <tbody>
                        {d.abandono.porDispositivo.map((g: any) => <tr key={'d' + g.chave}><td>{DISP_ROT[g.chave] || g.chave}</td><td>{fmt(g.iniciados)}</td><td>{fmt(g.concluidos)}</td><td>{pct(g.conclusao)}</td></tr>)}
                        {d.abandono.porTipo.map((g: any) => <tr key={'t' + g.chave}><td>Cadastro de {g.chave}</td><td>{fmt(g.iniciados)}</td><td>{fmt(g.concluidos)}</td><td>{pct(g.conclusao)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                  <h4 style={{ fontFamily: 'Outfit', fontSize: 14, margin: '14px 0 8px' }}>Erros mais frequentes</h4>
                  <Rank linhas={d.abandono.erros.map((e: any) => ({ rotulo: ERRO_ROT[e.chave] || e.chave, valor: e.valor }))} vazio="Nenhum erro registrado no período." />
                </>
              )}
            </div>

            <div className="adm-card">
              <h3 className="adm-ct">Canais de tráfego</h3>
              <Rank linhas={t.canais.map((x: any) => ({ rotulo: x.chave, valor: x.valor }))} vazio="Sem sessões no período." rodape="Sessões. Atribuição aproximada: UTM da visita ou site de origem; sem eles, “Direto”." />
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Campanhas: visitantes → cadastros → vendedores ativos</h3>
              {!t.temUtm && <Aviso>As UTMs das visitas passam a ser gravadas depois do SQL V3 05. Cadastros já trazem a campanha de origem desde a V3.</Aviso>}
              {t.campanhas.length ? (
                <div className="v3-scroll">
                  <table className="v3-tabela">
                    <thead><tr><th>Campanha</th><th>Visitantes</th><th>Cadastros</th><th>Vendedores ativos</th></tr></thead>
                    <tbody>{t.campanhas.map((x: any) => <tr key={x.chave}><td>{x.chave}</td><td>{fmt(x.visitantes)}</td><td>{fmt(x.cadastros)}</td><td>{fmt(x.vendedoresAtivos)}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <p style={{ color: 'var(--sub)', fontSize: 13, margin: 0 }}>Nenhuma visita ou cadastro com utm_campaign no período.</p>}
              <p style={{ color: 'var(--sub)', fontSize: 11.5, margin: '10px 0 0' }}>Atribuição de primeiro toque, não perfeita: bloqueadores, troca de aparelho e links sem UTM escapam.</p>
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Fontes (utm_source ou site)</h3>
              <Rank linhas={t.fontes.map((x: any) => ({ rotulo: x.chave, valor: x.valor }))} />
              {t.meios.length > 0 && <><h4 style={{ fontFamily: 'Outfit', fontSize: 14, margin: '14px 0 8px' }}>utm_medium</h4><Rank linhas={t.meios.map((x: any) => ({ rotulo: x.chave, valor: x.valor }))} /></>}
              {t.conteudos.length > 0 && <><h4 style={{ fontFamily: 'Outfit', fontSize: 14, margin: '14px 0 8px' }}>utm_content</h4><Rank linhas={t.conteudos.map((x: any) => ({ rotulo: x.chave, valor: x.valor }))} /></>}
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Páginas de entrada</h3>
              <Rank linhas={t.entradas.map((x: any) => ({ rotulo: x.chave, valor: x.valor }))} />
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Dispositivo e região aproximada</h3>
              <Rank linhas={t.dispositivos.map((x: any) => ({ rotulo: DISP_ROT[x.chave] || x.chave, valor: x.valor }))} />
              <h4 style={{ fontFamily: 'Outfit', fontSize: 14, margin: '14px 0 8px' }}>Estados (aproximado pela rede)</h4>
              <Rank linhas={t.estados.grupos.map((g: any) => ({ rotulo: UFS.find((u) => u.sigla === g.chave)?.nome || g.chave, valor: g.valor }))}
                rodape={t.estados.ocultos ? `${t.estados.ocultos} sessão(ões) em grupos com menos de 3 não aparecem.` : 'Aproximação pela rede (Vercel). Não é a localização exata de ninguém.'} />
            </div>
            <div className="adm-card">
              <h3 className="adm-ct">Categorias mais visitadas</h3>
              <Rank linhas={d.categorias.map((x: any) => ({ rotulo: x.chave, valor: x.valor }))} vazio="Sem visitas a produtos no período." rodape="Visualizações de páginas de produto e de ofertas de outros sites." />
            </div>
          </div>
          {(d.cortes?.sessoes || d.cortes?.pageviews || d.cortes?.eventos) && <Aviso>O período é grande e atingiu o teto de leitura; os números mostram só os registros mais recentes. Use um período menor.</Aviso>}
        </div>
      )}
    </div>
  );
}
