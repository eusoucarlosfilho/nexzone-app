'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import type { DefEvento } from '@/lib/whatsapp/eventos';
import { formatarTelefone } from '@/lib/whatsapp/telefone';

// Admin → Torpedos → WhatsApp: conexão por QR Code, provedor, teste, eventos/modelos e promoções.
// Todas as chamadas passam por /api/admin/whatsapp/* (servidor, com autorização reforçada).

type Config = {
  ativo: boolean; provedor: 'evolution'; apiUrl: string; instancia: string; limitePorMinuto: number; adminNumero: string | null;
  eventos: Record<string, { ativo: boolean; modelo: string | null }>;
  promo: { tetoDiario: number; intervaloMin: number; intervaloMax: number };
};
type Estado = 'conectado' | 'aguardando_qr' | 'desconectado' | 'sem_endereco' | 'sem_chave' | 'inacessivel' | 'chave_recusada' | 'erro';
type Status = { estado: Estado; numero: string | null; detalhe?: string };
type Campanha = { id: number; titulo: string; publico: string; status: string; total: number; created_at: string; resumo: { pendentes: number; enviados: number; falhas: number; pulados: number } };

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...init });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

const ROTULO_ESTADO: Record<Estado, string> = {
  conectado: 'Conectado', aguardando_qr: 'Aguardando leitura do QR Code', desconectado: 'Servidor no ar · WhatsApp desconectado',
  sem_endereco: 'Falta o endereço do servidor', sem_chave: 'Falta a chave (API_KEY)', inacessivel: 'Servidor inacessível',
  chave_recusada: 'Chave recusada pelo servidor', erro: 'Erro no servidor',
};
const COR_ESTADO: Record<Estado, string> = {
  conectado: 'var(--green)', aguardando_qr: '#C98A00', desconectado: '#C98A00', sem_endereco: 'var(--sub)', sem_chave: 'var(--sub)',
  inacessivel: '#E23B3B', chave_recusada: '#E23B3B', erro: '#E23B3B',
};
const URL_OK = (u: string) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/[^\s]*)?$/i.test(u);
const ROTULO_PUBLICO: Record<string, string> = { compradores: 'Compradores', vendedores: 'Vendedores', todos: 'Todos', lista: 'Lista' };

