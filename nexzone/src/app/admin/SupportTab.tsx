'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';
import {
  CATEGORIAS_SUPORTE, STATUS_SUPORTE, PRIORIDADES_SUPORTE, EVENTOS_SUPORTE, MENSAGEM_MAX,
  nomeCategoria, nomeStatus, corStatus, nomePrioridade, corPrioridade,
} from '@/lib/suporte/constantes';
import { enviarAnexo, validarAnexo } from '@/lib/suporte/anexoCliente';

const money = (v: any) => (v == null ? '—' : 'R$ ' + Number(v).toFixed(2).replace('.', ','));
const quando = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const dia = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
function duracao(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} dias`;
}
const NIVEL: Record<string, string> = { novo: 'Novo', verificado: 'Verificado', top: 'Top' };
const CONTA: Record<string, string> = { comprador: 'Comprador', vendedor: 'Vendedor', ambos: 'Comprador e vendedor', admin: 'Admin', visitante: 'Visitante' };

const Pill = ({ txt, cor }: { txt: string; cor: string }) => <span className="adm-pill" style={{ color: cor, background: cor + '22' }}>{txt}</span>;

export default function SupportTab({ protocoloInicial, onVerPedidos }: { protocoloInicial?: string | null; onVerPedidos?: () => void }) {
  const [filtros, setFiltros] = useState({ status: '', categoria: '', prioridade: '', responsavel: '', de: '', ate: '', q: '' });
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<{ id?: string; protocolo?: string } | null>(protocoloInicial ? { protocolo: protocoloInicial } : null);

  const carregar = useCallback(async (f = filtros) => {
    setCarregando(true); setErro('');
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as any).toString();
    try {
      const r = await fetch(`/api/admin/suporte/lista?${qs}`, { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao carregar');
      setDados(d);
    } catch (e: any) { setErro(e?.message || 'Erro ao carregar'); }
    finally { setCarregando(false); }
  }, [filtros]);

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const set = (k: string, v: string) => setFiltros((f) => ({ ...f, [k]: v }));
  const m = dados?.metricas;

  if (aberto) {
    return <ChamadoAdmin ref_={aberto} admins={dados?.admins || []} onVoltar={() => { setAberto(null); carregar(); }} onAbrir={(id) => setAberto({ id })} onVerPedidos={onVerPedidos} />;
  }

  return (
    <>
      <h1 className="adm-h">Suporte</h1>
      <p className="adm-sub">Chamados abertos pelo link “Suporte” do site. Toda a conversa fica salva aqui.</p>

      <div className="adm-stats">
        <div className="adm-stat"><div className="ic"><Icon name="bell" size={20} /></div><b>{m ? m.abertos : '—'}</b><small>Abertos (aguardando a equipe)</small></div>
        <div className="adm-stat"><div className="ic"><Icon name="hourglass" size={20} /></div><b>{m ? m.aguardandoCliente : '—'}</b><small>Aguardando cliente</small></div>
        <div className="adm-stat"><div className="ic"><Icon name="checkCircle" size={20} /></div><b>{m ? m.resolvidosMes : '—'}</b><small>Resolvidos no mês</small></div>
        <div className="adm-stat"><div className="ic"><Icon name="clock" size={20} /></div><b>{m ? (m.mediaPrimeiraRespostaMin == null ? '—' : duracao(m.mediaPrimeiraRespostaMin * 60000)) : '—'}</b><small>Tempo médio da 1ª resposta (30 dias)</small></div>
      </div>

      <div className="adm-card">
        <div className="sp-filtros">
          <input placeholder="Buscar protocolo, nome ou e-mail" value={filtros.q} onChange={(e) => set('q', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') carregar(); }} />
          <select value={filtros.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Todos os status</option>
            <option value="pendentes">Aguardando a equipe</option>
            {STATUS_SUPORTE.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select value={filtros.categoria} onChange={(e) => set('categoria', e.target.value)}>
            <option value="">Todos os tipos</option>
            {CATEGORIAS_SUPORTE.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={filtros.prioridade} onChange={(e) => set('prioridade', e.target.value)}>
            <option value="">Todas as prioridades</option>
            {PRIORIDADES_SUPORTE.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={filtros.responsavel} onChange={(e) => set('responsavel', e.target.value)}>
            <option value="">Qualquer responsável</option>
            <option value="eu">Comigo</option>
            <option value="ninguem">Sem responsável</option>
            {(dados?.admins || []).map((a: any) => <option key={a.id} value={a.id}>{a.nome || a.email}</option>)}
          </select>
          <label>De <input type="date" value={filtros.de} onChange={(e) => set('de', e.target.value)} /></label>
          <label>Até <input type="date" value={filtros.ate} onChange={(e) => set('ate', e.target.value)} /></label>
          <button className="adm-btn ap" onClick={() => carregar()} disabled={carregando}>{carregando ? 'Buscando…' : 'Filtrar'}</button>
          <button className="adm-btn rp" onClick={() => { const v = { status: '', categoria: '', prioridade: '', responsavel: '', de: '', ate: '', q: '' }; setFiltros(v); carregar(v); }}>Limpar</button>
        </div>

        {erro && <div className="adm-empty" style={{ color: '#E23B3B' }}>{erro}</div>}
        {!erro && dados && (dados.chamados.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table" style={{ minWidth: 900 }}>
              <thead><tr><th>Protocolo</th><th>Cliente</th><th>Tipo</th><th>Assunto</th><th>Status</th><th>Prioridade</th><th>Aberto em</th><th>Sem resposta</th></tr></thead>
              <tbody>
                {dados.chamados.map((t: any) => {
                  const esperando = t.last_sender_type === 'cliente' && (t.status === 'aberto' || t.status === 'em_atendimento');
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setAberto({ id: t.id })}>
                      <td style={{ fontFamily: 'Outfit', fontWeight: 800, whiteSpace: 'nowrap' }}>{t.protocol}</td>
                      <td><b style={{ display: 'block' }}>{t.requester_name}</b><span style={{ color: 'var(--sub)', fontSize: 12 }}>{t.requester_email}{t.user_id ? '' : ' · sem login'}</span></td>
                      <td style={{ color: 'var(--sub)' }}>{nomeCategoria(t.category)}</td>
                      <td style={{ maxWidth: 260, overflowWrap: 'anywhere' }}>{t.subject}</td>
                      <td><Pill txt={nomeStatus(t.status)} cor={corStatus(t.status)} /></td>
                      <td><Pill txt={nomePrioridade(t.priority)} cor={corPrioridade(t.priority)} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{quando(t.opened_at)}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 800, color: esperando ? '#FF9A3C' : 'var(--sub)' }}>{esperando ? duracao(Date.now() - new Date(t.last_message_at).getTime()) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {dados.total > dados.chamados.length && <div className="adm-empty" style={{ padding: 14 }}>Mostrando os {dados.chamados.length} mais recentes de {dados.total}. Use os filtros para achar os demais.</div>}
          </div>
        ) : <div className="adm-empty">Nenhum chamado encontrado.</div>)}
        {!dados && !erro && <div className="adm-empty">Carregando…</div>}
      </div>
      <EstiloSuporte />
    </>
  );
}

// ======================================================================
// Tela do chamado
// ======================================================================
function ChamadoAdmin({ ref_, admins: adminsLista, onVoltar, onAbrir, onVerPedidos }: {
  ref_: { id?: string; protocolo?: string }; admins: any[]; onVoltar: () => void; onAbrir: (id: string) => void; onVerPedidos?: () => void;
}) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [texto, setTexto] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [aba, setAba] = useState<'agora' | 'abertura'>('agora');
  const inputRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    const qs = ref_.id ? `id=${ref_.id}` : `protocolo=${encodeURIComponent(ref_.protocolo || '')}`;
    try {
      const r = await fetch(`/api/admin/suporte/chamado?${qs}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar');
      setD(j); setErro('');
      return j;
    } catch (e: any) { setErro(e?.message || 'Erro ao carregar'); return null; }
  }, [ref_.id, ref_.protocolo]);

  useEffect(() => {
    carregar().then((j) => { if (j) setEnviarEmail(j.config?.emailCliente !== false); });
  }, [carregar]);
  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'nearest' }); }, [d?.mensagens?.length]);

  async function acao(body: any, rotulo: string) {
    setBusy(rotulo);
    try {
      const r = await fetch('/api/admin/suporte/acao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: d.ticket.id, ...body }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Erro');
      await carregar();
      return j;
    } catch (e: any) { toast(e?.message || 'Erro', 'error'); return null; }
    finally { setBusy(null); }
  }

  async function enviar(tipo: 'responder' | 'nota') {
    if (texto.trim().length < 2) { toast('Escreva a mensagem.', 'error'); return; }
    setBusy(tipo);
    let anexo: { path: string; nome: string } | null = null;
    try { if (arquivo) anexo = await enviarAnexo(arquivo); }
    catch (e: any) { toast(e?.message || 'Erro no anexo', 'error'); setBusy(null); return; }
    const j = await acao({ acao: tipo, mensagem: texto, anexoPath: anexo?.path, anexoNome: anexo?.nome, enviarEmail: tipo === 'responder' ? enviarEmail : false }, tipo);
    if (j) {
      setTexto(''); setArquivo(null);
      if (tipo === 'nota') toast('Nota interna salva.', 'success');
      else if (j.email === 'enviado') toast('Resposta enviada por e-mail ao cliente.', 'success');
      else if (j.email === 'falhou') toast('Resposta salva, mas o e-mail não foi enviado. Use "Reenviar".', 'error');
      else toast('Resposta salva (sem e-mail).', 'success');
      setEnviarEmail(d?.config?.emailCliente !== false);
    }
  }

  if (erro) return (<><button className="adm-btn rp" onClick={onVoltar}>← Voltar</button><div className="adm-empty" style={{ color: '#E23B3B' }}>{erro}</div><EstiloSuporte /></>);
  if (!d) return (<><button className="adm-btn rp" onClick={onVoltar}>← Voltar</button><div className="adm-empty">Carregando chamado…</div><EstiloSuporte /></>);

  const t = d.ticket;
  const admins = d.admins || adminsLista;
  const nomeAdmin = (id?: string | null) => admins.find((a: any) => a.id === id)?.nome || admins.find((a: any) => a.id === id)?.email || '—';

  return (
    <>
      <button className="adm-btn rp" onClick={onVoltar} style={{ marginBottom: 14 }}>← Voltar à lista</button>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <h1 className="adm-h" style={{ margin: 0, overflowWrap: 'anywhere' }}>{t.subject}</h1>
      </div>
      <p className="adm-sub" style={{ marginBottom: 16 }}>
        <b style={{ color: 'var(--tx)' }}>{t.protocol}</b> · {nomeCategoria(t.category)} · aberto em {quando(t.opened_at)} por <b style={{ color: 'var(--tx)' }}>{t.requester_name}</b> ({t.requester_email}{t.requester_phone ? ` · WhatsApp ${t.requester_phone}` : ''}){t.user_id ? '' : ' · sem login'}
      </p>

      <div className="sp-grid">
        {/* ===== Coluna esquerda: conversa ===== */}
        <div style={{ minWidth: 0 }}>
          <div className="adm-card sp-controles">
            <label>Status
              <select value={t.status} disabled={!!busy} onChange={(e) => acao({ acao: 'status', valor: e.target.value }, 'status')}>
                {STATUS_SUPORTE.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label>Prioridade
              <select value={t.priority} disabled={!!busy} onChange={(e) => acao({ acao: 'prioridade', valor: e.target.value }, 'prioridade')}>
                {PRIORIDADES_SUPORTE.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label>Responsável
              <select value={t.assigned_to || ''} disabled={!!busy} onChange={(e) => acao({ acao: 'atribuir', valor: e.target.value || null }, 'atribuir')}>
                <option value="">Ninguém</option>
                {admins.map((a: any) => <option key={a.id} value={a.id}>{a.nome || a.email}{a.id === d.eu ? ' (eu)' : ''}</option>)}
              </select>
            </label>
          </div>

          <div className="adm-card sp-chat">
            {d.mensagens.map((msg: any) => {
              const cls = msg.is_internal_note ? 'nota' : msg.sender_type;
              const autor = msg.sender_type === 'cliente' ? t.requester_name : msg.sender_type === 'sistema' ? 'Sistema' : (msg.autor_nome || 'Admin');
              return (
                <div key={msg.id} className={`sp-bal ${cls}`}>
                  <div className="quem">
                    <b>{autor}</b> · {quando(msg.created_at)}
                    {msg.is_internal_note && <span className="tag">Nota interna · o cliente não vê</span>}
                  </div>
                  <div className="txt">{msg.body}</div>
                  {msg.tem_anexo && (
                    <a className="anx" href={`/api/suporte/anexo?m=${msg.id}`} target="_blank" rel="noopener noreferrer"><Icon name="file" size={14} /> {msg.attachment_name || 'anexo'}</a>
                  )}
                  {!msg.is_internal_note && <StatusEmail msg={msg} busy={busy === `reenviar-${msg.id}`} onReenviar={async () => {
                    const j = await acao({ acao: 'reenviar', mensagemId: msg.id }, `reenviar-${msg.id}`);
                    if (j) toast(j.ok ? 'E-mail reenviado.' : (j.error || 'Falhou de novo.'), j.ok ? 'success' : 'error');
                  }} />}
                </div>
              );
            })}
            <div ref={fimRef} />
          </div>

          <div className="adm-card">
            <textarea className="sp-txt" rows={5} value={texto} maxLength={MENSAGEM_MAX} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a resposta ao cliente ou uma nota interna…" />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, margin: '10px 0 12px' }}>
              <button type="button" className="adm-btn rp" onClick={() => inputRef.current?.click()} disabled={!!busy}><Icon name="upload" size={14} /> {arquivo ? 'Trocar anexo' : 'Anexar'}</button>
              {arquivo && <span style={{ fontSize: 13, color: 'var(--sub)', overflowWrap: 'anywhere' }}>{arquivo.name} <button type="button" onClick={() => setArquivo(null)} style={{ background: 'none', border: 'none', color: '#E23B3B', cursor: 'pointer', fontWeight: 800 }}>remover</button></span>}
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; if (!f) return; const m = validarAnexo(f); if (m) { toast(m, 'error'); return; } setArquivo(f); }} />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, marginLeft: 'auto', cursor: 'pointer' }}>
                <input type="checkbox" checked={enviarEmail} onChange={(e) => setEnviarEmail(e.target.checked)} style={{ width: 17, height: 17, accentColor: '#FF6B00' }} />
                Enviar e-mail ao cliente
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="adm-btn ap" disabled={!!busy} onClick={() => enviar('responder')}>{busy === 'responder' ? 'Enviando…' : 'Responder ao cliente'}</button>
              <button className="adm-btn rp" disabled={!!busy} onClick={() => enviar('nota')} style={{ borderColor: '#B7791F', color: '#E0A63A' }}>{busy === 'nota' ? 'Salvando…' : 'Nota interna'}</button>
            </div>
            <small style={{ display: 'block', marginTop: 10, color: 'var(--sub)', fontSize: 12 }}>
              Responder salva e (se marcado) envia por e-mail; o chamado passa para “Aguardando cliente”. Nota interna só fica salva aqui: nunca vai para o cliente.
            </small>
          </div>

          <div className="adm-card">
            <h3 className="adm-ct">Linha do tempo</h3>
            {d.eventos.length ? d.eventos.map((e: any) => (
              <div key={e.id} className="sp-ev">
                <span className="pt" />
                <div>
                  <b>{EVENTOS_SUPORTE[e.event_type] || e.event_type}</b>
                  {(e.from_value || e.to_value) && e.event_type !== 'atribuido' && <span> · {fmtValor(e.from_value)} → {fmtValor(e.to_value)}</span>}
                  {e.event_type === 'atribuido' && <span> · {e.from_value ? nomeAdmin(e.from_value) : 'ninguém'} → {e.to_value ? nomeAdmin(e.to_value) : 'ninguém'}</span>}
                  <div style={{ fontSize: 12, color: 'var(--sub)' }}>{quando(e.created_at)} · {e.autor_nome}</div>
                </div>
              </div>
            )) : <div className="adm-empty" style={{ padding: 12 }}>Sem eventos.</div>}
          </div>
        </div>

        {/* ===== Coluna direita: cliente ===== */}
        <div style={{ minWidth: 0 }}>
          <div className="adm-card">
            <div className="adm-filters" style={{ marginBottom: 12 }}>
              <button className={`adm-fb ${aba === 'agora' ? 'on' : ''}`} onClick={() => setAba('agora')}>Agora (ao vivo)</button>
              <button className={`adm-fb ${aba === 'abertura' ? 'on' : ''}`} onClick={() => setAba('abertura')}>Na abertura</button>
            </div>
            <PainelCliente c={aba === 'agora' ? d.aoVivo : t.customer_snapshot} detalhado={aba === 'agora'} onAbrir={onAbrir} />
          </div>

          {d.pedido && (
            <div className="adm-card">
              <h3 className="adm-ct">Pedido vinculado</h3>
              <Linha r="Produto" v={d.pedido.titulo || '—'} />
              <Linha r="Loja" v={d.pedido.loja || '—'} />
              <Linha r="Valor" v={money(d.pedido.total)} />
              <Linha r="Status" v={d.pedido.status} />
              <Linha r="Data" v={quando(d.pedido.created_at)} />
              <Linha r="ID" v={d.pedido.id} />
              {onVerPedidos && <button className="adm-btn rp" style={{ marginTop: 10 }} onClick={onVerPedidos}>Abrir aba Pedidos</button>}
            </div>
          )}
        </div>
      </div>
      <EstiloSuporte />
    </>
  );
}

