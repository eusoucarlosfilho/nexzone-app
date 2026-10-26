'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { MENSAGEM_MAX } from '@/lib/suporte/constantes';
import { enviarAnexo, validarAnexo } from '@/lib/suporte/anexoCliente';

type Msg = { id: string; sender_type: 'cliente' | 'admin' | 'sistema'; body: string; created_at: string; anexo: string | null };

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ConversaCliente({ protocolo, token, mensagens, nomeCliente, podeResponder, podeReabrir, status, reabrirDias }: {
  protocolo: string; token: string | null; mensagens: Msg[]; nomeCliente: string;
  podeResponder: boolean; podeReabrir: boolean; status: string; reabrirDias: number;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const qsToken = token ? `&t=${encodeURIComponent(token)}` : '';

  async function enviar(acao?: 'reabrir') {
    setErr(''); setOk('');
    if (!acao && texto.trim().length < 2) { setErr('Escreva sua mensagem.'); return; }
    setBusy(true);
    try {
      let anexo: { path: string; nome: string } | null = null;
      if (arquivo) anexo = await enviarAnexo(arquivo);
      const r = await fetch('/api/suporte/responder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ protocolo, t: token, mensagem: texto, anexoPath: anexo?.path, anexoNome: anexo?.nome, acao }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível enviar.');
      setTexto(''); setArquivo(null);
      setOk(acao === 'reabrir' ? 'Chamado reaberto. Vamos responder em breve.' : 'Mensagem enviada.');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível enviar.');
    } finally { setBusy(false); }
  }

  return (
    <div className="sp-conv">
      <style dangerouslySetInnerHTML={{ __html: `
        .sp-conv .lista{display:flex;flex-direction:column;gap:12px;margin:18px 0}
        .sp-conv .bal{max-width:85%;border-radius:16px;padding:12px 14px;border:1px solid var(--border);background:#fff}
        .sp-conv .bal.cliente{align-self:flex-end;background:#FFF1E6;border-color:#FFD9BD}
        .sp-conv .bal.admin{align-self:flex-start}
        .sp-conv .bal.sistema{align-self:center;max-width:100%;background:var(--soft);font-size:13px;text-align:center}
        .sp-conv .quem{font-size:12px;color:var(--sub);margin-bottom:6px}
        .sp-conv .quem b{color:var(--text)}
        .sp-conv .txt{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.5}
        .sp-conv .anx{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;font-weight:800;color:var(--orange-ink)}
        @media(max-width:600px){.sp-conv .bal{max-width:100%}}
      ` }} />

      <div className="lista">
        {mensagens.map((m) => (
          <div key={m.id} className={`bal ${m.sender_type}`}>
            <div className="quem"><b>{m.sender_type === 'admin' ? 'Comprei Barato' : m.sender_type === 'sistema' ? 'Aviso' : nomeCliente}</b> · {quando(m.created_at)}</div>
            <div className="txt">{m.body}</div>
            {m.anexo && (
              <a className="anx" href={`/api/suporte/anexo?m=${m.id}${qsToken}`} target="_blank" rel="noopener noreferrer">
                <Icon name="file" size={14} /> {m.anexo}
              </a>
            )}
          </div>
        ))}
      </div>

      {podeReabrir && (
        <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14 }}>O problema continua? Você pode reabrir este chamado em até {reabrirDias} dias após a resolução.</span>
          <button className="btn btn-ghost" disabled={busy} onClick={() => enviar('reabrir')}>Reabrir chamado</button>
        </div>
      )}

      {podeResponder ? (
        <div className="card">
          <div className="fg" style={{ marginBottom: 10 }}>
            <label htmlFor="sp-resp">{status === 'resolvido' ? 'Responder (reabre o chamado)' : 'Sua resposta'}</label>
            <textarea id="sp-resp" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={MENSAGEM_MAX} placeholder="Escreva aqui…" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Icon name="upload" size={16} /> {arquivo ? 'Trocar arquivo' : 'Anexar arquivo'}
            </button>
            {arquivo
              ? <span className="muted" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{arquivo.name} <button type="button" onClick={() => setArquivo(null)} style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 800 }}>remover</button></span>
              : <span className="muted" style={{ fontSize: 13 }}>Imagem ou PDF, até 5 MB</span>}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; if (!f) return; const m = validarAnexo(f); if (m) { setErr(m); return; } setErr(''); setArquivo(f); }} />
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{err}</div>}
          {ok && <div style={{ color: 'var(--green)', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{ok}</div>}
          <button className="btn btn-pri" disabled={busy} onClick={() => enviar()}>{busy ? 'Enviando…' : 'Enviar resposta'}</button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          {err && <div style={{ color: 'var(--red)', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{err}</div>}
          {ok && <div style={{ color: 'var(--green)', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{ok}</div>}
          <p className="muted">{status === 'fechado' || status === 'resolvido' ? 'Este chamado foi encerrado. Se precisar, abra um novo chamado.' : 'Este chamado não aceita novas mensagens.'}</p>
          <a className="btn btn-ghost" href="/suporte" style={{ marginTop: 10 }}>Abrir novo chamado</a>
        </div>
      )}
    </div>
  );
}
