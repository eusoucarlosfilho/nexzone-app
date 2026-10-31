'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import DialogoSite from '@/components/DialogoSite';
import { assuntoResposta, citacao, htmlParaExibir, tamanhoLegivel } from '@/lib/caixaEmail';

// Caixa de e-mail @compreibarato.com.br dentro do admin (aba e janela própria em /admin/email).
// Entrada, Com estrela, Enviados, Arquivados, Spam e Lixeira; ler a conversa, responder, encaminhar, escrever novo.
type Item = { id: number; pasta: string; sentido: 'recebido' | 'enviado'; conversa: string; de: string; de_nome: string | null; para: string[]; cc: string[]; assunto: string; previa: string | null; anexos: { id: string | null; nome: string; tipo: string; tamanho: number }[]; lido: boolean; estrela: boolean; criado_em: string };
type Msg = Item & { texto: string | null; html: string | null; enviado_por_nome?: string | null; autenticacao?: any };
type Cfg = { sql33: boolean; temSegredo: boolean; temChave: boolean; chaveDoSite: boolean; enderecos: string[]; padrao: string; nome: string; assinatura: string; avisar: boolean; webhook: string };
type Rascunho = { de: string; para: string; cc: string; bcc: string; assunto: string; texto: string; responderA: number | null; anexos: { nome: string; tipo: string; conteudo: string; tamanho: number }[]; mostrarCc: boolean; titulo: string };

const PASTAS: [string, string, string][] = [
  ['entrada', 'inbox', 'Caixa de entrada'], ['estrela', 'star', 'Com estrela'], ['enviados', 'send', 'Enviados'],
  ['arquivo', 'archive', 'Arquivados'], ['spam', 'alert', 'Spam'], ['lixeira', 'trash', 'Lixeira'],
];
const ICONE: Record<string, string> = { inbox: 'mail', star: 'star', send: 'send', archive: 'package', alert: 'alert', trash: 'trash' };
const hojeOuData = (s: string) => {
  const d = new Date(s), h = new Date();
  return d.toDateString() === h.toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};
const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const VAZIO: Rascunho = { de: '', para: '', cc: '', bcc: '', assunto: '', texto: '', responderA: null, anexos: [], mostrarCc: false, titulo: 'Nova mensagem' };

