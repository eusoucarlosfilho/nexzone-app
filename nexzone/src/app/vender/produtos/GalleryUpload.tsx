'use client';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import { MAX_FOTOS, MAX_MB_FOTO } from '@/lib/galeria';

// Fotos do produto (galeria). A 1ª é a capa.
// Upload no bucket 'capas', na pasta do vendedor (mesmo caminho do antigo CoverUpload).
export default function GalleryUpload({ userId, value, onChange }: {
  userId: string; value: string[]; onChange: (imagens: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [err, setErr] = useState('');
  const [arrastando, setArrastando] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restante = MAX_FOTOS - value.length;

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!arquivos.length) return;
    setErr('');

    const avisos: string[] = [];
    let validos = arquivos.filter((f) => {
      if (!f.type.startsWith('image/')) { avisos.push(`"${f.name}" não é imagem`); return false; }
      if (f.size > MAX_MB_FOTO * 1024 * 1024) { avisos.push(`"${f.name}" passa de ${MAX_MB_FOTO} MB`); return false; }
      return true;
    });
    if (validos.length > restante) {
      avisos.push(restante > 0 ? `só cabem mais ${restante} foto(s) (máximo ${MAX_FOTOS})` : `limite de ${MAX_FOTOS} fotos atingido`);
      validos = validos.slice(0, Math.max(0, restante));
    }
    if (!validos.length) { setErr(avisos.join(' · ')); return; }

    setBusy(true);
    const supabase = createClient();
    const novas: string[] = [];
    for (let i = 0; i < validos.length; i++) {
      const f = validos[i];
      setProgresso(`Enviando ${i + 1} de ${validos.length}…`);
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('capas').upload(path, f, { upsert: false, contentType: f.type });
      if (error) { avisos.push(`"${f.name}": ${error.message}`); continue; }
      novas.push(supabase.storage.from('capas').getPublicUrl(path).data.publicUrl);
    }
    setBusy(false); setProgresso('');
    if (novas.length) onChange([...value, ...novas].slice(0, MAX_FOTOS));
    if (avisos.length) setErr('Algumas fotos não entraram: ' + avisos.join(' · '));
  }

  function mover(de: number, para: number) {
    if (para < 0 || para >= value.length || de === para) return;
    const lista = value.slice();
    const [item] = lista.splice(de, 1);
    lista.splice(para, 0, item);
    onChange(lista);
  }
  const remover = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="gal-up">
      <style dangerouslySetInnerHTML={{ __html: `
        .gal-up .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;margin-bottom:10px}
        .gal-up .it{position:relative;border:1.5px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;cursor:grab}
        .gal-up .it.capa{border-color:var(--orange)}
        .gal-up .it.drag{opacity:.4}
        .gal-up .it img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;pointer-events:none}
        .gal-up .x{position:absolute;top:5px;right:5px;width:26px;height:26px;border-radius:50%;border:none;background:rgba(22,22,42,.75);color:#fff;font-size:16px;line-height:1;cursor:pointer}
        .gal-up .tag{position:absolute;top:5px;left:5px;background:var(--orange);color:#fff;font-family:'Outfit';font-weight:800;font-size:10.5px;border-radius:50px;padding:2px 8px}
        .gal-up .bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px;padding:5px}
        .gal-up .bar button{border:1px solid var(--border);background:#fff;border-radius:8px;height:28px;min-width:28px;font-size:12px;cursor:pointer;padding:0 6px;color:var(--text)}
        .gal-up .bar button:disabled{opacity:.35;cursor:default}
        .gal-up .bar .cp{order:3;flex:1 1 100%;font-weight:700;font-size:11px;line-height:1.2;height:auto;min-height:28px;padding:4px 6px}
        .gal-up .add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;aspect-ratio:4/3;border:1.5px dashed #FFCBA1;border-radius:12px;background:var(--soft);color:var(--orange-ink);font-weight:800;font-size:12.5px;cursor:pointer}
        .gal-up .add:disabled{opacity:.5;cursor:default}
      ` }} />

      <div className="grid">
        {value.map((url, i) => (
          <div key={url} className={`it ${i === 0 ? 'capa' : ''} ${arrastando === i ? 'drag' : ''}`}
            draggable
            onDragStart={(e) => { setArrastando(i); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (arrastando !== null) mover(arrastando, i); setArrastando(null); }}
            onDragEnd={() => setArrastando(null)}
            title="Arraste para reordenar">
            <img src={url} alt={`Foto ${i + 1}`} loading="lazy" />
            {i === 0 && <span className="tag">Capa</span>}
            <button type="button" className="x" aria-label={`Remover foto ${i + 1}`} onClick={() => remover(i)}>×</button>
            <div className="bar">
              <button type="button" aria-label="Mover para a esquerda" disabled={i === 0} onClick={() => mover(i, i - 1)}>←</button>
              {i === 0
                ? <span className="cp" style={{ textAlign: 'center', color: 'var(--orange-ink)' }}>Capa</span>
                : <button type="button" className="cp" onClick={() => mover(i, 0)}>Definir como capa</button>}
              <button type="button" aria-label="Mover para a direita" disabled={i === value.length - 1} onClick={() => mover(i, i + 1)}>→</button>
            </div>
          </div>
        ))}
        {restante > 0 && (
          <button type="button" className="add" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Icon name="plus" size={20} />
            {busy ? progresso || 'Enviando…' : value.length ? 'Adicionar fotos' : 'Enviar fotos'}
            <small style={{ fontWeight: 600, color: 'var(--sub)' }}>{value.length}/{MAX_FOTOS}</small>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={enviar} disabled={busy} style={{ display: 'none' }} />

      <div className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Icon name="info" size={13} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>A 1ª foto é a capa. Use prints reais do produto: páginas do e-book, telas da planilha, exemplos do template. Até {MAX_FOTOS} fotos, {MAX_MB_FOTO} MB cada. No computador, arraste para reordenar; no celular, use as setas ← →.</span>
      </div>
      {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
