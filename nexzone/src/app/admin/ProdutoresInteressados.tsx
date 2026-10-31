'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { STATUS, TIPOS, formatarWhatsapp, linkWhatsapp } from '@/lib/recrutamento';
import { SEQUENCIA_PADRAO, corDoAdmin, descreverAcao, haQuanto, montarMensagem, situacaoAtendimento, type MensagemSequencia } from '@/lib/registroAdmin';

// Admin → Novos lojistas (lojas criadas pela página /produtores): fase de ativação, contato + configuração do Pixel/WhatsApp.
// Atendimento (SQL 34): sequência de até 3 mensagens prontas no WhatsApp de quem está logado; cada clique fica
// registrado (quem chamou, qual mensagem, quando) e quem manda a 1ª assume o lojista, para os dois admins não se atropelarem.
const dt = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const ROT_VENDE: Record<string, string> = { sim: 'Já vende', comecando: 'Começando', nao: 'Ainda não vende' };
const ROT_TIPO: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.id, t.rotulo]));
const COR: Record<string, string> = Object.fromEntries(STATUS.map((s) => [s.id, s.cor]));
const URL_PAGINA = 'https://compreibarato.com.br/produtores';
// Fase de ativação (calculada no servidor pela conta/loja/anúncios de cada lojista)
const FASE: Record<string, { rot: string; cor: string }> = {
  loja_criada: { rot: 'Loja criada · sem anúncio', cor: '#FF7A14' },
  em_revisao: { rot: 'Anúncio em revisão', cor: '#C98A00' },
  anunciando: { rot: 'Anunciando · sem venda', cor: '#4C8DFF' },
  vendendo: { rot: 'Vendendo', cor: '#20C98A' },
  sem_conta: { rot: 'Sem conta no site', cor: '#8A8AA0' },
};
const FILTROS_FASE: [string, string][] = [['todas', 'Todas as fases'], ['loja_criada', 'Sem anúncio (chamar)'], ['em_revisao', 'Em revisão'], ['anunciando', 'Sem venda'], ['vendendo', 'Vendendo'], ['sem_conta', 'Sem conta']];
/** Mensagem do WhatsApp conforme a fase: o objetivo é levar ao 1º anúncio e à 1ª venda. */
function mensagemFase(nome: string, fase?: string) {
  const p = String(nome || '').split(' ')[0] || nome;
  if (fase === 'loja_criada') return `Oi, ${p}! Aqui é do Comprei Barato. Vi que você criou sua loja 🎉 Já dá para subir o primeiro anúncio em 2 minutos: compreibarato.com.br/vender/produtos/novo. Quer ajuda com o título e o preço?`;
  if (fase === 'em_revisao') return `Oi, ${p}! Aqui é do Comprei Barato. Seu anúncio está na revisão e já já entra no ar. Enquanto isso, quer dicas para ele vender mais rápido?`;
  if (fase === 'anunciando') return `Oi, ${p}! Aqui é do Comprei Barato. Seu anúncio já está no ar 👏 Quer que eu te passe 3 ajustes rápidos (foto, título e preço) que ajudam a sair a primeira venda?`;
  if (fase === 'vendendo') return `Oi, ${p}! Aqui é do Comprei Barato. Parabéns pelas vendas! Tem mais produtos que você vende fora daqui e ainda não subiu na sua loja?`;
  return '';
}

type Config = { whatsapp: string; pixel: string; teste: string; tokenDefinido: boolean; avisar?: string[]; avisarEmail?: boolean };

