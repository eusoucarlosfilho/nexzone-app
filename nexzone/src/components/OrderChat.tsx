'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import TextoFormatado from '@/components/TextoFormatado';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { createClient } from '@/lib/supabase/client';
import { AVISO_SEGURANCA, BUCKET_CHAT, ANEXO_CHAT_TIPOS, validarAnexoChat, tamanhoLegivel, produtosNaMensagem, textoSemLinksDeProduto, linkDoProduto } from '@/lib/conversas';

type Anexo = { url: string; nome: string; tipo: string; tamanho: number };
type Msg = { id: string; papel: string; texto: string; created_at: string; mine: boolean; anexo?: Anexo; alerta?: string; enviando?: boolean; retida?: boolean };
type Produto = { id: string; titulo: string; preco: number; precoDe: number | null; capa_url: string | null; ativo?: boolean; loja?: string };
const SITE = 'https://www.compreibarato.com.br';
const brl = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

const hora = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function OrderChat({ orderId, theme = 'light', readOnly = false, moderator = false }: { orderId: string; theme?: 'light' | 'dark'; readOnly?: boolean; moderator?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [contraparte, setContraparte] = useState<string>('');
  const [meuPapel, setMeuPapel] = useState<string>('');
  const [lojaNome, setLojaNome] = useState<string | null>(null); // só vem preenchido quando a loja vende como Comprei Barato
  const [recursos, setRecursos] = useState<{ anexos: boolean; produtos?: boolean }>({ anexos: false });
  const [produtos, setProdutos] = useState<Record<string, Produto>>({});
  const [chat, setChat] = useState<{ fechado: boolean; fechaEm: string | null }>({ fechado: false, fechaEm: null });
  const [catalogo, setCatalogo] = useState<Produto[] | null>(null); // vendedor: escolher um produto da loja
  const [abrirCatalogo, setAbrirCatalogo] = useState(false);
  const [anexo, setAnexo] = useState<File | null>(null);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const campoRef = useRef<HTMLTextAreaElement | null>(null);
  const pertoDoFim = useRef(true);
  const [regra, setRegra] = useState(false);
  const arqRef = useRef<HTMLInputElement | null>(null);

  const dark = theme === 'dark';
  const C = {
    panel: dark ? '#16161F' : '#fff',
    bd: dark ? '#2A2A3A' : '#ECECF2',
    tx: dark ? '#EDEDF5' : '#1A1A2E',
    sub: dark ? '#9292AC' : '#8A8A9E',
    bubbleOther: dark ? '#1C1C28' : '#F1F1F6',
    inputBg: dark ? '#1C1C28' : '#fff',
  };

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat?orderId=${orderId}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setMsgs((atual) => [...(d.messages || []), ...atual.filter((m) => m.enviando)]);
      setLojaNome(d.oficial ? (d.loja || null) : null);
      if (d.contraparte) setContraparte(String(d.contraparte));
      if (d.role) setMeuPapel(String(d.role));
      if (d.recursos) setRecursos(d.recursos);
      if (d.produtos) setProdutos(d.produtos);
      if (d.chat) setChat(d.chat);
      setCarregou(true);
    } catch {}
  }, [orderId]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [carregar]);

  // Rola só a caixa de mensagens (nunca a página inteira) e só se a pessoa já estava perto do fim
  useEffect(() => {
    const b = boxRef.current;
    if (b && pertoDoFim.current) b.scrollTop = b.scrollHeight;
  }, [msgs.length]);
  const aoRolar = () => { const b = boxRef.current; if (b) pertoDoFim.current = b.scrollHeight - b.scrollTop - b.clientHeight < 80; };
  // Campo cresce até 4 linhas
  useEffect(() => {
    const c = campoRef.current; if (!c) return;
    c.style.height = 'auto'; c.style.height = `${Math.min(c.scrollHeight, 112)}px`;
    c.style.overflowY = c.scrollHeight > 112 ? 'auto' : 'hidden';
  }, [texto]);
  // Celular: ao abrir o teclado, mantém o campo visível acima dele
  const aoFocar = () => { setTimeout(() => campoRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300); };

  function escolher(f: File | null) {
    if (!f) return;
    const erro = validarAnexoChat(f.type, f.size);
    if (erro) { toast(erro, 'error'); return; }
    setAnexo(f);
  }

  async function subirAnexo(f: File): Promise<{ path: string; nome: string }> {
    const r = await fetch('/api/chat/anexo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ orderId, tipo: f.type, tamanho: f.size }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.path || !d.token) throw new Error(d.error || 'Não foi possível enviar o anexo.');
    const { error } = await createClient().storage.from(BUCKET_CHAT).uploadToSignedUrl(d.path, d.token, f, { contentType: f.type });
    if (error) throw new Error('Não foi possível enviar o anexo. Tente de novo.');
    return { path: d.path, nome: f.name };
  }

  // textoPronto: mensagem montada pelo botão (ex.: produto indicado); não mexe no que está digitado
  async function enviar(textoPronto?: string) {
    const t = (textoPronto ?? texto).trim();
    const f = textoPronto ? null : anexo;
    if ((!t && !f) || enviando) return;
    setEnviando(true);
    pertoDoFim.current = true;
    const tempId = `tmp-${Date.now()}`;
    setMsgs((m) => [...m, { id: tempId, papel: 'eu', texto: t || `📎 ${f?.name}`, created_at: new Date().toISOString(), mine: true, enviando: true }]);
    if (!textoPronto) { setTexto(''); setAnexo(null); }
    try {
      const anexoEnviado = f ? await subirAnexo(f) : null;
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ orderId, texto: t, anexo: anexoEnviado }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.message) {
        setMsgs((m) => [...m.filter((x) => x.id !== tempId && x.id !== d.message.id), d.message]);
        if (d.aviso) toast(d.aviso, 'error');
      } else throw new Error(d.error || 'Não foi possível enviar.');
    } catch (e: any) {
      setMsgs((m) => m.filter((x) => x.id !== tempId));
      if (!textoPronto) { setTexto(t); if (f) setAnexo(f); }
      toast(e?.message || 'Não foi possível enviar. Tente de novo.', 'error');
    } finally { setEnviando(false); }
  }

  async function abrirProdutos() {
    setAbrirCatalogo(true);
    if (catalogo) return;
    try {
      const r = await fetch(`/api/chat/produtos?orderId=${orderId}`, { credentials: 'include', cache: 'no-store' });
      const d = await r.json(); setCatalogo(r.ok ? d.produtos || [] : []);
    } catch { setCatalogo([]); }
  }
  async function enviarProduto(p: Produto) {
    setAbrirCatalogo(false);
    setProdutos((m) => ({ ...m, [p.id]: { ...p, ativo: true } }));
    await enviar(`Dá uma olhada neste produto: ${linkDoProduto(SITE, p.id)}`);
  }
  async function liberar(m: Msg) {
    if (!confirm('Liberar esta mensagem? A outra parte passa a ver o texto.')) return;
    const r = await fetch('/api/chat/moderar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id: m.id }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || 'Não foi possível liberar.', 'error'); return; }
    toast('Mensagem liberada.', 'success'); carregar();
  }

  const status = (m: Msg) => {
    if (!m.mine || moderator) return null;
    if (m.enviando) return <span>Enviando…</span>;
    return <span title="Mensagem enviada">✓ Enviado</span>;
  };

  return (
    <div className="oc" style={{ border: `1px solid ${C.bd}`, borderRadius: 14, background: C.panel, ['--oc-panel' as any]: C.panel, ['--oc-bd' as any]: C.bd }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .oc{position:relative}
        .oc-topo{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--oc-bd);border-radius:14px 14px 0 0}
        .oc-av{width:36px;height:36px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-family:Outfit;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(135deg,#FF6B00,#FF9A3C)}
        .oc-topo b{display:block;font-family:Outfit;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .oc-topo small{display:block;font-size:11.5px;line-height:1.3}
        .oc-aviso{display:flex;gap:8px;align-items:flex-start;padding:9px 14px;font-size:11.5px;line-height:1.45;border-bottom:1px solid var(--oc-bd)}
        .oc-aviso:first-child{border-radius:14px 14px 0 0}
        .oc-aviso button{background:none;border:0;padding:0;font:inherit;font-weight:800;text-decoration:underline;color:inherit;cursor:pointer}
        .oc-msgs{height:380px;min-height:180px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
        .oc-bolha{max-width:78%}
        .oc-comp{border-top:1px solid var(--oc-bd);padding:10px 12px;background:var(--oc-panel);border-radius:0 0 14px 14px}
        .oc-campo{flex:1;min-width:0;min-height:44px;max-height:112px;resize:none;border-radius:12px;padding:11px 14px;font-size:16px;line-height:1.35;outline:none;font-family:inherit;display:block}
        .oc-env{flex:none;height:44px;padding:0 18px;border-radius:12px;border:none;cursor:pointer;font-weight:800;font-family:Outfit;color:#fff;background:linear-gradient(135deg,#FF6B00,#FF9A3C);display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .oc-env .ic{display:none}
        .oc-clip{flex:none;width:44px;height:44px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
        .oc-curto{display:none}
        .oc-prod{display:flex;gap:10px;align-items:center;background:#fff;color:#1A1A2E;border-radius:12px;padding:8px;text-decoration:none;min-width:220px;max-width:280px;box-shadow:0 2px 8px rgba(22,22,42,.08)}
        .oc-prod-img{width:56px;height:56px;border-radius:10px;flex:none;background:#F1F1F6 center/cover;display:flex;align-items:center;justify-content:center;color:#8A8A9E}
        .oc-prod-tx{display:flex;flex-direction:column;min-width:0;gap:2px}
        .oc-prod-tx b{font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .oc-prod-tx span{font-size:13px;display:flex;gap:6px;align-items:baseline}
        .oc-prod-tx s{color:#8A8A9E;font-size:11.5px}
        .oc-prod-tx strong{font-family:Outfit;font-weight:900;color:#1A1A2E}
        .oc-prod-tx em{font-style:normal;font-size:11.5px;font-weight:800;color:#B84A00}
        .oc-fechado{border-top:1px solid var(--oc-bd);padding:14px;text-align:center;font-size:13px;border-radius:0 0 14px 14px}
        .oc-cat{position:absolute;left:8px;right:8px;bottom:70px;z-index:20;border-radius:14px;max-height:320px;overflow:auto;box-shadow:0 12px 40px rgba(22,22,42,.25);padding:8px}
        .oc-cat button.it{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:8px;border-radius:10px;cursor:pointer;color:inherit;font-family:inherit}
        .oc-cat button.it:hover{background:rgba(255,107,0,.08)}
        @media(max-width:640px){
          .oc-msgs{height:min(56dvh,460px);padding:12px}
          .oc-bolha{max-width:86%}
          .oc-bolha img{max-width:200px!important;max-height:200px!important}
          .oc-comp{position:sticky;bottom:0;z-index:5;padding:8px 10px calc(8px + env(safe-area-inset-bottom));box-shadow:0 -6px 18px rgba(22,22,42,.06)}
          .oc-env{width:44px;padding:0;border-radius:50%}
          .oc-env .tx{display:none}
          .oc-env .ic{display:block}
          .oc-clip{border-radius:50%}
          .oc-longo{display:none}
          .oc-curto{display:inline}
          .oc-aviso.aberto .oc-longo{display:inline}
          .oc-aviso.aberto .oc-curto{display:none}
        }
      ` }} />
      {contraparte && (
        <div className="oc-topo">
          <span className="oc-av" aria-hidden="true">{contraparte.trim().charAt(0).toUpperCase() || '?'}</span>
          <div style={{ minWidth: 0 }}>
            <b>{contraparte}</b>
            <small style={{ color: C.sub }}>{meuPapel === 'vendedor' ? 'Cliente' : meuPapel === 'comprador' ? 'Vendedor' : 'Cliente · loja'}</small>
          </div>
        </div>
      )}
      <div className={`oc-aviso ${regra ? 'aberto' : ''}`} style={{ color: dark ? '#E9C46A' : '#7A5200', background: dark ? '#2A2416' : '#FFF7E6' }}>
        <Icon name="shield" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          <span className="oc-longo">{AVISO_SEGURANCA}</span>
          <span className="oc-curto">Não troque telefone, WhatsApp ou redes aqui: fora da plataforma não há garantia. <button type="button" onClick={() => setRegra(true)}>Ver regra</button></span>
        </span>
      </div>
      <div ref={boxRef} className="oc-msgs" onScroll={aoRolar}>
        {!carregou && <p style={{ color: C.sub, fontSize: 13, textAlign: 'center', margin: 'auto' }}>Carregando conversa…</p>}
        {carregou && msgs.length === 0 && <p style={{ color: C.sub, fontSize: 13, textAlign: 'center', margin: 'auto' }}>Nenhuma mensagem ainda. Diga olá!</p>}
        {msgs.map((m) => {
          if (m.papel === 'sistema') {
            return (
              <div key={m.id} style={{ textAlign: 'center', margin: '4px 0' }}>
                <span style={{ display: 'inline-block', background: dark ? '#1C1C28' : '#F4F4F8', color: C.sub, fontSize: 12, padding: '6px 12px', borderRadius: 10, maxWidth: '85%' }}>{m.texto}</span>
              </div>
            );
          }
          const own = m.mine;
          const bg = own ? 'linear-gradient(135deg,#FF6B00,#FF9A3C)' : C.bubbleOther;
          const col = own ? '#fff' : C.tx;
          const roleTag = m.papel === 'admin' ? 'Administrador' : m.papel === 'vendedor' ? (lojaNome || 'Vendedor') : 'Cliente';
          const label = moderator ? roleTag : (own ? 'Você' : roleTag);
          const img = m.anexo && m.anexo.tipo.startsWith('image/');
          const soNomeDoAnexo = m.anexo && m.texto === `📎 ${m.anexo.nome}`;
          const idsProd = m.papel === 'sistema' ? [] : produtosNaMensagem(m.texto).filter((id) => produtos[id]);
          const textoVisivel = idsProd.length ? textoSemLinksDeProduto(m.texto) : m.texto;
          const soCartao = idsProd.length > 0 && !textoVisivel && !m.anexo;
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', opacity: m.enviando ? 0.7 : 1 }}>
              <div style={{ fontSize: 10, color: C.sub, margin: '0 6px 3px', fontWeight: 700 }}>{label}</div>
              <div className="oc-bolha" style={{ background: soCartao ? 'transparent' : bg, color: col, padding: soCartao ? 0 : m.anexo && img ? 6 : '9px 13px', borderRadius: own ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', outline: m.alerta ? '2px solid #E5484D' : undefined }}>
                {m.anexo && (img ? (
                  <a href={m.anexo.url} target="_blank" rel="noopener noreferrer"><img src={m.anexo.url} alt={m.anexo.nome} loading="lazy" style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 10, objectFit: 'cover' }} /></a>
                ) : (
                  <a href={`${m.anexo.url}&baixar=1`} style={{ display: 'flex', gap: 8, alignItems: 'center', color: col, textDecoration: 'none', fontWeight: 700 }}>
                    <Icon name="file" size={20} /> <span style={{ minWidth: 0 }}><span style={{ display: 'block', textDecoration: 'underline' }}>{m.anexo.nome}</span><small style={{ opacity: 0.8, fontWeight: 500 }}>PDF · {tamanhoLegivel(m.anexo.tamanho)}</small></span>
                  </a>
                ))}
                {!soNomeDoAnexo && textoVisivel && <div style={m.anexo && img ? { padding: '6px 7px 3px' } : undefined}><TextoFormatado texto={textoVisivel} corLink={own ? '#fff' : '#B84A00'} /></div>}
                {idsProd.map((id) => { const p = produtos[id]; return (
                  <a key={id} href={`/produto/${id}`} target="_blank" rel="noopener noreferrer" className="oc-prod" style={{ marginTop: textoVisivel ? 8 : 0 }}>
                    <span className="oc-prod-img" style={p.capa_url ? { backgroundImage: `url(${p.capa_url})` } : undefined}>{!p.capa_url && <Icon name="package" size={22} />}</span>
                    <span className="oc-prod-tx">
                      <b>{p.titulo}</b>
                      <span>{p.precoDe ? <s>{brl(p.precoDe)}</s> : null}<strong>{brl(p.preco)}</strong></span>
                      <em>{p.ativo === false ? 'Indisponível no momento' : 'Ver produto e comprar →'}</em>
                    </span>
                  </a>
                ); })}
              </div>
              {m.retida && (own || moderator) && (
                <div style={{ fontSize: 11, fontWeight: 800, color: '#E5484D', margin: '4px 6px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  🔒 Retida: {moderator ? 'a outra parte não vê este texto.' : 'o suporte vai analisar. A outra parte não vê o texto.'}
                  {moderator && <button type="button" onClick={() => liberar(m)} style={{ background: '#3DDC97', color: '#0B3D1E', border: 0, borderRadius: 8, padding: '3px 10px', fontWeight: 900, cursor: 'pointer', fontSize: 11 }}>Liberar</button>}
                </div>
              )}
              <div style={{ fontSize: 10, color: C.sub, margin: '3px 6px 0', display: 'flex', gap: 8 }}>
                <span>{hora(m.created_at)}</span>{status(m)}
                {moderator && m.alerta === 'contato_externo' && <span style={{ color: '#E5484D', fontWeight: 800 }}>⚠ possível contato externo</span>}
                {moderator && m.alerta === 'atencao' && <span style={{ color: '#B45309', fontWeight: 800 }}>👁 e-mail/rede: conferir</span>}
              </div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>

      {!readOnly && chat.fechado && (
        <div className="oc-fechado" style={{ color: C.sub, background: dark ? '#1C1C28' : '#F7F7FA' }}>
          🔒 Conversa encerrada{chat.fechaEm ? ` em ${new Date(chat.fechaEm).toLocaleDateString('pt-BR')}` : ''}. O histórico fica salvo aqui. Precisa de algo? Fale com o <a href="/suporte" style={{ color: '#B84A00', fontWeight: 800 }}>suporte</a>.
        </div>
      )}
      {!readOnly && !chat.fechado && abrirCatalogo && (
        <div className="oc-cat" role="dialog" aria-label="Escolher produto" style={{ background: C.panel, color: C.tx, border: `1px solid ${C.bd}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px' }}>
            <b style={{ fontFamily: 'Outfit' }}>Indicar um produto da loja</b>
            <button type="button" onClick={() => setAbrirCatalogo(false)} aria-label="Fechar" style={{ background: 'none', border: 0, color: C.sub, cursor: 'pointer', display: 'inline-flex' }}><Icon name="x" size={18} /></button>
          </div>
          {!catalogo ? <p style={{ color: C.sub, fontSize: 13, padding: 8 }}>Carregando…</p> : !catalogo.length ? <p style={{ color: C.sub, fontSize: 13, padding: 8 }}>Nenhum produto ativo na loja.</p> : catalogo.map((p) => (
            <button key={p.id} type="button" className="it" onClick={() => enviarProduto(p)}>
              <span className="oc-prod-img" style={{ width: 44, height: 44, ...(p.capa_url ? { backgroundImage: `url(${p.capa_url})` } : {}) }}>{!p.capa_url && <Icon name="package" size={18} />}</span>
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</b><small style={{ color: C.sub }}>{brl(p.preco)}</small></span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#FF6B00' }}>Enviar</span>
            </button>
          ))}
        </div>
      )}
      {!readOnly && !chat.fechado && (
        <div className="oc-comp">
          {chat.fechaEm && !moderator && <div style={{ fontSize: 11, color: C.sub, margin: '0 0 6px', textAlign: 'center' }}>Conversa aberta até {new Date(chat.fechaEm).toLocaleDateString('pt-BR')} (fim da garantia).</div>}
          {anexo && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.tx, background: dark ? '#1C1C28' : '#F4F4F8', borderRadius: 10, padding: '7px 10px', marginBottom: 8 }}>
              <Icon name={anexo.type.startsWith('image/') ? 'image' : 'file'} size={16} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anexo.name} · {tamanhoLegivel(anexo.size)}</span>
              <button type="button" onClick={() => setAnexo(null)} aria-label="Remover anexo" style={{ background: 'none', border: 0, cursor: 'pointer', color: C.sub, display: 'inline-flex' }}><Icon name="x" size={16} /></button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {recursos.produtos && (
              <button type="button" className="oc-clip" onClick={abrirProdutos} disabled={enviando} aria-label="Indicar um produto da loja" title="Indicar um produto da loja"
                style={{ border: `1px solid ${C.bd}`, background: C.inputBg, color: C.sub }}>
                <Icon name="bag" size={19} />
              </button>
            )}
            {recursos.anexos && (
              <>
                <input ref={arqRef} type="file" accept={ANEXO_CHAT_TIPOS.join(',')} style={{ display: 'none' }} onChange={(e) => { escolher(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                <button type="button" className="oc-clip" onClick={() => arqRef.current?.click()} disabled={enviando} aria-label="Anexar imagem ou PDF" title="Anexar imagem ou PDF (até 10 MB)"
                  style={{ border: `1px solid ${C.bd}`, background: C.inputBg, color: C.sub }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                </button>
              </>
            )}
            <textarea
              ref={campoRef}
              rows={1}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onFocus={aoFocar}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); enviar(); } }}
              placeholder={anexo ? 'Algo sobre o anexo (opcional)…' : recursos.produtos ? 'Mensagem…' : 'Escreva uma mensagem…'}
              aria-label="Mensagem"
              className="oc-campo"
              style={{ border: `1px solid ${C.bd}`, background: C.inputBg, color: C.tx }}
            />
            <button type="button" className="oc-env" onClick={() => enviar()} disabled={enviando || (!texto.trim() && !anexo)} aria-label="Enviar"
              style={{ opacity: enviando || (!texto.trim() && !anexo) ? 0.6 : 1 }}>
              <span className="tx">{enviando ? '…' : 'Enviar'}</span>
              <svg className="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9z" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