export default function CaixaEmail({ janela = false, abrirId = null, onNaoLidos }: { janela?: boolean; abrirId?: number | null; onNaoLidos?: (n: number) => void }) {
  const [pasta, setPasta] = useState('entrada');
  const [itens, setItens] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [naoLidos, setNaoLidos] = useState(0);
  const [sql33, setSql33] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [sel, setSel] = useState<number[]>([]);
  const [aberto, setAberto] = useState<number | null>(abrirId);
  const [conversa, setConversa] = useState<Msg[]>([]);
  const [abrindo, setAbrindo] = useState(false);
  const [rasc, setRasc] = useState<Rascunho | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [verCfg, setVerCfg] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState<number[] | null>(null);
  const ultimoTopo = useRef<number | null>(null);

  const carregarCfg = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/email?config=1', { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setCfg(j); setSql33(j.sql33 !== false); if (!j.temSegredo) setVerCfg(true); }
    } catch { /* tenta de novo depois */ }
  }, []);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const r = await fetch(`/api/admin/email?pasta=${pasta}&pagina=${pagina}&q=${encodeURIComponent(buscaAtiva)}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { if (!silencioso) toast(j.error || 'Falha ao carregar a caixa.', 'error'); return; }
      setSql33(j.sql33 !== false);
      const lista: Item[] = j.itens ?? [];
      // e-mail novo chegou enquanto a caixa estava aberta: avisa
      if (silencioso && pasta === 'entrada' && lista[0] && ultimoTopo.current && lista[0].id > ultimoTopo.current && !lista[0].lido) {
        toast(`Novo e-mail de ${lista[0].de_nome || lista[0].de}`, 'info');
      }
      if (pasta === 'entrada' && lista[0]) ultimoTopo.current = Math.max(ultimoTopo.current || 0, lista[0].id);
      setItens(lista); setTotal(j.total || 0); setNaoLidos(j.naoLidos || 0); onNaoLidos?.(j.naoLidos || 0);
    } catch { if (!silencioso) toast('Sem conexão.', 'error'); }
    finally { setCarregando(false); }
  }, [pasta, pagina, buscaAtiva, onNaoLidos]);

  useEffect(() => { carregarCfg(); }, [carregarCfg]);
  useEffect(() => { setSel([]); carregar(); }, [carregar]);
  // confere e-mail novo a cada 30 s (só com a aba visível)
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') carregar(true); }, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  const abrir = useCallback(async (id: number) => {
    setAberto(id); setAbrindo(true);
    try {
      const r = await fetch(`/api/admin/email?id=${id}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { toast(j.error || 'Não foi possível abrir.', 'error'); setAberto(null); return; }
      setConversa(j.conversa || []);
      setItens((l) => l.map((x) => (x.conversa === j.mensagem.conversa ? { ...x, lido: true } : x)));
      if (janela) window.history.replaceState(null, '', `/admin/email?id=${id}`);
    } catch { toast('Sem conexão.', 'error'); }
    finally { setAbrindo(false); }
  }, [janela]);
  useEffect(() => { if (abrirId) abrir(abrirId); }, [abrirId, abrir]);

  async function post(corpo: any, ok?: string) {
    const r = await fetch('/api/admin/email', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Não foi possível.', 'error'); return null; }
    if (ok) toast(ok, 'success');
    return j;
  }
  async function acao(ids: number[], corpo: any, ok: string, fechar = false) {
    if (!ids.length) return;
    const j = await post({ ...corpo, ids }, ok);
    if (!j) return;
    setSel([]);
    if (fechar) { setAberto(null); setConversa([]); }
    carregar(true);
  }
  const idsDaConversa = () => conversa.map((m) => m.id);

  // ---------- escrever ----------
  function novo() { setRasc({ ...VAZIO, de: cfg?.padrao || '' }); }
  function responder(m: Msg, todos = false) {
    const nossos = new Set(cfg?.enderecos || []);
    const para = m.sentido === 'recebido' ? m.de : m.para[0] || '';
    const cc = todos ? [...m.para, ...m.cc].filter((e) => e !== para && !nossos.has(e)) : [];
    const de = m.sentido === 'recebido' ? (m.para.find((e) => nossos.has(e)) || cfg?.padrao || '') : m.de;
    setRasc({ ...VAZIO, de, para, cc: cc.join(', '), mostrarCc: cc.length > 0, assunto: assuntoResposta(m.assunto, 're'), texto: '\n' + citacao(m), responderA: m.id, titulo: todos ? 'Responder a todos' : 'Responder' });
  }
  function encaminhar(m: Msg) {
    setRasc({ ...VAZIO, de: cfg?.padrao || '', assunto: assuntoResposta(m.assunto, 'fwd'), texto: '\n\n---------- Mensagem encaminhada ----------' + citacao(m).replace(/^\n\n/, '\n'), titulo: 'Encaminhar' });
  }
  async function anexar(files: FileList | null) {
    if (!files || !rasc) return;
    const novos: Rascunho['anexos'] = [];
    for (const f of Array.from(files)) {
      const soma = [...rasc.anexos, ...novos].reduce((s, a) => s + a.tamanho, 0) + f.size;
      if (soma > 3 * 1024 * 1024) { toast('Anexos até 3 MB no total. Para arquivo maior, mande um link.', 'error'); break; }
      const conteudo = await new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = erro; r.readAsDataURL(f); });
      novos.push({ nome: f.name, tipo: f.type, conteudo, tamanho: f.size });
    }
    setRasc((x) => (x ? { ...x, anexos: [...x.anexos, ...novos] } : x));
  }
  async function enviar() {
    if (!rasc || enviando) return;
    if (!rasc.para.trim()) { toast('Informe para quem enviar.', 'error'); return; }
    setEnviando(true);
    try {
      const j = await post({ acao: 'enviar', de: rasc.de || cfg?.padrao, para: rasc.para, cc: rasc.cc, bcc: rasc.bcc, assunto: rasc.assunto, texto: rasc.texto, responderA: rasc.responderA, anexos: rasc.anexos.map((a) => ({ nome: a.nome, tipo: a.tipo, conteudo: a.conteudo })) }, 'E-mail enviado.');
      if (j) {
        const resp = rasc.responderA;
        setRasc(null);
        if (resp && aberto) abrir(aberto); else carregar(true);
      }
    } finally { setEnviando(false); }
  }

  // ---------- configuração ----------
  const [fc, setFc] = useState({ enderecos: '', padrao: '', nome: '', assinatura: '', segredo: '', chave: '', avisar: true });
  useEffect(() => { if (cfg) setFc({ enderecos: cfg.enderecos.join(', '), padrao: cfg.padrao, nome: cfg.nome, assinatura: cfg.assinatura, segredo: '', chave: '', avisar: cfg.avisar }); }, [cfg]);
  async function salvarCfg(extra: any = {}) {
    const j = await post({ acao: 'config', ...fc, ...extra }, 'Configuração salva.');
    if (j) carregarCfg();
  }
  const copiar = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Copiado.', 'success')).catch(() => toast(t, 'info'));

  const paginas = Math.max(1, Math.ceil(total / 50));
  const tituloPasta = PASTAS.find((p) => p[0] === pasta)?.[2] || '';
  const todosSel = itens.length > 0 && sel.length === itens.length;
  const atual = conversa[conversa.length - 1];
  const naLixeira = conversa.length > 0 && conversa.every((m) => m.pasta === 'lixeira');
  const estrelada = conversa.some((m) => m.estrela);
  const pendencias = useMemo(() => !cfg ? [] : [!cfg.sql33 && 'rodar o SQL 33', !cfg.temSegredo && 'colar o segredo do webhook'].filter(Boolean) as string[], [cfg]);

  return (
    <div className={`cx ${janela ? 'cx-janela' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="cx-topo">
        {janela && <a href="/admin" className="cx-voltar" title="Voltar ao admin"><Icon name="arrowLeft" size={16} /> Admin</a>}
        <b className="cx-marca"><Icon name="mail" size={18} /> E-mail <span>@compreibarato.com.br</span></b>
        <form className="cx-busca" onSubmit={(e) => { e.preventDefault(); setPagina(0); setBuscaAtiva(busca.trim()); }}>
          <Icon name="search" size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar e-mail (remetente, assunto, texto)" aria-label="Pesquisar e-mail" />
          {buscaAtiva && <button type="button" onClick={() => { setBusca(''); setBuscaAtiva(''); }} aria-label="Limpar busca"><Icon name="x" size={14} /></button>}
        </form>
        {!janela && <button className="cx-bt" onClick={() => window.open('/admin/email', 'caixa-email', 'width=1280,height=860')} title="Abrir a caixa numa janela separada"><Icon name="share" size={15} /> Nova janela</button>}
        <button className="cx-bt" onClick={() => setVerCfg((v) => !v)} title="Configurar a caixa"><Icon name="settings" size={15} /></button>
      </div>

      {pendencias.length > 0 && !verCfg && (
        <div className="cx-aviso"><Icon name="alert" size={15} /> Para começar a receber e-mails falta: {pendencias.join(' e ')}. <button onClick={() => setVerCfg(true)}>Configurar agora</button></div>
      )}

      {verCfg && cfg && (
        <div className="cx-cfg">
          <h3>Configurar a caixa de e-mail</h3>
          {!cfg.sql33 && <p className="cx-err">Falta rodar o SQL 33 no Supabase.</p>}
          <div className="cx-cfg-g">
            <label><span>Endereço do aviso (webhook) para colar no Resend</span>
              <div className="cx-linha"><code>{cfg.webhook}</code><button className="cx-bt" onClick={() => copiar(cfg.webhook)}><Icon name="copy" size={14} /> Copiar</button></div>
              <em>Resend › Webhooks › Add webhook › evento <b>email.received</b>.</em></label>
            <label><span>Segredo do webhook {cfg.temSegredo && <b className="cx-ok">✓ salvo</b>}</span>
              <input type="password" autoComplete="new-password" value={fc.segredo} onChange={(e) => setFc({ ...fc, segredo: e.target.value })} placeholder={cfg.temSegredo ? 'Deixe em branco para manter' : 'whsec_…'} />
              <em>No Resend, abra o webhook criado e copie o <b>Signing secret</b>. Fica guardado criptografado.</em></label>
            <label><span>Chave da API do Resend com acesso total <small>(opcional)</small> {cfg.temChave && <b className="cx-ok">✓ salva</b>}</span>
              <input type="password" autoComplete="new-password" value={fc.chave} onChange={(e) => setFc({ ...fc, chave: e.target.value })} placeholder={cfg.temChave ? 'Deixe em branco para manter' : 're_…'} />
              <em>Só se a chave que o site já usa for "somente envio": a caixa precisa ler os e-mails recebidos. {cfg.chaveDoSite ? 'Sem preencher, usa a chave do site.' : ''}</em></label>
            <label><span>Endereços para enviar (separe por vírgula)</span>
              <input value={fc.enderecos} onChange={(e) => setFc({ ...fc, enderecos: e.target.value })} placeholder="suporte@compreibarato.com.br, contato@compreibarato.com.br" /></label>
            <label><span>Enviar como padrão</span>
              <select value={fc.padrao} onChange={(e) => setFc({ ...fc, padrao: e.target.value })}>{cfg.enderecos.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
            <label><span>Nome que o cliente vê</span><input value={fc.nome} maxLength={60} onChange={(e) => setFc({ ...fc, nome: e.target.value })} /></label>
            <label className="cx-full"><span>Assinatura (vai no fim de cada e-mail)</span><textarea rows={3} value={fc.assinatura} onChange={(e) => setFc({ ...fc, assinatura: e.target.value })} /></label>
            <label className="cx-chk"><input type="checkbox" checked={fc.avisar} onChange={(e) => setFc({ ...fc, avisar: e.target.checked })} /> Avisar os admins no sino e no celular a cada e-mail novo</label>
          </div>
          <div className="cx-linha">
            <button className="cx-bt pri" onClick={() => salvarCfg()}>Salvar</button>
            {cfg.temSegredo && <button className="cx-bt" onClick={() => salvarCfg({ segredo: '', limparSegredo: true })}>Apagar segredo</button>}
            {cfg.temChave && <button className="cx-bt" onClick={() => salvarCfg({ chave: '', limparChave: true })}>Apagar chave</button>}
            <button className="cx-bt" onClick={() => setVerCfg(false)}>Fechar</button>
          </div>
        </div>
      )}

      <div className={`cx-corpo ${aberto ? 'lendo' : ''}`}>
        {/* pastas */}
        <nav className="cx-pastas" aria-label="Pastas">
          <button className="cx-escrever" onClick={novo}><Icon name="edit" size={17} /> Escrever</button>
          {PASTAS.map(([id, ic, rot]) => (
            <button key={id} className={`cx-pasta ${pasta === id ? 'on' : ''}`} onClick={() => { setPasta(id); setPagina(0); setAberto(null); setConversa([]); }}>
              <Icon name={ICONE[ic]} size={16} /> <span>{rot}</span>{id === 'entrada' && naoLidos > 0 && <i>{naoLidos}</i>}
            </button>
          ))}
        </nav>

        {/* lista */}
        <section className="cx-lista" aria-label={tituloPasta}>
          <div className="cx-barra">
            <input type="checkbox" aria-label="Selecionar todos" checked={todosSel} onChange={() => setSel(todosSel ? [] : itens.map((x) => x.id))} />
            {sel.length > 0 ? (
              <>
                <button title="Marcar como lido" onClick={() => acao(sel, { acao: 'lido', lido: true }, 'Marcado como lido.')}><Icon name="eye" size={15} /></button>
                <button title="Marcar como não lido" onClick={() => acao(sel, { acao: 'lido', lido: false }, 'Marcado como não lido.')}><Icon name="eyeOff" size={15} /></button>
                {pasta !== 'arquivo' && pasta !== 'lixeira' && <button title="Arquivar" onClick={() => acao(sel, { acao: 'mover', pasta: 'arquivo' }, 'Arquivado.')}><Icon name="package" size={15} /></button>}
                {pasta === 'spam' || pasta === 'lixeira' || pasta === 'arquivo' ? <button title="Mover para a Entrada" onClick={() => acao(sel, { acao: 'mover', pasta: 'entrada' }, 'Movido para a Entrada.')}><Icon name="undo" size={15} /></button> : null}
                {pasta !== 'spam' && pasta !== 'lixeira' && <button title="Marcar como spam" onClick={() => acao(sel, { acao: 'mover', pasta: 'spam' }, 'Movido para o Spam.')}><Icon name="alert" size={15} /></button>}
                {pasta === 'lixeira'
                  ? <button title="Excluir para sempre" onClick={() => setConfirmarExcluir(sel)}><Icon name="trash" size={15} /> Excluir</button>
                  : <button title="Mover para a Lixeira" onClick={() => acao(sel, { acao: 'mover', pasta: 'lixeira' }, 'Movido para a Lixeira.')}><Icon name="trash" size={15} /></button>}
                <small>{sel.length} selecionado{sel.length > 1 ? 's' : ''}</small>
              </>
            ) : (
              <>
                <button title="Atualizar" onClick={() => carregar()}><Icon name="undo" size={15} /></button>
                <small>{tituloPasta}{buscaAtiva ? ` · "${buscaAtiva}"` : ''}</small>
              </>
            )}
            <span className="cx-pag">
              {total > 0 && <small>{pagina * 50 + 1}–{Math.min(total, pagina * 50 + 50)} de {total}</small>}
              <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior"><Icon name="arrowLeft" size={14} /></button>
              <button disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima página"><Icon name="arrowRight" size={14} /></button>
            </span>
          </div>
          {!sql33 ? <div className="cx-vazio">Rode o SQL 33 no Supabase para ativar a caixa de e-mail.</div>
            : carregando && !itens.length ? <div className="cx-vazio">Carregando…</div>
            : !itens.length ? <div className="cx-vazio">{buscaAtiva ? 'Nada encontrado.' : pasta === 'entrada' ? 'Nenhum e-mail na Caixa de entrada.' : 'Nada por aqui.'}</div>
            : itens.map((m) => (
              <div key={m.id} className={`cx-item ${m.lido ? '' : 'novo'} ${aberto && conversa.some((c) => c.id === m.id) ? 'on' : ''}`} onClick={() => abrir(m.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrir(m.id); }}>
                <input type="checkbox" aria-label="Selecionar" checked={sel.includes(m.id)} onClick={(e) => e.stopPropagation()} onChange={() => setSel((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))} />
                <button className={`cx-est ${m.estrela ? 'on' : ''}`} aria-label={m.estrela ? 'Tirar estrela' : 'Marcar com estrela'} onClick={(e) => { e.stopPropagation(); acao([m.id], { acao: 'estrela', estrela: !m.estrela }, m.estrela ? 'Estrela removida.' : 'Marcado com estrela.'); }}>★</button>
                <div className="cx-item-t">
                  <div className="cx-l1"><b>{m.sentido === 'enviado' ? `Para: ${m.para[0] || ''}${m.para.length > 1 ? ` +${m.para.length - 1}` : ''}` : (m.de_nome || m.de)}</b><time>{hojeOuData(m.criado_em)}</time></div>
                  <div className="cx-l2">{m.assunto || '(sem assunto)'}{m.anexos?.length ? <Icon name="link" size={12} /> : null}</div>
                  <div className="cx-l3">{m.previa}</div>
                </div>
              </div>
            ))}
        </section>

        {/* leitura */}
        <section className="cx-ler" aria-label="Mensagem">
          {!aberto ? <div className="cx-vazio grande"><Icon name="mail" size={34} /><p>Escolha um e-mail para ler.</p></div>
            : abrindo && !conversa.length ? <div className="cx-vazio">Abrindo…</div>
            : atual && (
              <>
                <div className="cx-ler-topo">
                  <button className="cx-bt so-cel" onClick={() => { setAberto(null); setConversa([]); }}><Icon name="arrowLeft" size={15} /> Voltar</button>
                  <h2>{conversa[0]?.assunto || '(sem assunto)'}</h2>
                  <div className="cx-linha">
                    <button className="cx-bt" title={estrelada ? 'Tirar estrela' : 'Marcar com estrela'} onClick={() => { acao(idsDaConversa(), { acao: 'estrela', estrela: !estrelada }, estrelada ? 'Estrela removida.' : 'Marcado com estrela.'); setConversa((c) => c.map((x) => ({ ...x, estrela: !estrelada }))); }}>{estrelada ? '★' : '☆'}</button>
                    <button className="cx-bt" title="Marcar como não lido" onClick={() => acao(idsDaConversa(), { acao: 'lido', lido: false }, 'Marcado como não lido.', true)}><Icon name="eyeOff" size={15} /></button>
                    {naLixeira ? <>
                      <button className="cx-bt" onClick={() => acao(idsDaConversa(), { acao: 'mover', pasta: 'entrada' }, 'Restaurado.', true)}><Icon name="undo" size={15} /> Restaurar</button>
                      <button className="cx-bt perigo" onClick={() => setConfirmarExcluir(idsDaConversa())}><Icon name="trash" size={15} /> Excluir para sempre</button>
                    </> : <>
                      <button className="cx-bt" title="Arquivar" onClick={() => acao(idsDaConversa(), { acao: 'mover', pasta: 'arquivo' }, 'Arquivado.', true)}><Icon name="package" size={15} /> Arquivar</button>
                      <button className="cx-bt" title="Spam" onClick={() => acao(idsDaConversa(), { acao: 'mover', pasta: 'spam' }, 'Movido para o Spam.', true)}><Icon name="alert" size={15} /></button>
                      <button className="cx-bt" title="Lixeira" onClick={() => acao(idsDaConversa(), { acao: 'mover', pasta: 'lixeira' }, 'Movido para a Lixeira.', true)}><Icon name="trash" size={15} /></button>
                    </>}
                  </div>
                </div>
                <div className="cx-fio">
                  {conversa.map((m, i) => <Mensagem key={m.id} m={m} aberta={i === conversa.length - 1 || !m.lido} onResponder={() => responder(m)} onTodos={() => responder(m, true)} onEncaminhar={() => encaminhar(m)} />)}
                </div>
                <div className="cx-linha cx-resp">
                  <button className="cx-bt pri" onClick={() => responder(atual)}><Icon name="undo" size={15} /> Responder</button>
                  {(atual.para.length + atual.cc.length > 1) && <button className="cx-bt" onClick={() => responder(atual, true)}>Responder a todos</button>}
                  <button className="cx-bt" onClick={() => encaminhar(atual)}><Icon name="share" size={15} /> Encaminhar</button>
                </div>
              </>
            )}
        </section>
      </div>

      {/* janela de escrever */}
      {rasc && (
        <div className="cx-comp" role="dialog" aria-label={rasc.titulo}>
          <div className="cx-comp-t"><b>{rasc.titulo}</b><button onClick={() => setRasc(null)} aria-label="Fechar"><Icon name="x" size={16} /></button></div>
          <label className="cx-campo"><span>De</span>
            <select value={rasc.de || cfg?.padrao || ''} onChange={(e) => setRasc({ ...rasc, de: e.target.value })}>{(cfg?.enderecos || []).map((e) => <option key={e} value={e}>{cfg?.nome} &lt;{e}&gt;</option>)}</select></label>
          <label className="cx-campo"><span>Para</span><input value={rasc.para} onChange={(e) => setRasc({ ...rasc, para: e.target.value })} placeholder="cliente@email.com" autoFocus={!rasc.responderA} />
            {!rasc.mostrarCc && <button type="button" onClick={() => setRasc({ ...rasc, mostrarCc: true })}>Cc/Cco</button>}</label>
          {rasc.mostrarCc && <>
            <label className="cx-campo"><span>Cc</span><input value={rasc.cc} onChange={(e) => setRasc({ ...rasc, cc: e.target.value })} /></label>
            <label className="cx-campo"><span>Cco</span><input value={rasc.bcc} onChange={(e) => setRasc({ ...rasc, bcc: e.target.value })} /></label>
          </>}
          <label className="cx-campo"><span>Assunto</span><input value={rasc.assunto} onChange={(e) => setRasc({ ...rasc, assunto: e.target.value })} /></label>
          <textarea className="cx-texto" value={rasc.texto} onChange={(e) => setRasc({ ...rasc, texto: e.target.value })} placeholder="Escreva sua mensagem…" autoFocus={!!rasc.responderA}
            onFocus={(e) => { if (rasc.responderA && e.currentTarget.selectionStart === e.currentTarget.value.length) e.currentTarget.setSelectionRange(0, 0); }} />
          {rasc.anexos.length > 0 && <div className="cx-anexos">{rasc.anexos.map((a, i) => (
            <span key={i} className="cx-anx">{a.nome} <small>{tamanhoLegivel(a.tamanho)}</small><button onClick={() => setRasc({ ...rasc, anexos: rasc.anexos.filter((_, j) => j !== i) })} aria-label="Tirar anexo">×</button></span>
          ))}</div>}
          <div className="cx-comp-b">
            <button className="cx-bt pri" disabled={enviando} onClick={enviar}><Icon name="send" size={15} /> {enviando ? 'Enviando…' : 'Enviar'}</button>
            <label className="cx-bt" title="Anexar (até 3 MB)"><Icon name="upload" size={15} /> Anexar<input type="file" multiple hidden onChange={(e) => { anexar(e.target.files); e.target.value = ''; }} /></label>
            <small>A assinatura entra sozinha no fim.</small>
            <button className="cx-bt" style={{ marginLeft: 'auto' }} onClick={() => setRasc(null)} title="Descartar"><Icon name="trash" size={15} /></button>
          </div>
        </div>
      )}

      <DialogoSite aberto={!!confirmarExcluir} perigo titulo="Excluir para sempre?" texto="Os e-mails somem da caixa e não dá para recuperar."
        confirmar="Excluir" onConfirmar={() => { const ids = confirmarExcluir || []; setConfirmarExcluir(null); acao(ids, { acao: 'excluir' }, 'Excluído.', true); }} onFechar={() => setConfirmarExcluir(null)} />
    </div>
  );
}

function Mensagem({ m, aberta, onResponder, onTodos, onEncaminhar }: { m: Msg; aberta: boolean; onResponder: () => void; onTodos: () => void; onEncaminhar: () => void }) {
  const [abrir, setAbrir] = useState(aberta);
  const [altura, setAltura] = useState(160);
  const doc = useMemo(() => htmlParaExibir(m.html, m.texto), [m.html, m.texto]);
  const quem = m.sentido === 'enviado' ? `${m.de_nome || 'Comprei Barato'} <${m.de}>${m.enviado_por_nome ? ` · enviado por ${m.enviado_por_nome}` : ''}` : (m.de_nome ? `${m.de_nome} <${m.de}>` : m.de);
  const falhou = m.autenticacao && ['spf', 'dkim', 'dmarc'].some((k) => String(m.autenticacao?.[k] || '').toLowerCase() === 'fail');
  return (
    <article className={`cx-msg ${abrir ? 'aberta' : ''} ${m.sentido}`}>
      <header onClick={() => setAbrir((v) => !v)}>
        <span className="cx-av" aria-hidden="true">{(m.de_nome || m.de || '?').slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{quem}</b>
          {abrir ? <small>para {[...m.para, ...m.cc.map((c) => `${c} (cc)`)].join(', ')}</small> : <small className="cx-l3">{m.previa}</small>}
        </div>
        <time>{quando(m.criado_em)}</time>
      </header>
      {abrir && (
        <>
          {falhou && <p className="cx-alerta"><Icon name="alert" size={14} /> Cuidado: este e-mail falhou na verificação do remetente. Pode não ser de quem diz ser. Não clique em links nem passe dados.</p>}
          <iframe title={`E-mail: ${m.assunto}`} className="cx-html" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" style={{ height: altura }}
            onLoad={(e) => { try { const h = (e.currentTarget.contentDocument?.documentElement?.scrollHeight || 160) + 8; setAltura(Math.min(Math.max(h, 80), 4000)); } catch { /* fica a altura padrão */ } }} />
          {m.anexos?.length > 0 && (
            <div className="cx-anexos">{m.anexos.map((a, i) => a.id && m.sentido === 'recebido'
              ? <a key={i} className="cx-anx" href={`/api/admin/email/anexo?id=${m.id}&anexo=${encodeURIComponent(a.id)}`} target="_blank" rel="noopener noreferrer"><Icon name="download" size={13} /> {a.nome} <small>{tamanhoLegivel(a.tamanho)}</small></a>
              : <span key={i} className="cx-anx"><Icon name="file" size={13} /> {a.nome} <small>{tamanhoLegivel(a.tamanho)}</small></span>)}
            </div>
          )}
          <div className="cx-linha cx-msg-b">
            <button className="cx-bt" onClick={onResponder}><Icon name="undo" size={14} /> Responder</button>
            <button className="cx-bt" onClick={onTodos}>Responder a todos</button>
            <button className="cx-bt" onClick={onEncaminhar}><Icon name="share" size={14} /> Encaminhar</button>
          </div>
        </>
      )}
    </article>
  );
}

const CSS = `
.cx{--c-bg:var(--panel,#fff);--c-bg2:var(--panel2,#F6F3EF);--c-bd:var(--bd2,#EAE4DD);--c-tx:var(--tx,#16162A);--c-sub:var(--sub,#5A5A72);--c-or:#FF6B00;
  color:var(--c-tx);font-family:Nunito,system-ui,sans-serif;display:flex;flex-direction:column;gap:10px;height:calc(100vh - 140px);min-height:560px}
.cx-janela{height:100vh;padding:12px 14px;background:#F7F4F0;box-sizing:border-box}
.cx *{box-sizing:border-box}
.cx-topo{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cx-marca{display:flex;align-items:center;gap:7px;font-family:Outfit;font-size:18px;font-weight:900}
.cx-marca span{font-size:12.5px;color:var(--c-sub);font-weight:700}
.cx-voltar{display:inline-flex;align-items:center;gap:5px;color:var(--c-sub);font-weight:800;font-size:13px;text-decoration:none}
.cx-busca{flex:1 1 280px;display:flex;align-items:center;gap:8px;background:var(--c-bg2);border:1px solid var(--c-bd);border-radius:50px;padding:0 14px;height:42px;color:var(--c-sub)}
.cx-busca input{flex:1;border:0;background:none;outline:none;font-size:14px;color:var(--c-tx);min-width:0}
.cx-busca button{background:none;border:0;color:var(--c-sub);cursor:pointer}
.cx-bt{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:50px;border:1px solid var(--c-bd);background:var(--c-bg);color:var(--c-tx);font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit}
.cx-bt:hover{border-color:var(--c-or)}
.cx-bt.pri{background:var(--c-or);border-color:var(--c-or);color:#16162A}
.cx-bt.perigo{color:#D23B3B;border-color:#F0B8B8}
.cx-bt:disabled{opacity:.55;cursor:default}
.cx-linha{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cx-aviso{background:#FFF6E5;border:1px solid #FFD58A;color:#7A4B00;border-radius:12px;padding:10px 14px;font-size:13.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cx-aviso button{background:none;border:0;color:#B45309;font-weight:900;text-decoration:underline;cursor:pointer}
.cx-cfg{background:var(--c-bg);border:1px solid var(--c-bd);border-radius:16px;padding:16px;overflow:auto;max-height:60vh}
.cx-cfg h3{font-family:Outfit;margin:0 0 10px;font-size:17px}
.cx-cfg-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:12px}
.cx-cfg label{display:flex;flex-direction:column;gap:5px;font-size:13px}
.cx-cfg label>span{font-weight:800}
.cx-cfg input,.cx-cfg select,.cx-cfg textarea{border:1px solid var(--c-bd);border-radius:10px;padding:9px 11px;font-size:14px;background:var(--c-bg2);color:var(--c-tx);font-family:inherit}
.cx-cfg em{font-style:normal;color:var(--c-sub);font-size:12px}
.cx-cfg code{background:var(--c-bg2);border-radius:8px;padding:7px 9px;font-size:12.5px;word-break:break-all}
.cx-cfg .cx-full{grid-column:1/-1}
.cx-cfg .cx-chk{flex-direction:row;align-items:center;gap:8px;grid-column:1/-1}
.cx-ok{color:#13A06B}.cx-err{color:#D23B3B;font-weight:800}
.cx-corpo{flex:1;min-height:0;display:grid;grid-template-columns:200px minmax(280px,380px) 1fr;gap:10px}
.cx-pastas{display:flex;flex-direction:column;gap:3px}
.cx-escrever{display:inline-flex;align-items:center;gap:9px;height:48px;padding:0 20px;border-radius:16px;border:0;background:var(--c-or);color:#16162A;font-family:Outfit;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:8px;box-shadow:0 8px 20px rgba(255,107,0,.22)}
.cx-pasta{display:flex;align-items:center;gap:10px;height:38px;padding:0 14px;border-radius:50px;border:0;background:none;color:var(--c-tx);font-weight:700;font-size:14px;cursor:pointer;text-align:left;font-family:inherit}
.cx-pasta span{flex:1}
.cx-pasta i{font-style:normal;font-weight:900;font-size:12px}
.cx-pasta:hover{background:var(--c-bg2)}
.cx-pasta.on{background:#FFE3CC;font-weight:900}
.cx-lista,.cx-ler{background:var(--c-bg);border:1px solid var(--c-bd);border-radius:16px;overflow:auto;min-height:0}
.cx-barra{position:sticky;top:0;z-index:2;background:var(--c-bg);display:flex;align-items:center;gap:4px;padding:8px 10px;border-bottom:1px solid var(--c-bd);flex-wrap:wrap}
.cx-barra button{display:inline-flex;align-items:center;gap:4px;height:32px;min-width:32px;justify-content:center;border:0;background:none;border-radius:8px;color:var(--c-sub);cursor:pointer;font-weight:800;font-size:12.5px;font-family:inherit}
.cx-barra button:hover:not(:disabled){background:var(--c-bg2);color:var(--c-tx)}
.cx-barra button:disabled{opacity:.35}
.cx-barra small{color:var(--c-sub);font-size:12px;margin-left:4px}
.cx-pag{margin-left:auto;display:flex;align-items:center;gap:2px}
.cx-item{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-bottom:1px solid var(--c-bd);cursor:pointer}
.cx-item:hover{background:var(--c-bg2)}
.cx-item.on{background:#FFF1E6}
.cx-item.novo .cx-l1 b,.cx-item.novo .cx-l2{font-weight:900;color:var(--c-tx)}
.cx-item.novo{box-shadow:inset 3px 0 0 var(--c-or)}
.cx-item input{margin-top:3px}
.cx-est{border:0;background:none;color:#CFC8C0;font-size:17px;line-height:1;cursor:pointer;padding:0}
.cx-est.on{color:#F5B400}
.cx-item-t{flex:1;min-width:0}
.cx-l1{display:flex;justify-content:space-between;gap:8px}
.cx-l1 b{font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cx-l1 time{font-size:12px;color:var(--c-sub);white-space:nowrap}
.cx-l2{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:5px}
.cx-l3{font-size:12.5px;color:var(--c-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
.cx-vazio{padding:40px 20px;text-align:center;color:var(--c-sub);font-size:14px}
.cx-vazio.grande{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;opacity:.8}
.cx-ler{display:flex;flex-direction:column}
.cx-ler-topo{position:sticky;top:0;z-index:2;background:var(--c-bg);padding:12px 16px;border-bottom:1px solid var(--c-bd);display:flex;flex-direction:column;gap:8px}
.cx-ler-topo h2{font-family:Outfit;font-size:20px;font-weight:900;margin:0;line-height:1.25}
.cx-fio{padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.cx-msg{border:1px solid var(--c-bd);border-radius:14px;overflow:hidden;background:var(--c-bg)}
.cx-msg.enviado{border-left:3px solid #8FB8FF}
.cx-msg header{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;cursor:pointer}
.cx-msg header>div{flex:1;min-width:0;display:flex;flex-direction:column}
.cx-msg header b{font-size:13.5px;word-break:break-all}
.cx-msg header small{color:var(--c-sub);font-size:12px;word-break:break-all}
.cx-msg header time{font-size:12px;color:var(--c-sub);white-space:nowrap}
.cx-av{width:32px;height:32px;border-radius:50%;background:#FFE3CC;color:#B34700;display:flex;align-items:center;justify-content:center;font-weight:900;font-family:Outfit;flex-shrink:0}
.cx-msg.enviado .cx-av{background:#DDE8FF;color:#2453B3}
.cx-html{width:100%;border:0;display:block;background:#fff}
.cx-alerta{margin:0 12px 8px;background:#FFECEC;color:#A12A2A;border-radius:10px;padding:8px 10px;font-size:12.5px;display:flex;gap:6px;align-items:center}
.cx-anexos{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px}
.cx-anx{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--c-bd);border-radius:10px;padding:6px 10px;font-size:12.5px;font-weight:700;color:var(--c-tx);text-decoration:none;background:var(--c-bg2)}
.cx-anx small{color:var(--c-sub)}
.cx-anx button{border:0;background:none;cursor:pointer;font-size:15px;color:var(--c-sub)}
.cx-msg-b{padding:4px 12px 12px}
.cx-resp{padding:4px 16px 18px}
.cx-comp{position:fixed;right:24px;bottom:0;z-index:1000;width:min(560px,100vw);max-height:86vh;display:flex;flex-direction:column;background:#fff;color:#16162A;border-radius:16px 16px 0 0;box-shadow:0 20px 60px rgba(20,20,40,.35);border:1px solid #E5DED6}
.cx-comp-t{display:flex;justify-content:space-between;align-items:center;background:#16162A;color:#fff;padding:10px 14px;border-radius:16px 16px 0 0}
.cx-comp-t button{background:none;border:0;color:#fff;cursor:pointer}
.cx-campo{display:flex;align-items:center;gap:8px;border-bottom:1px solid #EEE7DF;padding:0 14px;min-height:40px;font-size:13.5px}
.cx-campo span{color:#6B6B80;width:58px;flex-shrink:0}
.cx-campo input,.cx-campo select{flex:1;border:0;outline:none;font-size:14px;background:none;color:#16162A;min-width:0;height:38px;font-family:inherit}
.cx-campo button{border:0;background:none;color:#6B6B80;font-weight:800;cursor:pointer;font-size:12.5px}
.cx-texto{flex:1;min-height:240px;border:0;outline:none;resize:none;padding:12px 14px;font-size:14px;line-height:1.55;font-family:inherit;color:#16162A}
.cx-comp-b{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid #EEE7DF;flex-wrap:wrap}
.cx-comp-b small{color:#6B6B80;font-size:12px}
.so-cel{display:none}
@media(max-width:1100px){.cx-corpo{grid-template-columns:170px 1fr}.cx-ler{display:none}.cx-corpo.lendo .cx-lista{display:none}.cx-corpo.lendo .cx-ler{display:flex}.so-cel{display:inline-flex;align-self:flex-start}}
@media(max-width:700px){.cx{height:auto;min-height:0}.cx-corpo{grid-template-columns:1fr}.cx-pastas{flex-direction:row;overflow-x:auto;gap:4px}.cx-escrever{position:fixed;right:16px;bottom:16px;z-index:50;margin:0}.cx-pasta{flex-shrink:0;background:var(--c-bg2)}.cx-lista,.cx-ler{max-height:none}.cx-comp{right:0;max-height:100vh;height:100vh;border-radius:0}.cx-comp-t{border-radius:0}}
`;