const box: React.CSSProperties = { marginBottom: 16 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel, #fff)', color: 'inherit', fontSize: 14, marginBottom: 10 };
const hint: React.CSSProperties = { display: 'block', color: 'var(--sub)', fontSize: 12, marginTop: -6, marginBottom: 10 };

export default function WhatsAppPainel() {
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [eventos, setEventos] = useState<DefEvento[]>([]);
  const [chaveMascarada, setChaveMascarada] = useState('');
  const [chaveDefinida, setChaveDefinida] = useState(false);
  const [urlSalva, setUrlSalva] = useState('');           // endereço que está gravado no servidor
  const [novaChave, setNovaChave] = useState('');         // só o que o admin DIGITAR agora (nunca vem do servidor)
  const [chaveEditavel, setChaveEditavel] = useState(false); // evita o preenchimento automático do navegador
  const [msgServidor, setMsgServidor] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [testeNum, setTesteNum] = useState('');
  const [aba, setAba] = useState<'conexao' | 'eventos' | 'promocoes'>('conexao');

  const carregar = useCallback(async () => {
    const r = await api('/api/admin/whatsapp/config');
    if (!r.ok) { setBloqueio(r.d.error || 'Indisponível.'); return; }
    setCfg(r.d.config); setEventos(r.d.eventos || []); setChaveMascarada(r.d.chaveMascarada || '');
    setChaveDefinida(!!r.d.chaveDefinida); setUrlSalva(r.d.config?.apiUrl || '');
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const consultar = useCallback(async (comQr: boolean) => {
    const r = await api(`/api/admin/whatsapp/conexao${comQr ? '?qr=1' : ''}`);
    if (!r.ok) return;
    setStatus(r.d.status);
    if (r.d.status?.estado === 'conectado') { setQr(null); setCodigo(null); setConectando(false); }
    else if (comQr && r.d.qr) { setQr(r.d.qr); setCodigo(r.d.codigoPareamento); }
  }, []);

  // Status: a cada 15 s; durante a conexão, a cada 4 s com QR atualizado. Só com a aba visível.
  useEffect(() => {
    if (bloqueio || !cfg) return;
    consultar(false);
    const t = setInterval(() => { if (document.visibilityState === 'visible') consultar(conectando); }, conectando ? 4000 : 15000);
    return () => clearInterval(t);
  }, [bloqueio, cfg, conectando, consultar]);

  // Salva interruptor, eventos e limites. NÃO envia chave (a chave só sai em "Salvar servidor").
  async function salvar(parcial?: Partial<Config>) {
    if (!cfg) return;
    const config = { ...cfg, ...parcial, apiUrl: urlSalva };
    setSalvando(true);
    const r = await api('/api/admin/whatsapp/config', { method: 'POST', body: JSON.stringify({ config }) });
    setSalvando(false);
    if (r.ok) { setCfg({ ...r.d.config }); toast('WhatsApp: configurações salvas.', 'success'); }
    else toast(r.d.error || 'Não foi possível salvar.', 'error');
  }

  // Endereço + chave do servidor (Square Cloud), com validação e status logo em seguida
  async function salvarServidor() {
    if (!cfg) return;
    const url = cfg.apiUrl.trim().replace(/\/+$/, '');
    const chave = novaChave.trim();
    setMsgServidor(null);
    if (!url) { setMsgServidor({ tipo: 'erro', texto: 'Informe o endereço do servidor.' }); return; }
    if (!URL_OK(url)) { setMsgServidor({ tipo: 'erro', texto: 'Endereço inválido: use https:// (ex.: https://seu-app.squareweb.app).' }); return; }
    if (!chave && !chaveDefinida) { setMsgServidor({ tipo: 'erro', texto: 'Informe a chave (API_KEY) da Square Cloud.' }); return; }
    if (chave && (chave.length < 24 || /\s/.test(chave))) { setMsgServidor({ tipo: 'erro', texto: 'Chave inválida: o servidor exige 24 caracteres ou mais, sem espaços. Aumente a API_KEY na Square Cloud e use a mesma aqui.' }); return; }
    setSalvando(true);
    const r = await api('/api/admin/whatsapp/config', { method: 'POST', body: JSON.stringify({ config: { ...cfg, apiUrl: url }, apiKey: chave || undefined, servidor: true }) });
    setSalvando(false);
    if (!r.ok) { setMsgServidor({ tipo: 'erro', texto: r.d.error || 'Não foi possível salvar.' }); return; }
    setCfg(r.d.config); setUrlSalva(r.d.config.apiUrl); setChaveMascarada(r.d.chaveMascarada || ''); setChaveDefinida(!!r.d.chaveDefinida);
    setNovaChave(''); setChaveEditavel(false);
    if (r.d.status) setStatus(r.d.status);
    const est: Estado | undefined = r.d.status?.estado;
    const ok = est === 'conectado' || est === 'desconectado' || est === 'aguardando_qr';
    setMsgServidor(ok
      ? { tipo: 'ok', texto: est === 'conectado' ? 'Servidor salvo. WhatsApp já conectado.' : 'Servidor salvo e respondendo. Agora clique em Conectar WhatsApp.' }
      : { tipo: 'erro', texto: `Servidor salvo, mas: ${r.d.status?.detalhe || 'não foi possível falar com ele.'}` });
  }

  async function conexao(acao: 'conectar' | 'desconectar' | 'reconectar') {
    if (acao === 'desconectar' && !confirm('Desconectar o WhatsApp? Nenhum aviso será enviado até conectar de novo.')) return;
    const r = await api('/api/admin/whatsapp/conexao', { method: 'POST', body: JSON.stringify({ acao }) });
    if (!r.ok) { toast(r.d.error || 'Falha ao falar com o servidor do WhatsApp.', 'error'); setMsgServidor({ tipo: 'erro', texto: r.d.error || 'Falha ao falar com o servidor do WhatsApp.' }); consultar(false); return; }
    if (acao === 'desconectar') { setConectando(false); setQr(null); toast('WhatsApp desconectado.', 'success'); consultar(false); return; }
    setConectando(true); setQr(r.d.qr || null); setCodigo(r.d.codigoPareamento || null);
  }

  const [testandoPix, setTestandoPix] = useState(false);
  const [resPix, setResPix] = useState<{ ok: boolean; texto: string } | null>(null);
  async function testar() {
    const r = await api('/api/admin/whatsapp/teste', { method: 'POST', body: JSON.stringify({ numero: testeNum }) });
    if (r.ok) toast('Mensagem de teste enviada.', 'success'); else toast(r.d.error || 'Falhou.', 'error');
  }
  // Manda para o número digitado tudo o que o cliente recebe: as 4 mensagens do Pix + a de pagamento confirmado
  async function testarPix() {
    setTestandoPix(true); setResPix(null);
    const r = await api('/api/admin/whatsapp/teste', { method: 'POST', body: JSON.stringify({ numero: testeNum, tipo: 'pix' }) });
    setTestandoPix(false);
    if (!r.ok) { setResPix({ ok: false, texto: r.d.error || 'Falhou.' }); toast(r.d.error || 'Falhou.', 'error'); return; }
    const avisos: string[] = r.d.avisos || [];
    setResPix({ ok: !avisos.length, texto: `${r.d.enviados} mensagens enviadas.${avisos.length ? ' Atenção: ' + avisos.join(' | ') : ' Confira no celular.'}` });
    toast('Teste do Pix enviado.', 'success');
  }

  if (bloqueio) {
    return (
      <div className="adm-card" style={box}>
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 16, marginBottom: 6 }}>WhatsApp</h2>
        <p style={{ color: 'var(--sub)', fontSize: 14 }}>{bloqueio}</p>
        <p style={{ color: 'var(--sub)', fontSize: 13, marginTop: 6 }}>As configurações de WhatsApp exigem que o seu usuário esteja em <code>ADMIN_USER_IDS</code> na Vercel (proteção da C1).</p>
      </div>
    );
  }
  if (!cfg) return <div className="adm-card" style={box}>Carregando WhatsApp…</div>;

  const st: Estado = status?.estado ?? (urlSalva ? (chaveDefinida ? 'desconectado' : 'sem_chave') : 'sem_endereco');
  const servidorSalvo = !!urlSalva && chaveDefinida; // libera Conectar mesmo antes de uma consulta dar certo

  return (
    <div className="adm-card" style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 18 }}>WhatsApp</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, cursor: 'pointer' }}>
          <input type="checkbox" checked={cfg.ativo} onChange={(e) => salvar({ ativo: e.target.checked })} disabled={salvando} style={{ width: 20, height: 20 }} />
          {cfg.ativo ? 'LIGADO' : 'DESLIGADO'}
        </label>
      </div>
      <p style={{ color: 'var(--sub)', fontSize: 13, marginBottom: 12 }}>
        Desligado, nada é enviado e o site funciona normalmente. Os avisos saem do número conectado abaixo, só para quem cadastrou WhatsApp e não desativou.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['conexao', 'eventos', 'promocoes'] as const).map((a) => (
          <button key={a} className="adm-btn" style={aba === a ? { background: 'var(--tx, #16162A)', color: '#fff' } : undefined} onClick={() => setAba(a)}>
            {a === 'conexao' ? 'Conexão e teste' : a === 'eventos' ? 'Avisos e modelos' : 'Promoções'}
          </button>
        ))}
      </div>

      {aba === 'conexao' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }} aria-live="polite">
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COR_ESTADO[st] }} aria-hidden="true" />
            <strong>{ROTULO_ESTADO[st]}</strong>
            {status?.numero && <span style={{ color: 'var(--sub)' }}>· +{status.numero}</span>}
            {status?.detalhe && <span style={{ color: 'var(--sub)', fontSize: 12 }}>· {status.detalhe}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {st !== 'conectado' && <button className="adm-btn" onClick={() => conexao('conectar')} disabled={!servidorSalvo}>Conectar WhatsApp</button>}
            {st === 'conectado' && <button className="adm-btn" onClick={() => conexao('desconectar')}>Desconectar</button>}
            <button className="adm-btn" onClick={() => conexao('reconectar')} disabled={!servidorSalvo}>Reconectar</button>
          </div>
          {conectando && st !== 'conectado' && (
            <div style={{ textAlign: 'center', padding: 14, border: '1px dashed var(--border)', borderRadius: 14, marginBottom: 14 }}>
              {qr
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qr} alt="QR Code para conectar o WhatsApp" width={260} height={260} style={{ background: '#fff', borderRadius: 10, padding: 8 }} />
                : <p>Gerando QR Code…</p>}
              <p style={{ fontSize: 13, color: 'var(--sub)', marginTop: 8 }}>No celular: WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho. O código se atualiza sozinho.</p>
              {codigo && <p style={{ fontSize: 13, marginTop: 4 }}>Ou use o código de pareamento: <strong>{codigo}</strong></p>}
              <button className="adm-btn" style={{ marginTop: 8 }} onClick={() => { setConectando(false); setQr(null); }}>Fechar</button>
            </div>
          )}

          <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, margin: '6px 0 8px' }}>Servidor do WhatsApp (Square Cloud)</h3>
          <label style={lbl}>Endereço do servidor</label>
          <input style={inp} value={cfg.apiUrl} onChange={(e) => setCfg({ ...cfg, apiUrl: e.target.value })} placeholder="Ex.: https://seu-app.squareweb.app" spellCheck={false} autoComplete="off" />
          <small style={hint}>{urlSalva ? <>Endereço salvo: <strong>{urlSalva}</strong></> : 'Nenhum endereço salvo.'} Copie o endereço do botão “Visitar” da aplicação na Square Cloud.</small>
          <label style={lbl}>Chave (API_KEY)</label>
          <input style={inp} type="password" name="wa-chave-servidor-nova" id="wa-chave-servidor-nova" autoComplete="new-password"
            data-lpignore="true" data-1p-ignore="true" data-form-type="other" spellCheck={false}
            readOnly={!chaveEditavel} onFocus={() => setChaveEditavel(true)}
            value={novaChave} onChange={(e) => setNovaChave(e.target.value)}
            placeholder={chaveDefinida ? 'Digite só se quiser trocar a chave' : 'Cole aqui a API_KEY definida na Square Cloud'} />
          <small style={hint}>{chaveDefinida ? <>Chave salva <strong>({chaveMascarada})</strong>. Deixe o campo vazio para manter.</> : 'Nenhuma chave salva.'} A chave nunca é mostrada inteira.</small>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            <div><label style={lbl}>Nome da instância</label><input style={inp} value={cfg.instancia} onChange={(e) => setCfg({ ...cfg, instancia: e.target.value })} /></div>
            <div><label style={lbl}>Limite por minuto</label><input style={inp} type="number" min={1} max={60} value={cfg.limitePorMinuto} onChange={(e) => setCfg({ ...cfg, limitePorMinuto: Number(e.target.value) })} /></div>
            <div><label style={lbl}>WhatsApp do admin (avisos de suporte)</label><input style={inp} type="tel" value={cfg.adminNumero ? formatarTelefone(cfg.adminNumero) : ''} onChange={(e) => setCfg({ ...cfg, adminNumero: e.target.value })} placeholder="(63) 99999-9999" /></div>
          </div>
          <button className="adm-btn" onClick={salvarServidor} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar servidor'}</button>
          {msgServidor && <p role="status" style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: msgServidor.tipo === 'ok' ? 'var(--green)' : '#E23B3B' }}>{msgServidor.texto}</p>}

          <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, margin: '18px 0 8px' }}>Mensagem de teste</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input style={{ ...inp, flex: '1 1 200px', marginBottom: 0 }} type="tel" value={testeNum} onChange={(e) => setTesteNum(formatarTelefone(e.target.value))} placeholder="(63) 99999-9999" />
            <button className="adm-btn" onClick={testar} disabled={st !== 'conectado'}>Enviar teste</button>
            <button className="adm-btn" onClick={testarPix} disabled={st !== 'conectado' || testandoPix} title="QR Code, aviso, código copia e cola, aviso do número e pagamento confirmado">
              {testandoPix ? 'Enviando…' : 'Testar mensagens do Pix'}
            </button>
          </div>
          <p style={{ color: 'var(--sub)', fontSize: 12.5, marginTop: 6 }}>
            "Testar mensagens do Pix" manda para esse número as 6 mensagens que o cliente recebe: QR Code, aviso do código, código copia e cola, aviso de que o número é só de notificações e, depois, a de pagamento confirmado com o link do chat. O código é de exemplo e não pode ser pago.
          </p>
          {resPix && <p role="status" style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: resPix.ok ? 'var(--green)' : '#B45309' }}>{resPix.texto}</p>}
        </>
      )}

      {aba === 'eventos' && (
        <>
          <p style={{ color: 'var(--sub)', fontSize: 13, marginBottom: 10 }}>
            Ligue/desligue cada aviso e edite o texto. Variáveis entre chaves, por exemplo {'{nome}'}, {'{produto}'}, {'{valor}'}, {'{pedido}'}, {'{link}'}. Em branco = texto padrão.
          </p>
          {Array.from(new Set(eventos.map((e) => e.grupo))).map((g) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, margin: '8px 0' }}>{g}</h3>
              {eventos.filter((e) => e.grupo === g).map((e) => {
                const ev = cfg.eventos[e.chave] || { ativo: true, modelo: null };
                return (
                  <div key={e.chave} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, cursor: 'pointer', marginBottom: 6 }}>
                      <input type="checkbox" checked={ev.ativo} onChange={(x) => setCfg({ ...cfg, eventos: { ...cfg.eventos, [e.chave]: { ...ev, ativo: x.target.checked } } })} />
                      {e.rotulo}
                    </label>
                    <textarea rows={3} style={{ ...inp, fontFamily: 'inherit' }} value={ev.modelo ?? ''} placeholder={e.padrao}
                      onChange={(x) => setCfg({ ...cfg, eventos: { ...cfg.eventos, [e.chave]: { ...ev, modelo: x.target.value || null } } })} />
                    <small style={hint}>Variáveis: {e.variaveis.map((v) => `{${v}}`).join(' ')}</small>
                  </div>
                );
              })}
            </div>
          ))}
          <button className="adm-btn" onClick={() => salvar()} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar avisos e modelos'}</button>
        </>
      )}

      {aba === 'promocoes' && <Promocoes cfg={cfg} setCfg={setCfg} salvar={salvar} salvando={salvando} conectado={st === 'conectado'} />}
    </div>
  );
}

