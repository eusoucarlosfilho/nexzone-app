'use client';
import { useEffect, useRef } from 'react';

// Confirmação acessível para ações destrutivas ou importantes.
// Esc cancela; o foco vai para "Cancelar" ao abrir e volta para quem abriu ao fechar.
type Props = {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ open, title, text, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger, busy, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const anterior = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Tab' && dialogRef.current) {
        const foc = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!foc.length) return;
        const first = foc[0]; const last = foc[foc.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); anterior?.focus?.(); };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="ui-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div ref={dialogRef} className="ui-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ui-dialog-t" aria-describedby={text ? 'ui-dialog-d' : undefined}>
        <h2 id="ui-dialog-t">{title}</h2>
        {text && <p id="ui-dialog-d">{text}</p>}
        <div className="ui-dialog-act">
          <button ref={cancelRef} type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-pri'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Aguarde…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
