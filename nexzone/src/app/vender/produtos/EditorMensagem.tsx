'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import TextoFormatado from '@/components/TextoFormatado';
import { MSG_MAX } from '@/lib/textoFormatado';

// Mensagem enviada ao comprador logo após o pagamento (aparece no pedido e no chat).
// Duas opções: usar a MENSAGEM PADRÃO da loja (vale para todos os anúncios marcados) ou
// escrever uma PERSONALIZADA só para este anúncio. Barra de formatação como num e-mail.
//
// `name` cria campos ocultos para formulários com FormData (cadastro de produto).
export default function EditorMensagem({ valor, onValor, usaPadrao, onUsaPadrao, novo = false, name, id }: {
  valor: string; onValor: (v: string) => void;
  usaPadrao: boolean; onUsaPadrao: (v: boolean) => void;
  novo?: boolean;                 // produto novo: já começa com a mensagem padrão, se existir
  name?: string; id?: string;
}) {
  const [padrao, setPadrao] = useState<string>('');
  const [recurso, setRecurso] = useState(false); // false até confirmar que o SQL 10 foi rodado
  const [editandoPadrao, setEditandoPadrao] = useState(false);
  const [rascunhoPadrao, setRascunhoPadrao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/seller/mensagem-padrao', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json()).then((d) => {
        if (!vivo || !d?.recurso) return;
        const t = String(d.texto || '');
        setRecurso(true); setPadrao(t); setRascunhoPadrao(t);
        if (novo && t && !valor.trim()) { onUsaPadrao(true); onValor(t); }
        if (usaPadrao && !t) setEditandoPadrao(true);
      }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // texto que está sendo editado agora
  const modoPadrao = recurso && usaPadrao;
  const editandoTexto = modoPadrao ? rascunhoPadrao : valor;
  const setTexto = (v: string) => (modoPadrao ? setRascunhoPadrao(v) : onValor(v));
  const bloqueado = recurso && usaPadrao && !editandoPadrao && !!padrao;

  function envolver(antes: string, depois = antes, exemplo = 'texto') {
    const el = ref.current; if (!el) return;
    const ini = el.selectionStart, fim = el.selectionEnd;
    const sel = editandoTexto.slice(ini, fim) || exemplo;
    const novo = editandoTexto.slice(0, ini) + antes + sel + depois + editandoTexto.slice(fim);
    if (novo.length > MSG_MAX) return toast(`Limite de ${MSG_MAX} caracteres.`, 'error');
    setTexto(novo);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + antes.length, ini + antes.length + sel.length); });
  }
  function prefixarLinhas(tipo: 'ul' | 'ol') {
    const el = ref.current; if (!el) return;
    const ini = editandoTexto.lastIndexOf('\n', el.selectionStart - 1) + 1;
    let fim = editandoTexto.indexOf('\n', el.selectionEnd); if (fim < 0) fim = editandoTexto.length;
    const linhas = editandoTexto.slice(ini, fim).split('\n').map((l, i) => (tipo === 'ul' ? `- ${l.replace(/^\s*([-•]|\d+[.)])\s+/, '')}` : `${i + 1}. ${l.replace(/^\s*([-•]|\d+[.)])\s+/, '')}`));
    setTexto(editandoTexto.slice(0, ini) + linhas.join('\n') + editandoTexto.slice(fim));
    requestAnimationFrame(() => el.focus());
  }
  function inserirLink() {
    const url = window.prompt('Cole o link (começando com https://):', 'https://');
    if (!url || !/^https?:\/\/\S+$/.test(url.trim())) { if (url) toast('Link inválido. Use https://…', 'error'); return; }
    const el = ref.current; const sel = el ? editandoTexto.slice(el.selectionStart, el.selectionEnd) : '';
    envolver('[', `](${url.trim()})`, sel || 'clique aqui');
  }

  async function salvarPadrao(texto: string) {
    if (!texto.trim()) return toast('Escreva a mensagem padrão antes de salvar.', 'error');
    setSalvando(true);
    try {
      const r = await fetch('/api/seller/mensagem-padrao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ texto }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível salvar a mensagem padrão.', 'error'); return; }
      setPadrao(d.texto); setRascunhoPadrao(d.texto); setEditandoPadrao(false);
      if (modoPadrao) onValor(d.texto);
      const n = Number(d.atualizados) || 0;
      toast(n > 0
        ? `Mensagem padrão salva e aplicada em ${n} anúncio${n === 1 ? '' : 's'}${d.revisao ? ' (eles passam por uma revisão rápida)' : ''}.`
        : 'Mensagem padrão salva.', 'success');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setSalvando(false); }
  }

  const btn = (rot: string, titulo: string, acao: () => void, estilo?: React.CSSProperties) => (
    <button type="button" className="em-b" title={titulo} aria-label={titulo} disabled={bloqueado} onMouseDown={(e) => e.preventDefault()} onClick={acao} style={estilo}>{rot}</button>
  );

  return (
    <div className="em">
      <style>{`
        .em{display:grid;gap:10px;}
        .em-modo{display:flex;gap:8px;flex-wrap:wrap;}
        .em-modo label{flex:1 1 220px;display:flex;gap:10px;align-items:flex-start;border:1.5px solid var(--border2);border-radius:14px;padding:12px 14px;cursor:pointer;font-size:14px;background:#fff;}
        .em-modo label.on{border-color:var(--orange);background:var(--soft);}
        .em-modo input{margin-top:3px;accent-color:var(--orange);}
        .em-modo small{display:block;color:var(--sub);font-size:12.5px;margin-top:2px;font-weight:500;}
        .em-box{border:1.5px solid var(--border2);border-radius:14px;overflow:hidden;background:#fff;}
        .em-box:focus-within{border-color:var(--orange);box-shadow:0 0 0 3px rgba(255,107,0,.12);}
        .em-bar{display:flex;gap:2px;flex-wrap:wrap;align-items:center;padding:6px;border-bottom:1px solid var(--border);background:var(--surface);}
        .em-b{min-width:34px;height:32px;border:none;background:none;border-radius:8px;font-size:14px;cursor:pointer;color:var(--text);padding:0 8px;}
        .em-b:hover:not(:disabled){background:#fff;box-shadow:0 0 0 1px var(--border2);}
        .em-b:disabled{opacity:.4;cursor:not-allowed;}
        .em-sep{width:1px;height:20px;background:var(--border2);margin:0 4px;}
        .em-box textarea{width:100%;min-height:150px;border:none;outline:none;resize:vertical;padding:12px 14px;font-size:14.5px;line-height:1.5;font-family:inherit;background:transparent;}
        .em-box textarea:read-only{background:var(--bg2);color:var(--sub);}
        .em-prev{padding:12px 14px;min-height:150px;font-size:14.5px;}
        .em-rod{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;border-top:1px solid var(--border);font-size:12px;color:var(--sub);}
      `}</style>

      {recurso && (
        <div className="em-modo" role="radiogroup" aria-label="Qual mensagem enviar">
          <label className={usaPadrao ? 'on' : ''}>
            <input type="radio" checked={usaPadrao} onChange={() => { onUsaPadrao(true); if (padrao) onValor(padrao); else setEditandoPadrao(true); }} />
            <span><b>Usar minha mensagem padrão</b><small>A mesma mensagem em todas as compras. Mudou a padrão, muda em todos os anúncios que usam ela.</small></span>
          </label>
          <label className={!usaPadrao ? 'on' : ''}>
            <input type="radio" checked={!usaPadrao} onChange={() => { onUsaPadrao(false); if (!valor && padrao) onValor(padrao); setEditandoPadrao(false); }} />
            <span><b>Personalizar para este anúncio</b><small>Mensagem só deste produto (ex.: link ou instruções específicas).</small></span>
          </label>
        </div>
      )}

      <div className="em-box">
        <div className="em-bar" role="toolbar" aria-label="Formatação">
          {btn('B', 'Negrito', () => envolver('**'), { fontWeight: 900 })}
          {btn('I', 'Itálico', () => envolver('_'), { fontStyle: 'italic', fontFamily: 'Georgia, serif' })}
          {btn('S', 'Riscado', () => envolver('~~'), { textDecoration: 'line-through' })}
          <span className="em-sep" />
          {btn('• Lista', 'Lista com marcadores', () => prefixarLinhas('ul'))}
          {btn('1. Lista', 'Lista numerada', () => prefixarLinhas('ol'))}
          {btn('🔗 Link', 'Inserir link', inserirLink)}
          <span style={{ marginLeft: 'auto' }} />
          <button type="button" className="em-b" onClick={() => setPrevia(!previa)} aria-pressed={previa}>{previa ? '✎ Editar' : '👁 Prévia'}</button>
        </div>
        {previa
          ? <div className="em-prev">{editandoTexto.trim() ? <TextoFormatado texto={editandoTexto} corLink="#B84A00" /> : <span className="muted">Nada escrito ainda.</span>}</div>
          : <textarea ref={ref} id={id} value={editandoTexto} readOnly={bloqueado} maxLength={MSG_MAX}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={'Ex.:\nObrigado pela compra! 🎉\n**Seu acesso:** https://…\n- Passo 1: …\n- Passo 2: …'} />}
        <div className="em-rod">
          <span>{editandoTexto.length}/{MSG_MAX} · aparece no pedido e é enviada no chat assim que o pagamento é confirmado</span>
          {recurso && usaPadrao && (bloqueado
            ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRascunhoPadrao(padrao); setEditandoPadrao(true); }}>Editar mensagem padrão</button>
            : <span style={{ display: 'flex', gap: 6 }}>
                {padrao && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRascunhoPadrao(padrao); setEditandoPadrao(false); }}>Cancelar</button>}
                <button type="button" className="btn btn-pri btn-sm" disabled={salvando} onClick={() => salvarPadrao(rascunhoPadrao)}>{salvando ? 'Salvando…' : 'Salvar mensagem padrão'}</button>
              </span>)}
          {recurso && !usaPadrao && valor.trim() && valor !== padrao && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={salvando} onClick={() => salvarPadrao(valor)}>{salvando ? 'Salvando…' : 'Salvar este texto como minha padrão'}</button>
          )}
        </div>
      </div>

      {name && <>
        <input type="hidden" name={name} value={modoPadrao ? padrao : valor} />
        <input type="hidden" name="usa_mensagem_padrao" value={modoPadrao ? '1' : ''} />
      </>}
    </div>
  );
}