function Promocoes({ cfg, setCfg, salvar, salvando, conectado }: { cfg: Config; setCfg: (c: Config) => void; salvar: () => void; salvando: boolean; conectado: boolean }) {
  const [lista, setLista] = useState<Campanha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: '', mensagem: '', publico: 'compradores', lista: '' });
  const [criando, setCriando] = useState(false);
  const [rodando, setRodando] = useState<number | null>(null);
  const [aviso, setAviso] = useState('');
  const parar = useRef(false);

  const carregar = useCallback(async () => {
    const r = await api('/api/admin/whatsapp/campanhas');
    if (r.ok) { setLista(r.d.campanhas || []); setErro(null); } else setErro(r.d.error || 'Indisponível.');
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => () => { parar.current = true; }, []);

  async function criar() {
    setCriando(true);
    const r = await api('/api/admin/whatsapp/campanhas', { method: 'POST', body: JSON.stringify(form) });
    setCriando(false);
    if (r.ok) { toast(`Campanha criada com ${r.d.total} destinatário(s). Revise e clique em Iniciar.`, 'success'); setForm({ titulo: '', mensagem: '', publico: 'compradores', lista: '' }); carregar(); }
    else toast(r.d.error || 'Não foi possível criar.', 'error');
  }

  async function mudar(id: number, acao: 'iniciar' | 'pausar' | 'cancelar') {
    if (acao === 'cancelar' && !confirm('Cancelar a campanha? Os envios pendentes não serão feitos.')) return;
    const r = await api(`/api/admin/whatsapp/campanhas/${id}`, { method: 'POST', body: JSON.stringify({ acao }) });
    if (!r.ok) { toast(r.d.error || 'Não foi possível.', 'error'); return; }
    if (acao === 'iniciar') rodar(id); else { parar.current = true; setRodando(null); }
    carregar();
  }

  // Fila: envia uma por vez, com intervalo aleatório, enquanto esta tela estiver aberta.
  async function rodar(id: number) {
    parar.current = false; setRodando(id);
    while (!parar.current) {
      const r = await api(`/api/admin/whatsapp/campanhas/${id}/proximo`, { method: 'POST' });
      if (!r.ok) { setAviso(r.d.error || 'Erro ao enviar.'); break; }
      const p = r.d;
      if (p.estado === 'parado') { setAviso(p.motivo); break; }
      if (p.resumo) setLista((ls) => ls.map((c) => (c.id === id ? { ...c, resumo: p.resumo } : c)));
      setAviso(p.estado === 'aguardar' ? 'Aguardando o intervalo entre mensagens…' : `Última: ${p.estado}. Próxima em ${Math.round((p.proximoEmMs || 0) / 1000)} s.`);
      await new Promise((ok) => setTimeout(ok, Math.max(300, p.proximoEmMs || 10000)));
    }
    setRodando(null); carregar();
  }

  return (
    <>
      <p style={{ color: 'var(--sub)', fontSize: 13, marginBottom: 10 }}>
        Vai só para quem tem WhatsApp cadastrado e está com &quot;novidades e promoções&quot; ligado. Toda mensagem leva o link para parar de receber.
        A fila anda <strong>com esta tela aberta</strong> (uma mensagem a cada {cfg.promo.intervaloMin}–{cfg.promo.intervaloMax} s); se fechar, ela pausa e continua de onde parou.
      </p>
      {!conectado && <p style={{ color: '#C98A00', fontSize: 13, marginBottom: 10 }}>Conecte o WhatsApp antes de iniciar uma campanha.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <div><label style={lbl}>Teto por dia</label><input style={inp} type="number" min={1} max={1000} value={cfg.promo.tetoDiario} onChange={(e) => setCfg({ ...cfg, promo: { ...cfg.promo, tetoDiario: Number(e.target.value) } })} /></div>
        <div><label style={lbl}>Intervalo mínimo (s)</label><input style={inp} type="number" min={5} max={300} value={cfg.promo.intervaloMin} onChange={(e) => setCfg({ ...cfg, promo: { ...cfg.promo, intervaloMin: Number(e.target.value) } })} /></div>
        <div><label style={lbl}>Intervalo máximo (s)</label><input style={inp} type="number" min={5} max={600} value={cfg.promo.intervaloMax} onChange={(e) => setCfg({ ...cfg, promo: { ...cfg.promo, intervaloMax: Number(e.target.value) } })} /></div>
      </div>
      <button className="adm-btn" onClick={salvar} disabled={salvando} style={{ marginBottom: 16 }}>Salvar limites</button>

      <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, margin: '6px 0 8px' }}>Nova promoção</h3>
      <label style={lbl}>Título (interno)</label>
      <input style={inp} value={form.titulo} maxLength={80} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Ofertas da semana" />
      <label style={lbl}>Mensagem</label>
      <textarea rows={5} style={{ ...inp, fontFamily: 'inherit' }} value={form.mensagem} maxLength={900} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} placeholder="Texto curto, com o link da oferta." />
      <label style={lbl}>Público</label>
      <select style={inp} value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value })}>
        <option value="compradores">Todos os compradores</option>
        <option value="vendedores">Todos os vendedores</option>
        <option value="todos">Todos os cadastrados</option>
        <option value="lista">Lista de números</option>
      </select>
      {form.publico === 'lista' && (
        <>
          <textarea rows={4} style={{ ...inp, fontFamily: 'inherit' }} value={form.lista} onChange={(e) => setForm({ ...form, lista: e.target.value })} placeholder="Um número por linha" />
          <small style={hint}>Só recebem os números de pessoas cadastradas que aceitam promoções.</small>
        </>
      )}
      <button className="adm-btn" onClick={criar} disabled={criando}>{criando ? 'Montando a fila…' : 'Criar campanha'}</button>

      <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, margin: '18px 0 8px' }}>Campanhas</h3>
      {aviso && <p style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }} aria-live="polite">{aviso}</p>}
      {erro && <p style={{ fontSize: 13, color: '#E23B3B' }}>{erro}</p>}
      {lista.length === 0 && !erro && <p style={{ fontSize: 13, color: 'var(--sub)' }}>Nenhuma campanha ainda.</p>}
      {lista.map((c) => (
        <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{c.titulo}</strong>
            <span style={{ fontSize: 12, color: 'var(--sub)' }}>{ROTULO_PUBLICO[c.publico] || c.publico} · {c.status}{rodando === c.id ? ' (enviando agora)' : ''}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--sub)', margin: '4px 0 8px' }}>
            {c.resumo.enviados} enviadas · {c.resumo.pendentes} na fila · {c.resumo.falhas} falhas · {c.resumo.pulados} puladas · total {c.total}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {c.status === 'pausada' && <button className="adm-btn" onClick={() => mudar(c.id, 'iniciar')} disabled={!conectado || rodando !== null}>Iniciar / continuar</button>}
            {c.status === 'enviando' && rodando !== c.id && <button className="adm-btn" onClick={() => rodar(c.id)} disabled={!conectado || rodando !== null}>Retomar nesta tela</button>}
            {c.status === 'enviando' && <button className="adm-btn" onClick={() => mudar(c.id, 'pausar')}>Pausar</button>}
            {(c.status === 'pausada' || c.status === 'enviando') && <button className="adm-btn" onClick={() => mudar(c.id, 'cancelar')}>Cancelar</button>}
          </div>
        </div>
      ))}
    </>
  );
}
