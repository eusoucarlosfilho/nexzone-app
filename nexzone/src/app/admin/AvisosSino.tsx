'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';
import { PUBLICOS } from '@/lib/notificacoesCentral';

// Admin → Avisos no sino: notificação para muita gente de uma vez (aparece no sino e em /notificacoes).
// Para um usuário só, use "Enviar aviso" na ficha do usuário (também cai no sino).
export default function AvisosSino() {
  const [publico, setPublico] = useState<string>('todos');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [envios, setEnvios] = useState<any[]>([]);
  const [sql17, setSql17] = useState(true);

  async function carregar() {
    try {
      const r = await fetch('/api/admin/notificacoes', { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      setSql17(d.sql17 !== false); setEnvios(d.envios ?? []);
    } catch {}
  }
  useEffect(() => { carregar(); }, []);

  async function enviar() {
    const quem = PUBLICOS.find((p) => p.id === publico)?.rotulo.toLowerCase();
    if (!confirm(`Enviar "${titulo}" para ${quem}? Não dá para desfazer.`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/notificacoes', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publico, titulo, texto, link }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível enviar.', 'error'); return; }
      toast(`Aviso enviado para ${d.total} pessoa${d.total === 1 ? '' : 's'}.`, 'success');
      setTitulo(''); setTexto(''); setLink('');
      carregar();
    } finally { setBusy(false); }
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 };
  const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid var(--bd2)', background: 'var(--panel2)', color: 'var(--tx)', fontSize: 14 };

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', alignItems: 'start' }}>
      <div className="adm-card" style={{ marginBottom: 0 }}>
        <h3 className="adm-ct">Novo aviso</h3>
        {!sql17 && <p style={{ color: '#E23B3B', fontSize: 13, fontWeight: 700 }}>Rode o SQL 17 no Supabase para ativar as notificações.</p>}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Quem recebe</label>
          <select value={publico} onChange={(e) => setPublico(e.target.value)} style={inp}>
            {PUBLICOS.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Título <span style={{ color: 'var(--sub)', fontWeight: 600 }}>({titulo.length}/140)</span></label>
          <input value={titulo} maxLength={140} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Novidade: agora dá para parcelar no cartão" style={inp} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Texto (opcional) <span style={{ color: 'var(--sub)', fontWeight: 600 }}>({texto.length}/600)</span></label>
          <textarea value={texto} maxLength={600} rows={4} onChange={(e) => setTexto(e.target.value)} placeholder="Explique em 1 ou 2 frases." style={{ ...inp, resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Link ao tocar (opcional)</label>
          <input value={link} maxLength={300} onChange={(e) => setLink(e.target.value.trim())} placeholder="/produtos ou /vender" style={inp} />
          <small style={{ color: 'var(--sub)', fontSize: 12 }}>Só páginas do próprio site, começando com /.</small>
        </div>
        <button className="adm-btn ap" disabled={busy || titulo.trim().length < 3 || !sql17} onClick={enviar}>
          <Icon name="send" size={15} /> {busy ? 'Enviando…' : 'Enviar aviso'}
        </button>
      </div>

      <div className="adm-card" style={{ marginBottom: 0 }}>
        <h3 className="adm-ct">Como aparece</h3>
        <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 14, background: 'var(--panel2)', border: '1px solid var(--bd2)' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: '#EAF2FF', color: '#1F4E8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="sparkles" size={16} /></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{titulo || 'Título do aviso'}</b>
            {(texto || !titulo) && <span style={{ color: 'var(--sub)', fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{texto || 'O texto aparece aqui.'}</span>}
            <small style={{ color: 'var(--sub)', fontWeight: 700 }}>agora</small>
          </span>
        </div>
        <h3 className="adm-ct" style={{ marginTop: 22 }}>Últimos envios</h3>
        {envios.length ? envios.map((e) => (
          <div key={e.id} className="adm-row">
            <div className="info">
              <b>{e.titulo}</b>
              <span>{PUBLICOS.find((p) => p.id === e.publico)?.rotulo ?? e.publico} · {e.total} pessoa{e.total === 1 ? '' : 's'} · {new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          </div>
        )) : <div className="adm-empty" style={{ padding: 20 }}>Nenhum aviso enviado ainda.</div>}
      </div>
    </div>
  );
}
