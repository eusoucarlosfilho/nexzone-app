'use client';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

// Envio de imagem (logo, banner da loja, banner do checkout). O <input type="file">
// nativo fica escondido (o visual do navegador destoa do site) e é aberto pelo botão.
export default function CoverUpload({ userId, value, onUploaded, hint }: { userId: string; value?: string; onUploaded: (url: string) => void; hint?: string }) {
  const [url, setUrl] = useState(value || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nome, setNome] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher a mesma imagem de novo
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Selecione um arquivo de imagem.'); return; }
    setBusy(true); setErr(''); setNome('');
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('capas').upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setBusy(false); setErr('Erro ao enviar: ' + error.message); return; }
    const { data } = supabase.storage.from('capas').getPublicUrl(path);
    setUrl(data.publicUrl); setBusy(false); setNome(file.name); onUploaded(data.publicUrl);
  }

  return (
    <div>
      {url && <img src={url} alt="Imagem atual" style={{ width: '100%', maxWidth: 280, borderRadius: 12, marginBottom: 8, display: 'block', border: '1px solid var(--border)' }} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Icon name="upload" size={16} />
          {busy ? 'Enviando…' : url ? 'Trocar imagem' : 'Escolher imagem'}
        </button>
        {nome && (
          <span className="muted" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, overflowWrap: 'anywhere' }}>
            <Icon name="check" size={14} color="var(--green)" style={{ flexShrink: 0 }} />{nome}
          </span>
        )}
        {!url && !busy && !nome && <span className="muted" style={{ fontSize: 13 }}>Nenhuma imagem escolhida</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handle} disabled={busy} style={{ display: 'none' }} />
      {hint && <div className="muted" style={{ fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="ruler" size={13} /> {hint}</div>}
      {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
