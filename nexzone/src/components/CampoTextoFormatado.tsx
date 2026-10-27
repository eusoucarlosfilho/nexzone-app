'use client';
import { useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import TextoFormatado from '@/components/TextoFormatado';

// Caixa de texto com barra de formatação (negrito, itálico, listas, link) e prévia.
// Guarda as marcações leves do TextoFormatado — nunca HTML.
export default function CampoTextoFormatado({ valor, onValor, max = 2000, linhas = 6, placeholder, id }: {
  valor: string; onValor: (v: string) => void; max?: number; linhas?: number; placeholder?: string; id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [previa, setPrevia] = useState(false);

  function envolver(antes: string, depois = antes, exemplo = 'texto') {
    const el = ref.current; if (!el) return;
    const ini = el.selectionStart, fim = el.selectionEnd;
    const sel = valor.slice(ini, fim) || exemplo;
    const novo = valor.slice(0, ini) + antes + sel + depois + valor.slice(fim);
    if (novo.length > max) { toast(`Limite de ${max} caracteres.`, 'error'); return; }
    onValor(novo);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + antes.length, ini + antes.length + sel.length); });
  }
  function lista(tipo: 'ul' | 'ol') {
    const el = ref.current; if (!el) return;
    const ini = valor.lastIndexOf('\n', el.selectionStart - 1) + 1;
    let fim = valor.indexOf('\n', el.selectionEnd); if (fim < 0) fim = valor.length;
    const ls = valor.slice(ini, fim).split('\n').map((l, i) => `${tipo === 'ul' ? '-' : `${i + 1}.`} ${l.replace(/^\s*([-•]|\d+[.)])\s+/, '')}`);
    onValor(valor.slice(0, ini) + ls.join('\n') + valor.slice(fim));
    requestAnimationFrame(() => el.focus());
  }
  function link() {
    const url = window.prompt('Cole o link (começando com https://):', 'https://');
    if (!url || !/^https?:\/\/\S+$/.test(url.trim())) { if (url) toast('Link inválido. Use https://…', 'error'); return; }
    const el = ref.current; const sel = el ? valor.slice(el.selectionStart, el.selectionEnd) : '';
    envolver('[', `](${url.trim()})`, sel || 'clique aqui');
  }
  const b = (rot: React.ReactNode, titulo: string, acao: () => void) => (
    <button type="button" className="ctf-b" title={titulo} aria-label={titulo} disabled={previa} onMouseDown={(e) => e.preventDefault()} onClick={acao}>{rot}</button>
  );

  return (
    <div className="ctf">
      <style dangerouslySetInnerHTML={{ __html: `
        .ctf{border:1.5px solid var(--border2,#E8E1D9);border-radius:14px;overflow:hidden;background:#fff}
        .ctf:focus-within{border-color:var(--orange);box-shadow:0 0 0 3px rgba(255,107,0,.12)}
        .ctf-bar{display:flex;gap:2px;flex-wrap:wrap;align-items:center;padding:6px;border-bottom:1px solid var(--border);background:var(--surface)}
        .ctf-b{min-width:34px;height:32px;border:none;background:none;border-radius:8px;font-size:14px;cursor:pointer;color:var(--text);padding:0 8px}
        .ctf-b:hover:not(:disabled){background:#fff;box-shadow:0 0 0 1px var(--border2,#E8E1D9)}
        .ctf-b:disabled{opacity:.4}
        .ctf-sp{flex:1}
        .ctf textarea{width:100%;border:none;outline:none;resize:vertical;padding:12px 14px;font-size:14.5px;line-height:1.5;font-family:inherit;background:transparent;display:block}
        .ctf-prev{padding:12px 14px;font-size:14.5px;min-height:120px}
        .ctf-rod{display:flex;justify-content:flex-end;padding:4px 10px;border-top:1px solid var(--border);font-size:12px;color:var(--sub)}
      ` }} />
      <div className="ctf-bar">
        {b(<b>N</b>, 'Negrito', () => envolver('**'))}
        {b(<i>I</i>, 'Itálico', () => envolver('_'))}
        {b(<s>R</s>, 'Riscado', () => envolver('~~'))}
        {b('• Lista', 'Lista', () => lista('ul'))}
        {b('1. Lista', 'Lista numerada', () => lista('ol'))}
        {b('🔗 Link', 'Inserir link', link)}
        <span className="ctf-sp" />
        <button type="button" className="ctf-b" onClick={() => setPrevia((v) => !v)} style={{ fontWeight: 800 }}>{previa ? 'Editar' : 'Prévia'}</button>
      </div>
      {previa
        ? <div className="ctf-prev">{valor.trim() ? <TextoFormatado texto={valor} corLink="#B84A00" /> : <span className="muted">Nada escrito ainda.</span>}</div>
        : <textarea ref={ref} id={id} rows={linhas} value={valor} maxLength={max} placeholder={placeholder} onChange={(e) => onValor(e.target.value)} />}
      <div className="ctf-rod">{valor.length}/{max}</div>
    </div>
  );
}