export default function ProdutoresInteressados({ onContagem }: { onContagem?: (n: number) => void }) {
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [fase, setFase] = useState('todas');
  const [d, setD] = useState<{ sql20: boolean; sql34: boolean; itens: any[]; contagem: Record<string, number>; config: Config | null }>({ sql20: true, sql34: true, itens: [], contagem: {}, config: null });
  const [eu, setEu] = useState<{ id: string; nome: string }>({ id: '', nome: '' });
  const [seq, setSeq] = useState<MensagemSequencia[]>(SEQUENCIA_PADRAO);
  const [abrirSeq, setAbrirSeq] = useState(false);
  const [seqEdit, setSeqEdit] = useState<MensagemSequencia[]>(SEQUENCIA_PADRAO);
  const [atend, setAtend] = useState<'todos' | 'meus' | 'livres' | 'outros'>('todos');
  const [carregando, setCarregando] = useState(true);
  const [abrirCfg, setAbrirCfg] = useState(false);
  const [cfg, setCfg] = useState({ whatsapp: '', pixel: '', teste: '', token: '', avisar: '', avisarEmail: true });
  const [salvando, setSalvando] = useState(false);
  const [notas, setNotas] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/admin/produtores?status=${filtro}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      setD({ sql20: j.sql20 !== false, sql34: j.sql34 !== false, itens: j.itens ?? [], contagem: j.contagem ?? {}, config: j.config ?? null });
      if (j.eu) setEu(j.eu);
      if (Array.isArray(j.sequencia) && j.sequencia.length) { setSeq(j.sequencia); setSeqEdit(j.sequencia); }
      if (j.config) setCfg((c) => ({ ...c, whatsapp: j.config.whatsapp || '', pixel: j.config.pixel || '', teste: j.config.teste || '', avisar: (j.config.avisar || []).join(', '), avisarEmail: j.config.avisarEmail !== false }));
      onContagem?.(j.contagem?.novo ?? 0);
    } catch { toast('Falha ao carregar.', 'error'); }
    finally { setCarregando(false); }
  }, [filtro, onContagem]);
  useEffect(() => { carregar(); }, [carregar]);

  async function post(body: any) {
    const r = await fetch('/api/admin/produtores', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return null; }
    return j;
  }

  /** Atualiza um lojista na tela e acrescenta a ação no histórico dele (sem recarregar a lista toda). */
  function atualizarItem(id: string, campos: any, hist?: { acao: string; detalhes?: any }[]) {
    const agora = new Date().toISOString();
    setD((x) => ({ ...x, itens: x.itens.map((i) => (i.id === id ? {
      ...i, ...campos, ativacao: i.ativacao,
      historico: [...(hist || []).map((h) => ({ admin_id: eu.id, admin_nome: eu.nome, acao: h.acao, alvo_nome: i.nome, detalhes: h.detalhes || {}, criado_em: agora })).reverse(), ...(i.historico || [])].slice(0, 12),
    } : i)) }));
  }
  async function mudarStatus(id: string, status: string) {
    const antes = d.itens.find((i) => i.id === id)?.status;
    const j = await post({ acao: 'status', id, status });
    if (j) { atualizarItem(id, j.item ? { status: j.item.status, status_por: j.item.status_por, status_em: j.item.status_em } : { status }, [{ acao: 'produtor_status', detalhes: { de: antes, para: status } }]); toast('Status atualizado.', 'success'); }
  }
  /** Clique numa mensagem: o WhatsApp abre pelo link; aqui só registra quem mandou e qual. */
  function aoEnviar(e: React.MouseEvent, i: any, etapa: number) {
    const sit = situacaoAtendimento(i, eu.id);
    if (sit.tipo === 'outro' && !confirm(`${sit.nome} já está atendendo ${String(i.nome).split(' ')[0]}. Enviar a mensagem mesmo assim?`)) { e.preventDefault(); return; }
    post({ acao: 'mensagem', id: i.id, etapa }).then((j) => {
      if (!j?.item) return;
      const it = j.item;
      const hist: { acao: string; detalhes?: any }[] = [{ acao: 'whatsapp_enviado', detalhes: { etapa, titulo: etapa > 0 ? seq[etapa - 1]?.titulo : null } }];
      if (i.status === 'novo') hist.push({ acao: 'produtor_status', detalhes: { de: 'novo', para: 'conversando', automatico: true } });
      atualizarItem(i.id, { status: it.status, status_por: it.status_por, status_em: it.status_em, contato_msgs: it.contato_msgs, contato_ultimo_em: it.contato_ultimo_em, contato_ultimo_por: it.contato_ultimo_por, responsavel_id: it.responsavel_id, responsavel_nome: it.responsavel_nome, responsavel_em: it.responsavel_em }, hist);
      if (j.sql34 === false) toast('Mensagem aberta. Rode o SQL 34 para registrar quem enviou.', 'info' as any);
    });
  }
  async function atendimento(i: any, acao: 'assumir' | 'liberar') {
    const sit = situacaoAtendimento(i, eu.id);
    if (acao === 'assumir' && sit.tipo === 'outro' && !confirm(`${sit.nome} está atendendo ${String(i.nome).split(' ')[0]}. Passar o atendimento para você?`)) return;
    const j = await post({ acao, id: i.id });
    if (j?.item) { atualizarItem(i.id, { responsavel_id: j.item.responsavel_id, responsavel_nome: j.item.responsavel_nome, responsavel_em: j.item.responsavel_em }, [{ acao: acao === 'assumir' ? 'produtor_assumiu' : 'produtor_liberou' }]); toast(acao === 'assumir' ? 'Atendimento é seu agora.' : 'Atendimento liberado.', 'success'); }
  }
  async function salvarSequencia(lista: MensagemSequencia[]) {
    setSalvando(true);
    try {
      const j = await post({ acao: 'sequencia', mensagens: lista });
      if (j?.sequencia) { setSeq(j.sequencia); setSeqEdit(j.sequencia); toast('Mensagens salvas para os dois admins.', 'success'); }
    } finally { setSalvando(false); }
  }
  async function salvarNotas(id: string) {
    if (notas[id] === undefined) return;
    const j = await post({ acao: 'notas', id, notas: notas[id] });
    if (j) toast('Anotação salva.', 'success');
  }
  async function salvarConfig(extra: any = {}) {
    setSalvando(true);
    try {
      const j = await post({ acao: 'config', whatsapp: cfg.whatsapp, pixel: cfg.pixel, teste: cfg.teste, token: cfg.token, avisar: cfg.avisar, avisarEmail: cfg.avisarEmail, ...extra });
      if (j) { setD((x) => ({ ...x, config: j.config })); setCfg((c) => ({ ...c, token: '' })); toast('Configuração salva.', 'success'); }
    } finally { setSalvando(false); }
  }

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().replace(/^@/, '');
    const porFase = fase === 'todas' ? d.itens : d.itens.filter((i) => (i.ativacao?.fase || 'sem_conta') === fase);
    const porAtend = atend === 'todos' ? porFase : porFase.filter((i) => {
      const t = situacaoAtendimento(i, eu.id).tipo;
      return atend === 'meus' ? t === 'meu' : atend === 'livres' ? t === 'livre' : t === 'outro';
    });
    if (!q) return porAtend;
    return porAtend.filter((i) => [i.nome, i.whatsapp, i.email, i.instagram, i.nicho].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [d.itens, busca, fase, atend, eu.id]);
  const nAtend = useMemo(() => d.itens.reduce((m: Record<string, number>, i) => { const t = situacaoAtendimento(i, eu.id).tipo; m[t] = (m[t] || 0) + 1; return m; }, {}), [d.itens, eu.id]);

  function baixarCsv() {
    const esc = (s: unknown) => { const t = String(s ?? ''); return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const linhas = [['Data', 'Status', 'Etapa', 'Nome', 'WhatsApp', 'E-mail', 'Instagram', 'Nicho', 'O que vende', 'Já vende', 'Onde vende', 'Faturamento', 'Link', 'Campanha', 'Anúncio', 'Origem', 'Anotações'].join(';')];
    for (const i of lista) linhas.push([dt(i.criado_em), i.status, i.etapa === 2 ? 'completo' : 'só etapa 1', i.nome, '+' + i.whatsapp, i.email, i.instagram ? '@' + i.instagram : '', i.nicho, (i.tipos || []).map((t: string) => ROT_TIPO[t] || t).join(', '),
      ROT_VENDE[i.ja_vende] || '', (i.plataformas || []).join(', '), i.faturamento, i.link_produto, i.origem?.utm_campaign, i.origem?.utm_content, i.origem?.utm_source, i.notas].map(esc).join(';'));
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'produtores_interessados.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const copiar = (t: string) => { try { navigator.clipboard.writeText(t); toast('Copiado.', 'success'); } catch { toast(t, 'info' as any); } };
  const c = d.contagem;
  const config = d.config;
  const fases = d.itens.reduce((m: Record<string, number>, i) => { const f = i.ativacao?.fase || 'sem_conta'; m[f] = (m[f] || 0) + 1; return m; }, {});
  const comLoja = (fases.loja_criada || 0) + (fases.em_revisao || 0) + (fases.anunciando || 0) + (fases.vendendo || 0);
  const pendencias = [!config?.whatsapp && 'WhatsApp da equipe', !config?.pixel && 'ID do Pixel', !config?.avisar?.length && 'número para avisos no WhatsApp', !config?.tokenDefinido && 'token da API de Conversões'].filter(Boolean) as string[];

  if (!d.sql20) return <div className="adm-card"><b>Rode o SQL 20</b> no Supabase para ativar o formulário de produtores.</div>;

  return (
    <div className="pi">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="adm-card pi-topo">
        <div className="pi-link">
          <div><small>Página para os anúncios</small><b>{URL_PAGINA}</b></div>
          <button className="adm-btn rp" onClick={() => copiar(`${URL_PAGINA}?utm_source=meta&utm_medium=pago&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`)}><Icon name="copy" size={14} /> Copiar link com UTM do Meta</button>
          <a className="adm-btn rp" href="/produtores" target="_blank" rel="noreferrer"><Icon name="eye" size={14} /> Abrir página</a>
          <button className="adm-btn rp" onClick={() => setAbrirCfg((v) => !v)}><Icon name="settings" size={14} /> Pixel e WhatsApp</button>
          <button className="adm-btn rp" onClick={() => setAbrirSeq((v) => !v)}><Icon name="chat" size={14} /> Mensagens prontas</button>
        </div>
        {!d.sql34 && <p className="pi-aviso"><Icon name="alert" size={14} /> Rode o SQL 34 no Supabase para registrar quem enviou cada mensagem e quem está atendendo cada lojista.</p>}
        {abrirSeq && (
          <div className="pi-seqcfg">
            <p className="pi-seqcfg-t">Sequência do 1º contato (vale para você e para o César). Cada um envia pelo WhatsApp do próprio celular e fica registrado quem mandou. Termine sempre com uma pergunta.<br />
              Variáveis: <code>{'{nome}'}</code> nome do lojista · <code>{'{atendente}'}</code> seu nome (quem está logado) · <code>{'{jogo}'}</code> jogo do cadastro</p>
            {seqEdit.map((m, n) => (
              <div key={n} className="pi-seqcfg-m">
                <div className="pi-seqcfg-h">
                  <b>{n + 1}</b>
                  <input value={m.titulo} maxLength={30} onChange={(e) => setSeqEdit((l) => l.map((x, k) => (k === n ? { ...x, titulo: e.target.value } : x)))} placeholder="Título curto" />
                  {seqEdit.length > 1 && <button className="adm-btn rp" onClick={() => setSeqEdit((l) => l.filter((_, k) => k !== n))} title="Remover"><Icon name="trash" size={13} /></button>}
                </div>
                <textarea rows={4} maxLength={1000} value={m.texto} onChange={(e) => setSeqEdit((l) => l.map((x, k) => (k === n ? { ...x, texto: e.target.value } : x)))} />
                <em>Prévia: {montarMensagem(m.texto, { nome: 'Lucas Andrade', atendente: eu.nome, jogo: 'Free Fire' })}</em>
              </div>
            ))}
            <div className="pi-cfg-b">
              {seqEdit.length < 3 && <button className="adm-btn rp" onClick={() => setSeqEdit((l) => [...l, { titulo: `Mensagem ${l.length + 1}`, texto: '' }])}><Icon name="plus" size={13} /> Mensagem</button>}
              <button className="adm-btn ap" disabled={salvando} onClick={() => salvarSequencia(seqEdit)}>{salvando ? 'Salvando…' : 'Salvar mensagens'}</button>
              <button className="adm-btn rp" disabled={salvando} onClick={() => { if (confirm('Voltar para as 3 mensagens padrão?')) salvarSequencia(SEQUENCIA_PADRAO); }}>Restaurar padrão</button>
            </div>
          </div>
        )}
        {pendencias.length > 0 && !abrirCfg && <p className="pi-aviso"><Icon name="alert" size={14} /> Falta configurar: {pendencias.join(', ')}.</p>}
        {abrirCfg && (
          <div className="pi-cfg">
            <label><span>WhatsApp que recebe os produtores</span><input value={cfg.whatsapp} onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })} placeholder="5563999998888" inputMode="numeric" /><em>55 + DDD + número. Aparece no botão da página de obrigado.</em></label>
            <label><span>Avisar no WhatsApp a cada loja nova</span><input value={cfg.avisar} onChange={(e) => setCfg({ ...cfg, avisar: e.target.value })} placeholder="5563999998888, 5563988887777" inputMode="tel" /><em>Até 3 números (você e o César), separados por vírgula. Chega no celular na hora, pela conexão de WhatsApp do site. Use números diferentes do que está conectado.</em></label>
            <label><span>ID do Pixel do Meta</span><input value={cfg.pixel} onChange={(e) => setCfg({ ...cfg, pixel: e.target.value })} placeholder="123456789012345" inputMode="numeric" /><em>Gerenciador de Eventos → Fontes de dados → seu pixel.</em></label>
            <label><span>Token da API de Conversões {config?.tokenDefinido && <b className="pi-ok">✓ configurado</b>}</span><input type="password" value={cfg.token} onChange={(e) => setCfg({ ...cfg, token: e.target.value })} placeholder={config?.tokenDefinido ? 'Deixe em branco para manter o atual' : 'Cole o token gerado no Gerenciador de Eventos'} autoComplete="new-password" /><em>Fica guardado criptografado. Nunca aparece de novo na tela.</em></label>
            <label><span>Código de teste <small>(opcional)</small></span><input value={cfg.teste} onChange={(e) => setCfg({ ...cfg, teste: e.target.value })} placeholder="TEST12345" /><em>Só para conferir em "Testar eventos". Apague depois de testar.</em></label>
            <div className="pi-cfg-b">
              <button className="adm-btn ap" disabled={salvando} onClick={() => salvarConfig()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
              {config?.tokenDefinido && <button className="adm-btn rp" disabled={salvando} onClick={() => { if (confirm('Remover o token da API de Conversões?')) salvarConfig({ token: '', limparToken: true }); }}>Remover token</button>}
            </div>
          </div>
        )}
      </div>

      <div className="pi-kpis">
        <div><small>Cadastros</small><b>{c.todos || 0}</b></div>
        <div><small>Com loja criada</small><b>{comLoja}</b></div>
        <div><small>Sem anúncio (chamar)</small><b className="or">{fases.loja_criada || 0}</b></div>
        <div><small>Com anúncio no ar</small><b>{(fases.anunciando || 0) + (fases.vendendo || 0)}</b></div>
        <div><small>Já vendendo</small><b className="vd">{fases.vendendo || 0}</b></div>
      </div>

      <div className="adm-filters pi-fil">
        {FILTROS_FASE.map(([id, r]) => (
          <button key={id} className={`adm-fb ${fase === id ? 'on' : ''}`} onClick={() => setFase(id)}>{r}{id !== 'todas' && fases[id] ? ` (${fases[id]})` : ''}</button>
        ))}
      </div>
      <div className="adm-filters pi-fil">
        {[['todos', 'Contato: todos'], ...STATUS.map((s) => [s.id, s.rotulo])].map(([id, r]) => (
          <button key={id} className={`adm-fb ${filtro === id ? 'on' : ''}`} onClick={() => setFiltro(id)}>{r}{id !== 'todos' && c[id] ? ` (${c[id]})` : ''}</button>
        ))}
      </div>
      <div className="adm-filters pi-fil">
        {([['todos', 'Atendimento: todos'], ['livres', 'Sem responsável'], ['meus', 'Meus'], ['outros', 'Com outro admin']] as const).map(([id, r]) => (
          <button key={id} className={`adm-fb ${atend === id ? 'on' : ''}`} onClick={() => setAtend(id)}>{r}{id !== 'todos' && nAtend[id === 'livres' ? 'livre' : id === 'meus' ? 'meu' : 'outro'] ? ` (${nAtend[id === 'livres' ? 'livre' : id === 'meus' ? 'meu' : 'outro']})` : ''}</button>
        ))}
        <input className="pi-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, @, nicho…" />
        <button className="adm-btn rp" onClick={baixarCsv} disabled={!lista.length}><Icon name="download" size={14} /> CSV</button>
      </div>

      {carregando ? <div className="adm-empty">Carregando…</div> : !lista.length ? (
        <div className="adm-card adm-empty">{d.itens.length ? 'Nada encontrado nessa busca.' : 'Nenhum lojista ainda. Cada loja criada pela página /produtores aparece aqui, e o aviso chega no WhatsApp.'}</div>
      ) : lista.map((i) => (
        <div key={i.id} className="adm-card pi-item" style={{ borderLeft: `3px solid ${COR[i.status] || '#888'}` }}>
          <div className="pi-l1">
            <div className="pi-quem">
              <b>{i.nome}</b>
              <span>{formatarWhatsapp(i.whatsapp)}{i.instagram && <> · <a href={`https://instagram.com/${i.instagram}`} target="_blank" rel="noreferrer">@{i.instagram}</a></>}{i.email && <> · {i.email}</>}</span>
            </div>
            <div className="pi-acoes">
              <div className="pi-st">
                <select value={i.status} onChange={(e) => mudarStatus(i.id, e.target.value)} style={{ color: COR[i.status] }}>
                  {STATUS.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
                </select>
                {i.status_por && <small>por <b>{i.status_por}</b> · {haQuanto(i.status_em)}</small>}
              </div>
            </div>
          </div>
          {(() => {
            const sit = situacaoAtendimento(i, eu.id);
            const enviadas = Number(i.contato_msgs) || 0;
            const proxima = enviadas < seq.length ? enviadas + 1 : null;
            const msgFase = mensagemFase(i.nome, i.ativacao?.fase);
            return (
              <div className="pi-atd">
                <div className="pi-atd-quem">
                  {sit.tipo === 'livre' ? <span className="pi-resp livre">Sem responsável</span>
                    : <span className="pi-resp" style={{ color: corDoAdmin(i.responsavel_id), borderColor: corDoAdmin(i.responsavel_id) }}>{sit.tipo === 'meu' ? 'Você está atendendo' : `Com ${sit.nome}`}{i.responsavel_em ? ` · ${haQuanto(i.responsavel_em)}` : ''}</span>}
                  {d.sql34 && (sit.tipo === 'meu'
                    ? <button className="pi-lnk" onClick={() => atendimento(i, 'liberar')}>liberar</button>
                    : <button className="pi-lnk" onClick={() => atendimento(i, 'assumir')}>{sit.tipo === 'outro' ? 'passar para mim' : 'assumir'}</button>)}
                  {i.contato_ultimo_por && <span className="pi-ult">Último contato: {i.contato_ultimo_por} · {haQuanto(i.contato_ultimo_em)}</span>}
                </div>
                <div className="pi-seq">
                  {seq.map((m, n) => {
                    const etapa = n + 1;
                    const feita = enviadas >= etapa;
                    return (
                      <a key={etapa} className={`pi-sq ${feita ? 'ok' : etapa === proxima ? 'prox' : ''}`} href={linkWhatsapp(i.whatsapp, montarMensagem(m.texto, { nome: i.nome, atendente: eu.nome, jogo: i.nicho }))}
                        target="_blank" rel="noreferrer" onClick={(e) => aoEnviar(e, i, etapa)} title={montarMensagem(m.texto, { nome: i.nome, atendente: eu.nome, jogo: i.nicho })}>
                        <span className="n">{feita ? '✓' : etapa}</span>{m.titulo}
                      </a>
                    );
                  })}
                  {msgFase && <a className="pi-sq fase" href={linkWhatsapp(i.whatsapp, msgFase)} target="_blank" rel="noreferrer" onClick={(e) => aoEnviar(e, i, 0)} title={msgFase}><Icon name="chat" size={13} /> Msg da fase</a>}
                </div>
              </div>
            );
          })()}
          <div className="pi-tags">
            {i.ativacao && (() => { const f = FASE[i.ativacao.fase] || FASE.sem_conta; return <span className="pi-tag" style={{ color: f.cor, border: `1px solid ${f.cor}`, fontWeight: 900 }}>{f.rot}{i.ativacao.vendas ? ` · ${i.ativacao.vendas} vendas` : ''}</span>; })()}
            {i.ativacao?.slug && <a className="pi-tag" href={`/loja/${i.ativacao.slug}`} target="_blank" rel="noreferrer">Ver loja ↗</a>}
            <span className={`pi-tag ${i.etapa === 2 ? 'ok' : 'meio'}`}>{i.etapa === 2 ? 'Respondeu o perfil' : 'Pulou o perfil'}</span>
            {i.nicho && <span className="pi-tag">{i.nicho}</span>}
            {(i.tipos || []).map((t: string) => <span className="pi-tag" key={t}>{ROT_TIPO[t] || t}</span>)}
            {i.ja_vende && <span className="pi-tag">{ROT_VENDE[i.ja_vende]}{i.plataformas?.length ? `: ${i.plataformas.join(', ')}` : ''}</span>}
            {i.faturamento && <span className="pi-tag forte">{i.faturamento}</span>}
          </div>
          <div className="pi-meta">
            <span>{dt(i.criado_em)}</span>
            {(i.origem?.utm_campaign || i.origem?.utm_source) && <span>Origem: {[i.origem.utm_source, i.origem.utm_campaign, i.origem.utm_content].filter(Boolean).join(' · ')}</span>}
            {i.link_produto && <a href={i.link_produto} target="_blank" rel="noreferrer nofollow">Ver produto ↗</a>}
          </div>
          {(i.historico || []).length > 0 && (
            <details className="pi-hist">
              <summary>Histórico ({i.historico.length}{i.historico.length >= 12 ? '+' : ''})</summary>
              {i.historico.map((h: any, k: number) => (
                <div key={k}><span>{new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> <b style={{ color: corDoAdmin(h.admin_id) }}>{h.admin_nome || 'Admin'}</b> {descreverAcao({ ...h, alvo_nome: null })}</div>
              ))}
            </details>
          )}
          <textarea className="pi-notas" rows={1} placeholder="Anotações (ex.: retornar segunda, vende planilhas na Kiwify)…" defaultValue={i.notas || ''}
            onChange={(e) => setNotas((n) => ({ ...n, [i.id]: e.target.value }))} onBlur={() => salvarNotas(i.id)} maxLength={3000} />
        </div>
      ))}
    </div>
  );
}

const CSS = `
.pi-topo{padding:16px 18px}
.pi-link{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pi-link>div{flex:1 1 260px;min-width:0}
.pi-link small{display:block;color:var(--sub);font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
.pi-link b{font-size:15px;overflow-wrap:anywhere}
.pi-link .adm-btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.pi-aviso{margin:12px 0 0;color:#FFB27A;font-size:13px;font-weight:700;display:flex;gap:6px;align-items:center}
.pi-cfg{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:16px;padding-top:16px;border-top:1px solid var(--bd2)}
.pi-cfg label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:800}
.pi-cfg input{height:42px;border-radius:11px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 12px;font-size:14px;font-weight:700}
.pi-cfg em{font-style:normal;color:var(--sub);font-size:12px;font-weight:600}
.pi-cfg small{color:var(--sub)}
.pi-ok{color:#20C98A;font-size:12px;margin-left:6px}
.pi-cfg-b{display:flex;gap:8px;align-items:flex-end}
.pi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
.pi-kpis>div{background:var(--panel);border:1px solid var(--bd2);border-radius:16px;padding:14px 16px}
.pi-kpis small{display:block;color:var(--sub);font-size:12px;font-weight:800}
.pi-kpis b{font-family:'Outfit';font-size:26px;font-weight:900}
.pi-kpis b.or{color:#FF9A3C}.pi-kpis b.vd{color:#20C98A}
.pi-fil{flex-wrap:wrap;align-items:center}
.pi-busca{flex:1 1 200px;height:38px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 14px;font-size:14px;font-weight:700;min-width:0}
.pi-fil .adm-btn{display:inline-flex;align-items:center;gap:6px}
.pi-item{padding:16px 18px}
.pi-l1{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pi-quem{min-width:0}
.pi-quem b{font-family:'Outfit';font-size:17px;display:block}
.pi-quem span{color:var(--sub);font-size:13px;overflow-wrap:anywhere}
.pi-quem a{color:var(--or2)}
.pi-acoes{display:flex;gap:8px;align-items:center}
.pi-acoes .adm-btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.pi-acoes select{height:36px;border-radius:10px;border:1.5px solid var(--bd2);background:var(--panel2);font-weight:900;padding:0 8px}
.pi-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.pi-tag{font-size:12px;font-weight:800;padding:4px 10px;border-radius:50px;background:var(--panel2);color:var(--sub)}
.pi-tag.ok{background:#00B87A22;color:#20C98A}.pi-tag.meio{background:#FF7A1422;color:#FF9A3C}.pi-tag.forte{color:var(--tx)}
.pi-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:var(--sub);font-size:12.5px;font-weight:700}
.pi-meta a{color:var(--or2)}
.pi-st{display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.pi-st small{color:var(--sub);font-size:11.5px;font-weight:700}
.pi-atd{margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--panel2);display:flex;flex-direction:column;gap:9px}
.pi-atd-quem{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px}
.pi-resp{font-weight:900;font-size:12px;padding:3px 10px;border-radius:50px;border:1.5px solid currentColor}
.pi-resp.livre{color:#FF9A3C}
.pi-lnk{background:none;border:0;color:var(--or2);font-weight:800;font-size:12.5px;cursor:pointer;padding:0;text-decoration:underline}
.pi-ult{color:var(--sub);font-weight:700;margin-left:auto}
.pi-seq{display:flex;gap:6px;flex-wrap:wrap}
.pi-sq{display:inline-flex;align-items:center;gap:7px;padding:7px 12px 7px 7px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--panel);color:var(--tx);font-size:12.5px;font-weight:800;text-decoration:none;white-space:nowrap}
.pi-sq .n{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--bd2);font-size:11px;font-weight:900}
.pi-sq.prox{border-color:#20C98A;background:#20C98A1F}.pi-sq.prox .n{background:#20C98A;color:#fff}
.pi-sq.ok{color:var(--sub)}.pi-sq.ok .n{background:#20C98A33;color:#20C98A}
.pi-sq.fase{padding:7px 12px}
.pi-hist{margin-top:10px;font-size:12.5px}
.pi-hist summary{cursor:pointer;color:var(--sub);font-weight:800}
.pi-hist div{padding:5px 0 5px 10px;border-left:2px solid var(--bd2);margin-top:4px;color:var(--tx)}
.pi-hist div span{color:var(--sub);font-weight:700;font-size:11.5px}
.pi-seqcfg{margin-top:16px;padding-top:16px;border-top:1px solid var(--bd2);display:flex;flex-direction:column;gap:14px}
.pi-seqcfg-t{margin:0;color:var(--sub);font-size:13px;font-weight:600;line-height:1.5}
.pi-seqcfg-t code{background:var(--panel2);padding:1px 6px;border-radius:6px;color:var(--tx);font-weight:800}
.pi-seqcfg-m{display:flex;flex-direction:column;gap:6px}
.pi-seqcfg-h{display:flex;gap:8px;align-items:center}
.pi-seqcfg-h b{width:26px;height:26px;border-radius:50%;background:#20C98A;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.pi-seqcfg-h input{flex:1;height:36px;border-radius:10px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 10px;font-size:13.5px;font-weight:800;min-width:0}
.pi-seqcfg-m textarea{border-radius:11px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:9px 11px;font-size:13.5px;font-family:inherit;resize:vertical;line-height:1.45}
.pi-seqcfg-m em{font-style:normal;color:var(--sub);font-size:12px;font-weight:600;white-space:pre-wrap}
@media(max-width:700px){.pi-acoes{width:100%}.pi-st{align-items:stretch;width:100%}.pi-ult{margin-left:0;width:100%}.pi-sq{flex:1 1 auto;justify-content:center}}
.pi-notas{width:100%;margin-top:10px;border-radius:11px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:8px 10px;font-size:13.5px;resize:vertical;min-height:38px;font-family:inherit}
`;
