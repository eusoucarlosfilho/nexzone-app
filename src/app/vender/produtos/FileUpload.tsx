'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function FileUpload({ userId, onUploaded, current }: { userId: string; onUploaded: (path: string, nome: string) => void; current?: string }) {
  const [status, setStatus] = useState(current ? `Arquivo atual: ${current}` : '');
  const [busy, setBusy] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setStatus('Enviando…');
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from('entregaveis').upload(path, file, { upsert: false });
    setBusy(false);
    if (error) { setStatus('Erro ao enviar: ' + error.message); return; }
    setStatus(`✓ ${file.name}`);
    onUploaded(path, file.name);
  }

  return (
    <div>
      <input type="file" onChange={handle} disabled={busy} style={{ fontSize: 13 }} />
      {status && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{status}</div>}
    </div>
  );
}
