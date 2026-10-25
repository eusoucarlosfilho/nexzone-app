'use client';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

// Envio do arquivo entregável. O <input type="file"> nativo fica escondido
// (o visual do navegador destoa do site) e é aberto pelo botão abaixo.
export default function FileUpload({ userId, onUploaded, current }: { userId: string; onUploaded: (path: string, nome: string) => void; current?: string }) {
  const [nome, setNome] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const temArquivo = !!(nome || current);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setBusy(true); setOk(false); setErr('');
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from('entregaveis').upload(path, file, { upsert: false });
    setBusy(false);
    if (error) { setErr('Erro ao enviar: ' + error.message); return; }
    setNome(file.name); setOk(true);
    onUploaded(path, file.name);
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Icon name="upload" size={16} />
          {busy ? 'Enviando…' : temArquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
        </button>
        {(nome || current) && (
          <span className="muted" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, overflowWrap: 'anywhere' }}>
            {ok && <Icon name="check" size={14} color="var(--green)" style={{ flexShrink: 0 }} />}
            {nome ? nome : `Arquivo atual: ${current}`}
          </span>
        )}
        {!temArquivo && !busy && <span className="muted" style={{ fontSize: 13 }}>Nenhum arquivo escolhido</span>}
      </div>
      <input ref={inputRef} type="file" onChange={handle} disabled={busy} style={{ display: 'none' }} />
      {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
