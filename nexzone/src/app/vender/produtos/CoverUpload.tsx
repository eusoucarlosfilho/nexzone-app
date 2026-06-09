'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CoverUpload({ userId, value, onUploaded, hint }: { userId: string; value?: string; onUploaded: (url: string) => void; hint?: string }) {
  const [url, setUrl] = useState(value || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Selecione um arquivo de imagem.'); return; }
    setBusy(true); setErr('');
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('capas').upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setBusy(false); setErr('Erro ao enviar: ' + error.message); return; }
    const { data } = supabase.storage.from('capas').getPublicUrl(path);
    setUrl(data.publicUrl); setBusy(false); onUploaded(data.publicUrl);
  }

  return (
    <div>
      {url && <img src={url} alt="capa" style={{ width: '100%', maxWidth: 280, borderRadius: 12, marginBottom: 8, display: 'block', border: '1px solid var(--border)' }} />}
      <input type="file" accept="image/*" onChange={handle} disabled={busy} style={{ fontSize: 13 }} />
      {hint && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>📐 {hint}</div>}
      {busy && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Enviando imagem…</div>}
      {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
