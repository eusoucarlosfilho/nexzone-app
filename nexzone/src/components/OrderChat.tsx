'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import TextoFormatado from '@/components/TextoFormatado';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { createClient } from '@/lib/supabase/client';
import { AVISO_SEGURANCA, BUCKET_CHAT, ANEXO_CHAT_TIPOS, validarAnexoChat, tamanhoLegivel } from '@/lib/conversas';

type Anexo = { url: string; nome: string; tipo: string; tamanho: number };
type Msg = { id: string; papel: string; texto: string; created_at: string; mine: boolean; lido?: boolean; anexo?: Anexo; alerta?: string; enviando?: boolean };

const hora = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function OrderChat({ orderId, theme = 'light', readOnly = false, moderator = false }: { orderId: string; theme?: 'light' | 'dark'; readOnly?: boolean; moderator?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [lojaNome, setLojaNome] = useState<string | null>(null); // só vem preenchido quando a loja vende como Comprei Barato
  const [recursos, setRecursos] = useState<{ lido: boolean; anexos: boolean }>({ lido: false, anexos: false });
  const [anexo, setAnexo] = useState<File | null>(null);
  const fimRef = useRef<HTMLDivElement | null>(null);
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
      if (d.recursos) setRecursos(d.recursos);
      setCarregou(true);
    } catch {}
  }, [orderId]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs.length]);

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

  async function enviar() {
    const t = texto.trim();
    const f = anexo;
    if ((!t && !f) || enviando) return;
    setEnviando(true);
    const tempId = `tmp-${Date.now()}`;
    setMsgs((m) => [...m, { id: tempId, papel: 'eu', texto: t || `📎 ${f?.name}`, created_at: new Date().toISOString(), mine: true, enviando: true }]);
    setTexto(''); setAnexo(null);
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
      setTexto(t); if (f) setAnexo(f);
      toast(e?.message || 'Não foi possível enviar. Tente de novo.', 'error');
    } finally { setEnviando(false); }
  }

  const status = (m: Msg) => {
    if (!m.mine || moderator) return null;
    if (m.enviando) return <span>Enviando…</span>;
    if (!recursos.lido || m.lido === undefined) return null;
    return m.lido
      ? <span style={{ color: '#1F8FFF', fontWeight: 800 }} title="A outra pessoa já viu">✓✓ Lido</span>
      : <span title="Entregue na conversa">✓ Enviado</span>;
  };

  return (
    <div style={{ border: `1px solid ${C.bd}`, borderRadius: 14, overflow: 'hidden', background: C.panel }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 14px', fontSize: 11.5, lineHeight: 1.45, color: dark ? '#E9C46A' : '#7A5200', background: dark ? '#2A2416' : '#FFF7E6', borderBottom: `1px solid ${C.bd}` }}>
        <Icon name="shield" size={14} style={{ marginTop: 1, flexShrink: 0 }} /><span>{AVISO_SEGURANCA}</span>
      </div>
      <div style={{ maxHeight: 380, minHeight: 180, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', opacity: m.enviando ? 0.7 : 1 }}>
              <div style={{ fontSize: 10, color: C.sub, margin: '0 6px 3px', fontWeight: 700 }}>{label}</div>
              <div style={{ background: bg, color: col, padding: m.anexo && img ? 6 : '9px 13px', borderRadius: own ? '14px 14px 4px 14px' : '14px 14px 14px 4px', maxWidth: '78%', fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', outline: m.alerta ? '2px solid #E5484D' : undefined }}>
                {m.anexo && (img ? (
                  <a href={m.anexo.url} target="_blank" rel="noopener noreferrer"><img src={m.anexo.url} alt={m.anexo.nome} loading="lazy" style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 10, objectFit: 'cover' }} /></a>
                ) : (
                  <a href={`${m.anexo.url}&baixar=1`} style={{ display: 'flex', gap: 8, alignItems: 'center', color: col, textDecoration: 'none', fontWeight: 700 }}>
                    <Icon name="file" size={20} /> <span style={{ minWidth: 0 }}><span style={{ display: 'block', textDecoration: 'underline' }}>{m.anexo.nome}</span><small style={{ opacity: 0.8, fontWeight: 500 }}>PDF · {tamanhoLegivel(m.anexo.tamanho)}</small></span>
                  </a>
                ))}
                {!soNomeDoAnexo && <div style={m.anexo && img ? { padding: '6px 7px 3px' } : undefined}><TextoFormatado texto={m.texto} corLink={own ? '#fff' : '#B84A00'} /></div>}
              </div>
              <div style={{ fontSize: 10, color: C.sub, margin: '3px 6px 0', display: 'flex', gap: 8 }}>
                <span>{hora(m.created_at)}</span>{status(m)}
                {moderator && m.alerta && <span style={{ color: '#E5484D', fontWeight: 800 }}>⚠ possível contato externo</span>}
              </div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>

      {!readOnly && (
        <div style={{ borderTop: `1px solid ${C.bd}`, padding: 12 }}>
          {anexo && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.tx, background: dark ? '#1C1C28' : '#F4F4F8', borderRadius: 10, padding: '7px 10px', marginBottom: 8 }}>
              <Icon name={anexo.type.startsWith('image/') ? 'image' : 'file'} size={16} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anexo.name} · {tamanhoLegivel(anexo.size)}</span>
              <button type="button" onClick={() => setAnexo(null)} aria-label="Remover anexo" style={{ background: 'none', border: 0, cursor: 'pointer', color: C.sub, display: 'inline-flex' }}><Icon name="x" size={16} /></button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {recursos.anexos && (
              <>
                <input ref={arqRef} type="file" accept={ANEXO_CHAT_TIPOS.join(',')} style={{ display: 'none' }} onChange={(e) => { escolher(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                <button type="button" onClick={() => arqRef.current?.click()} disabled={enviando} aria-label="Anexar imagem ou PDF" title="Anexar imagem ou PDF (até 10 MB)"
                  style={{ flex: 'none', width: 42, height: 42, borderRadius: 10, border: `1px solid ${C.bd}`, background: C.inputBg, color: C.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                </button>
              </>
            )}
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={anexo ? 'Escreva algo sobre o anexo (opcional)…' : 'Escreva uma mensagem…'}
              style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 10, border: `1px solid ${C.bd}`, background: C.inputBg, color: C.tx, padding: '0 14px', fontSize: 16, outline: 'none' }}
            />
            <button onClick={enviar} disabled={enviando || (!texto.trim() && !anexo)}
              style={{ flex: 'none', height: 42, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontFamily: 'Outfit', color: '#fff', background: 'linear-gradient(135deg,#FF6B00,#FF9A3C)', opacity: enviando || (!texto.trim() && !anexo) ? 0.6 : 1 }}>
              {enviando ? '…' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
