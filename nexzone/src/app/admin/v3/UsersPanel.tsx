'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { UFS } from '@/lib/brasil';
import { Aviso, Barras, Bloqueado, Chips, Funil, Kpi, Rank, V3_CSS, data, dataHora, diaCurto, fmt } from './ui';

type Periodo = 'todos' | 'hoje' | 'ontem' | '7d' | '30d' | 'custom';

const TIPO_ROT: Record<string, string> = { comprador: 'Comprador', vendedor: 'Vendedor', admin: 'Admin' };
const SIT_TAG: Record<string, string> = { ativo: 'gr', restrito: 'or', bloqueado: 'rd' };
const LOJA_ROT: Record<string, string> = { pendente: 'Loja pendente', verificado: 'Loja verificada', suspenso: 'Loja suspensa' };

export default function UsersPanel({ onVerReclamacoes }: { onVerReclamacoes?: () => void }) {
  const [resumo, setResumo] = useState<any>(null);
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [lista, setLista] = useState<any>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [periodo, setPeriodo] = useState<Periodo>('todos');
  const [de, setDe] = useState(''); const [ate, setAte] = useState('');
  const [tipo, setTipo] = useState(''); const [uf, setUf] = useState(''); const [cidade, setCidade] = useState('');
  const [canal, setCanal] = useState(''); const [situacao, setSituacao] = useState(''); const [produtos, setProdutos] = useState('');
  const [q, setQ] = useState(''); const [qDeb, setQDeb] = useState('');
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => { const t = setTimeout(() => setQDeb(q), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPagina(1); }, [periodo, de, ate, tipo, uf, cidade, canal, situacao, produtos, qDeb]);

  useEffect(() => {
    fetch('/api/admin/usuarios/resumo', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Falha ao carregar'); setResumo(d); })
      .catch((e) => setErroResumo(String(e.message || e)));
  }, []);

  const carregar = useCallback(async () => {
    const id = ++seq.current;
    setCarregando(true);
    const sp = new URLSearchParams({ pagina: String(pagina), tamanho: '20' });
    if (periodo !== 'todos') sp.set('periodo', periodo);
    if (periodo === 'custom') { if (de) sp.set('de', de); if (ate) sp.set('ate', ate); }
    if (tipo) sp.set('tipo', tipo); if (uf) sp.set('uf', uf); if (cidade.trim()) sp.set('cidade', cidade.trim());
    if (canal) sp.set('canal', canal); if (situacao) sp.set('situacao', situacao); if (produtos) sp.set('produtos', produtos);
    if (qDeb.trim()) sp.set('q', qDeb.trim());
    try {
      const r = await fetch('/api/admin/usuarios?' + sp.toString(), { credentials: 'include', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (id !== seq.current) return;
      if (!r.ok) { setErroLista(d.error || 'Falha ao carregar'); setLista(null); }
      else { setErroLista(null); setLista(d); }
    } catch { if (id === seq.current) setErroLista('Falha de conexão'); }
    finally { if (id === seq.current) setCarregando(false); }
  }, [pagina, periodo, de, ate, tipo, uf, cidade, canal, situacao, produtos, qDeb]);
  useEffect(() => { carregar(); }, [carregar]);

  async function acao(userId: string, action: string, texto?: string) {
    setBusy(userId + ':' + action);
    try {
      const r = await fetch('/api/admin/user-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId, action, texto }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Falha na ação', 'error'); return; }
      if (action === 'aviso') toast('Aviso enviado ao usuário.', 'success');
      else if (action === 'advertencia') toast('Advertência registrada.', 'success');
      else {
        toast(action === 'block' ? 'Usuário bloqueado.' : action === 'restrict' ? 'Usuário restrito.' : 'Status liberado.', 'success');
        setLista((l: any) => l ? { ...l, itens: l.itens.map((u: any) => u.id === userId ? { ...u, situacao: d.status } : u) } : l);
      }
    } finally { setBusy(null); }
  }
  function avisar(userId: string, tipoAviso: 'aviso' | 'advertencia') {
    const t = window.prompt(tipoAviso === 'aviso' ? 'Mensagem do aviso para o usuário:' : 'Texto da advertência:');
    if (t && t.trim()) acao(userId, tipoAviso, t.trim());
  }
  async function visibilidade(u: any) {
    const ligar = !u.loja?.ocultarVendedor;
    if (ligar && !confirm('Os produtos desta loja vão aparecer como vendidos pelo Comprei Barato. O nome da loja fica visível só no Admin.')) return;
    setBusy(u.id + ':vis');
    try {
      const r = await fetch('/api/admin/store-visibility', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ store_id: u.loja.id, ocultar: ligar }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Falha ao alterar', 'error'); return; }
      setLista((l: any) => l ? { ...l, itens: l.itens.map((x: any) => x.id === u.id ? { ...x, loja: { ...x.loja, ocultarVendedor: d.ocultar_vendedor === true } } : x) } : l);
      toast(d.ocultar_vendedor ? 'Loja vendendo como Comprei Barato.' : 'Loja voltou a aparecer com o próprio nome.', 'success');
    } finally { setBusy(null); }
  }

  const k = resumo?.kpis;
  const disp = resumo?.disponibilidade || lista?.disponibilidade;
  const bloqueio = erroResumo && /bloquead|C1/i.test(erroResumo) ? erroResumo : erroLista && /bloquead|C1/i.test(erroLista) ? erroLista : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <h1 className="adm-h">Usuários</h1>
      <p className="adm-sub">Quem está se cadastrando, de onde vem e em que ponto da jornada está. Números reais da base.</p>
      {bloqueio && <Bloqueado mensagem={bloqueio} />}

      {k && (
        <div className="v3-kpis">
          <Kpi valor={fmt(k.total)} rotulo="Usuários cadastrados" />
          <Kpi valor={fmt(k.hoje)} rotulo="Novos hoje" />
          <Kpi valor={fmt(k.d7)} rotulo="Novos em 7 dias" delta={k.d7Variacao} />
          <Kpi valor={fmt(k.d30)} rotulo="Novos em 30 dias" delta={k.d30Variacao} />
          <Kpi valor={fmt(k.compradores)} rotulo="Compradores" nota="Contas sem loja" />
          <Kpi valor={fmt(k.vendedores)} rotulo="Vendedores" nota="Contas com loja ou perfil de vendedor" />
          <Kpi valor={fmt(k.vendedoresComProduto)} rotulo="Vendedores com produto publicado" />
          <Kpi valor={fmt(k.vendedoresSemProduto)} rotulo="Vendedores que ainda não publicaram" />
        </div>
      )}
      {erroResumo && !bloqueio && <Aviso>Não foi possível carregar os indicadores: {erroResumo}</Aviso>}

      {resumo && (
        <div className="v3-grid" style={{ marginBottom: 18 }}>
          <div className="adm-card">
            <h3 className="adm-ct">Cadastros por dia (30 dias)</h3>
            <Barras pontos={resumo.serie.map((s: any) => ({ rotulo: diaCurto(s.dia), a: s.compradores, b: s.vendedores }))} a="Compradores" b="Vendedores" />
            <p style={{ color: 'var(--sub)', fontSize: 11.5, margin: '8px 0 0' }}>Classificação pelo tipo atual da conta.</p>
          </div>
          <div className="adm-card">
            <h3 className="adm-ct">Funil de ativação do vendedor</h3>
            <Funil etapas={resumo.funilVendedor} rodape="Contas, lojas e produtos atuais. Vendas ficam fora enquanto a integridade dos pedidos (K2) não for corrigida." />
          </div>
          <div className="adm-card">
            <h3 className="adm-ct">Cadastros por estado</h3>
            <Rank linhas={resumo.porUf.grupos.map((g: any) => ({ rotulo: UFS.find((u) => u.sigla === g.chave)?.nome || g.chave, valor: g.valor }))}
              vazio="Ainda sem estado informado."
              rodape={`Estado declarado no cadastro ou, quando não houver, aproximado pela rede. ${resumo.porUf.ocultos ? `${resumo.porUf.ocultos} pessoa(s) em grupos com menos de ${resumo.minimoGrupo} ficam agrupadas fora do ranking.` : ''}`} />
          </div>
          <div className="adm-card">
            <h3 className="adm-ct">Ranking de cidades</h3>
            <Rank linhas={resumo.porCidade.grupos.map((g: any) => ({ rotulo: g.chave, valor: g.valor }))}
              vazio={`Nenhuma cidade com pelo menos ${resumo.minimoGrupo} pessoas ainda.`}
              rodape={resumo.porCidade.ocultos ? `${resumo.porCidade.ocultos} pessoa(s) em cidades com menos de ${resumo.minimoGrupo} cadastros não aparecem, para evitar identificação.` : undefined} />
          </div>
          <div className="adm-card">
            <h3 className="adm-ct">Origem dos novos usuários (30 dias)</h3>
            <Rank linhas={resumo.origens.grupos.map((g: any) => ({ rotulo: g.chave, valor: g.valor }))} vazio="Sem cadastros no período."
              rodape="Origem registrada a partir da V3 (UTM e site de origem da visita). Cadastros anteriores aparecem como “Sem registro”." />
          </div>
        </div>
      )}

      {disp && (!disp.colunasPerfil || !disp.publicadoEm) && (
        <Aviso>
          <b>Dados parciais.</b>{' '}
          {!disp.colunasPerfil && 'Estado, cidade e origem vêm dos metadados do cadastro (só contas criadas ou atualizadas a partir da V3). '}
          {!disp.publicadoEm && 'A data da primeira publicação é aproximada (criação do primeiro produto hoje ativo) até o SQL V3 03 ser aplicado. '}
          Cadastros antigos não recebem dados inventados.
        </Aviso>
      )}

      <div className="adm-card" style={{ paddingBottom: 12 }}>
        <Chips<Periodo> valor={periodo} onChange={setPeriodo} opcoes={[['todos', 'Todos'], ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['custom', 'Personalizado']]} />
        <div className="v3-filtros">
          {periodo === 'custom' && <>
            <label>DE<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
            <label>ATÉ<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
          </>}
          <label>BUSCA<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, e-mail ou ID" /></label>
          <label>TIPO<select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option><option value="compradores">Compradores</option><option value="vendedores">Vendedores</option><option value="admins">Admins</option></select></label>
          <label>ESTADO<select value={uf} onChange={(e) => setUf(e.target.value)}><option value="">Todos</option>{(lista?.opcoes?.ufs || []).map((s: string) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>CIDADE<input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Nome exato" /></label>
          <label>ORIGEM<select value={canal} onChange={(e) => setCanal(e.target.value)}><option value="">Todas</option>{(lista?.opcoes?.canais || []).map((s: string) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>SITUAÇÃO<select value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todas</option><option value="ativo">Ativa</option><option value="restrito">Restrita</option><option value="bloqueado">Bloqueada</option></select></label>
          <label>PRODUTOS<select value={produtos} onChange={(e) => setProdutos(e.target.value)}><option value="">Todos</option><option value="com">Vendedores com produtos</option><option value="sem">Vendedores sem produtos</option></select></label>
        </div>
      </div>

      <div className="adm-card" style={{ padding: 0 }}>
        {erroLista && !bloqueio && <div style={{ padding: 16 }}><Aviso>{erroLista}</Aviso></div>}
        {!lista && !erroLista && <div className="adm-empty">Carregando…</div>}
        {lista && (
          <div className="v3-lista" aria-busy={carregando}>
            {lista.itens.length === 0 && <div className="adm-empty">Nenhum usuário com esses filtros.</div>}
            {lista.itens.map((u: any) => (
              <div className="it" key={u.id}>
                <div className="top" onClick={() => setAberto(aberto === u.id ? null : u.id)} role="button" tabIndex={0} aria-expanded={aberto === u.id}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(aberto === u.id ? null : u.id); } }}>
                  <div className="q">
                    <b>{u.nome}</b>
                    <div className="meta">{u.email || '—'}</div>
                    <div className="meta">Cadastro: {dataHora(u.criadoEm)}{u.cidade || u.uf ? ` · ${[u.cidade, u.uf].filter(Boolean).join(' / ')}${u.localizacaoFonte === 'aproximada' ? ' (aprox.)' : ''}` : ''}{u.origemCanal ? ` · ${u.origemCanal}` : ''}</div>
                  </div>
                  <div>
                    <span className={`v3-tag ${u.tipo === 'vendedor' ? 'pu' : u.tipo === 'admin' ? 'or' : ''}`}>{TIPO_ROT[u.tipo]}</span>
                    {u.situacao !== 'ativo' && <span className={`v3-tag ${SIT_TAG[u.situacao] || ''}`}>{u.situacao}</span>}
                    {u.loja && <span className="v3-tag">{LOJA_ROT[u.loja.status] || 'Loja'}</span>}
                    {u.tipo === 'vendedor' && <span className={`v3-tag ${u.produtosPublicados ? 'gr' : ''}`}>{u.produtosPublicados} publicado(s)</span>}
                  </div>
                </div>
                {aberto === u.id && (
                  <div>
                    <div className="v3-det">
                      <div><span>ID interno</span><code style={{ fontSize: 11, wordBreak: 'break-all' }}>{u.id}</code></div>
                      <div><span>Tipo de conta</span>{TIPO_ROT[u.tipo]} <em style={{ color: 'var(--sub)', fontStyle: 'normal' }}>(papel: {u.papel})</em></div>
                      <div><span>Situação</span>{u.situacao}</div>
                      <div><span>Localização</span>{u.cidade || u.uf ? `${[u.cidade, u.uf, u.pais].filter(Boolean).join(' / ')} — ${u.localizacaoFonte === 'declarada' ? 'declarada pelo usuário' : 'aproximada pela rede'}` : 'Não informada'}</div>
                      <div><span>Origem do cadastro</span>{u.origemCanal ? `${u.origemCanal}${u.origemFonte ? ' · ' + u.origemFonte : ''}${u.origemCampanha ? ' · ' + u.origemCampanha : ''}` : 'Sem registro'}</div>
                      <div><span>Entrou com</span>{u.provedor === 'google' ? 'Google' : u.provedor === 'email' ? 'E-mail e senha' : (u.provedor || '—')}</div>
                      <div><span>Último login</span>{dataHora(u.ultimoLogin)}</div>
                      <div><span>Última atividade no site</span>{u.ultimaAtividade ? dataHora(u.ultimaAtividade) : 'Sem registro'}</div>
                      {u.loja && <div><span>Loja</span>{u.loja.nome}</div>}
                      {u.tipo === 'vendedor' && <div><span>Produtos</span>{u.produtosPublicados} publicados de {u.produtosTotal}</div>}
                    </div>
                    <ul className="v3-marcos" aria-label="Marcos da conta">
                      <li><b>1.</b> Conta criada: {dataHora(u.criadoEm)}</li>
                      <li><b>2.</b> Perfil de vendedor ativado: {u.vendedorAtivadoEm ? <>{dataHora(u.vendedorAtivadoEm)} {u.vendedorAtivadoFonte === 'loja' && <em>(registrado junto com a criação da loja)</em>}</> : '—'}</li>
                      <li><b>3.</b> Loja criada: {u.loja ? dataHora(u.loja.criadaEm) : '—'}</li>
                      <li><b>4.</b> Primeiro produto publicado: {u.primeiraPublicacao ? <>{data(u.primeiraPublicacao)} {u.primeiraPublicacaoAproximada && <em>(aproximado)</em>}</> : '—'}</li>
                    </ul>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {u.loja && !u.loja.ocultarVendedor && <a className="adm-btn rp" href={`/loja/${u.loja.slug}`} target="_blank" rel="noreferrer">Ver loja pública ›</a>}
                      {u.loja && <button className="adm-btn rp" disabled={busy === u.id + ':vis'} onClick={() => visibilidade(u)} style={u.loja.ocultarVendedor ? { background: '#FF6B00', color: '#fff', border: 'none' } : undefined}>{u.loja.ocultarVendedor ? 'Vendendo como Comprei Barato' : 'Mostrar como vendedor'}</button>}
                      {onVerReclamacoes && u.tipo === 'vendedor' && <button className="adm-btn rp" onClick={onVerReclamacoes}>Reclamações</button>}
                      <button className="adm-btn rp" disabled={busy === u.id + ':aviso'} onClick={() => avisar(u.id, 'aviso')}>Mandar aviso</button>
                      <button className="adm-btn rp" disabled={busy === u.id + ':advertencia'} onClick={() => avisar(u.id, 'advertencia')}>Advertência</button>
                      {u.situacao === 'restrito'
                        ? <button className="adm-btn rp" disabled={busy === u.id + ':unrestrict'} onClick={() => acao(u.id, 'unrestrict')}>Liberar restrição</button>
                        : <button className="adm-btn rp" disabled={busy === u.id + ':restrict'} onClick={() => { if (confirm('Restringir esta conta? A pessoa poderá comprar, mas não vender nem sacar.')) acao(u.id, 'restrict'); }}>Restringir</button>}
                      {u.situacao === 'bloqueado'
                        ? <button className="adm-btn ap" disabled={busy === u.id + ':unblock'} onClick={() => acao(u.id, 'unblock')}>Desbloquear</button>
                        : <button className="adm-btn rp" style={{ color: '#E25555' }} disabled={busy === u.id + ':block'} onClick={() => { if (confirm('Bloquear esta conta? A pessoa não conseguirá mais acessar o site.')) acao(u.id, 'block'); }}>Bloquear</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {lista && (
        <div className="v3-pag">
          <span>{fmt(lista.total)} usuário(s) · página {lista.pagina} de {lista.paginas}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn rp" disabled={lista.pagina <= 1 || carregando} onClick={() => setPagina((p) => Math.max(1, p - 1))}>‹ Anterior</button>
            <button className="adm-btn rp" disabled={lista.pagina >= lista.paginas || carregando} onClick={() => setPagina((p) => p + 1)}>Próxima ›</button>
          </span>
        </div>
      )}
    </>
  );
}