function fmtValor(v?: string | null) {
  if (!v) return '—';
  if (STATUS_SUPORTE.some((s) => s.id === v)) return nomeStatus(v);
  if (PRIORIDADES_SUPORTE.some((p) => p.id === v)) return nomePrioridade(v);
  return v;
}

function StatusEmail({ msg, busy, onReenviar }: { msg: any; busy: boolean; onReenviar: () => void }) {
  const s = msg.email_status;
  const paraAdmins = msg.sender_type === 'cliente';
  if (s === 'nao_aplicavel') return null;
  let txt = ''; let cor = 'var(--sub)'; let reenviar = false;
  if (s === 'enviado') { txt = `${paraAdmins ? 'Aviso aos admins enviado' : 'E-mail enviado'} ${quando(msg.email_sent_at)}`; cor = '#3DDC97'; }
  else if (s === 'desativado') { txt = paraAdmins ? 'Aviso aos admins não enviado (notificação desativada)' : 'E-mail não enviado (notificação desativada)'; }
  else if (s === 'pendente') { txt = 'Enviando e-mail…'; }
  else { txt = paraAdmins ? 'Aviso aos admins não enviado' : 'E-mail não enviado'; cor = '#E23B3B'; reenviar = true; }
  return (
    <div className="mail" style={{ color: cor }} title={msg.email_error || ''}>
      <Icon name="mail" size={12} /> {txt}
      {reenviar && <button onClick={onReenviar} disabled={busy}>{busy ? 'Reenviando…' : 'Reenviar'}</button>}
    </div>
  );
}

const Linha = ({ r, v }: { r: string; v: any }) => (
  <div className="sp-linha"><span>{r}</span><b>{v}</b></div>
);

function PainelCliente({ c, detalhado, onAbrir }: { c: any; detalhado: boolean; onAbrir: (id: string) => void }) {
  if (!c || c.erro) return <div className="adm-empty" style={{ padding: 12 }}>{c?.erro ? `Não foi possível montar o resumo: ${c.erro}` : 'Sem dados.'}</div>;
  const loja = c.loja;
  return (
    <div>
      {c.gerado_em && <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 10 }}>{detalhado ? 'Dados de agora' : `Foto de ${quando(c.gerado_em)}`}</div>}
      {c.origem === 'email_nao_verificado' && <div className="sp-aviso">Aberto sem login. Conta achada pelo e-mail informado, que não foi confirmado.</div>}
      {!c.conta_encontrada && <div className="sp-aviso">Visitante: nenhuma conta com este e-mail.</div>}
      {c.conta_encontrada && (
        <>
          <Linha r="Tipo de conta" v={CONTA[c.tipo_conta] || c.tipo_conta} />
          <Linha r="Cadastro" v={dia(c.cadastro_em)} />
          {c.status_conta && c.status_conta !== 'ativo' && <Linha r="Situação da conta" v={c.status_conta} />}
          <Linha r="CB Points" v={Number(c.cb_points || 0).toLocaleString('pt-BR')} />
          <Linha r="Compras" v={`${c.compras_qtd} · ${money(c.total_gasto)}`} />
          {loja ? (
            <>
              <div className="sp-sec">Loja {loja.nome}</div>
              <Linha r="Nível da loja" v={`${NIVEL[loja.nivel] || loja.nivel} · selo ${loja.selo}`} />
              <Linha r="Total vendido" v={money(loja.total_vendido)} />
              <Linha r="Vendas" v={loja.vendas_qtd} />
              <Linha r="Saldo disponível" v={money(loja.saldo_disponivel)} />
              <Linha r="Saldo pendente" v={money(loja.saldo_pendente)} />
              <div className="sp-sec">Produtos ({loja.produtos_qtd})</div>
              {(loja.produtos || []).slice(0, detalhado ? 50 : 20).map((p: any) => (
                <div key={p.id} className="sp-linha">
                  <a href={`/produto/${p.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--or2)', overflowWrap: 'anywhere' }}>{p.titulo}</a>
                  <b>{money(p.preco)} · {p.status}</b>
                </div>
              ))}
              {detalhado && (loja.vendas_recentes || []).length > 0 && (
                <>
                  <div className="sp-sec">Vendas recentes</div>
                  {loja.vendas_recentes.map((o: any) => <Linha key={o.id} r={`${dia(o.created_at)} · ${o.titulo || 'Produto'}`} v={`${money(o.total)} · ${o.status}`} />)}
                </>
              )}
            </>
          ) : <div style={{ fontSize: 13, color: 'var(--sub)', margin: '8px 0' }}>Não tem loja.</div>}
          {detalhado && (c.compras_recentes || []).length > 0 && (
            <>
              <div className="sp-sec">Compras recentes</div>
              {c.compras_recentes.map((o: any) => <Linha key={o.id} r={`${dia(o.created_at)} · ${o.titulo || 'Produto'}`} v={`${money(o.total)} · ${o.status}`} />)}
            </>
          )}
          <div className="sp-sec">Histórico</div>
          <Linha r="Reclamações anteriores" v={c.reclamacoes_anteriores ?? 0} />
        </>
      )}
      <Linha r="Chamados anteriores" v={c.chamados_anteriores ?? 0} />
      {detalhado && (c.chamados_lista || []).map((x: any) => (
        <div key={x.id} className="sp-linha">
          <button onClick={() => onAbrir(x.id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--or2)', cursor: 'pointer', textAlign: 'left', overflowWrap: 'anywhere' }}>{x.protocol} · {x.subject}</button>
          <b>{nomeStatus(x.status)}</b>
        </div>
      ))}
    </div>
  );
}

function EstiloSuporte() {
  return (
    <style>{`
      .sp-filtros{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center}
      .sp-filtros input,.sp-filtros select,.sp-controles select{height:40px;border-radius:10px;border:1px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 10px;font-size:13px;font-family:inherit}
      .sp-filtros input[type=text],.sp-filtros input:not([type]){flex:1 1 220px}
      .sp-filtros label{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--sub);font-weight:800}
      .sp-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:20px;align-items:start}
      @media(max-width:1100px){.sp-grid{grid-template-columns:1fr}}
      .sp-controles{display:flex;flex-wrap:wrap;gap:12px}
      .sp-controles label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:var(--sub);flex:1 1 150px}
      .sp-chat{display:flex;flex-direction:column;gap:12px;max-height:620px;overflow-y:auto}
      .sp-bal{max-width:88%;border-radius:14px;padding:11px 13px;border:1px solid var(--bd2);background:var(--panel2)}
      .sp-bal.cliente{align-self:flex-start}
      .sp-bal.admin{align-self:flex-end;background:#FF6B0018;border-color:#FF6B0055}
      .sp-bal.nota{align-self:flex-end;background:#B7791F1F;border:1px dashed #E0A63A}
      .sp-bal.sistema{align-self:center;max-width:100%;font-size:13px;color:var(--sub);text-align:center}
      .sp-bal .quem{font-size:12px;color:var(--sub);margin-bottom:5px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
      .sp-bal .quem b{color:var(--tx)}
      .sp-bal .tag{font-size:10.5px;font-weight:900;background:#E0A63A;color:#16162A;border-radius:50px;padding:1px 8px}
      .sp-bal .txt{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.5}
      .sp-bal .anx{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;font-weight:800;color:var(--or2)}
      .sp-bal .mail{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px;font-size:11.5px;font-weight:800}
      .sp-bal .mail button{border:1px solid currentColor;background:none;color:inherit;border-radius:50px;padding:2px 10px;font-weight:900;cursor:pointer;font-size:11.5px}
      .sp-txt{width:100%;border-radius:12px;border:1px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:12px;font-size:14px;font-family:inherit;resize:vertical}
      .sp-ev{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd);font-size:13px}
      .sp-ev:last-child{border-bottom:none}
      .sp-ev .pt{width:9px;height:9px;border-radius:50%;background:#FF6B00;margin-top:5px;flex-shrink:0}
      .sp-linha{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px}
      .sp-linha span{color:var(--sub)}
      .sp-linha b{text-align:right;overflow-wrap:anywhere}
      .sp-sec{font-family:'Outfit';font-weight:800;font-size:14px;margin:14px 0 4px}
      .sp-aviso{background:#B7791F22;color:#E0A63A;border-radius:10px;padding:8px 10px;font-size:12.5px;font-weight:800;margin-bottom:10px}
    `}</style>
  );
}
