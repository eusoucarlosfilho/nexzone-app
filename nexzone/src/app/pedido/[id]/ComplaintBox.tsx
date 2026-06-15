'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function ComplaintBox({ orderId, aberta }: { orderId: string; aberta: boolean }) {
  const [jaAberta, setJaAberta] = useState(aberta);
  const [abrir, setAbrir] = useState(false);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);

  if (jaAberta) {
    return (
      <div style={{ background: '#FFF7E6', border: '1px solid #F5D58A', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#9A6B00', marginTop: 12 }}>
        ⚠️ Você abriu uma reclamação para esta compra. O suporte está analisando — fale com o vendedor pela conversa acima para tentar resolver.
      </div>
    );
  }

  async function enviar() {
    if (!texto.trim()) { toast('Descreva o problema.', 'error'); return; }
    setBusy(true);
    const r = await fetch('/api/complaints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ orderId, texto }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { setJaAberta(true); toast('Reclamação aberta. O suporte vai analisar.', 'success'); }
    else toast(d.error || 'Falha ao abrir reclamação.', 'error');
  }

  return (
    <div style={{ marginTop: 12, textAlign: 'center' }}>
      {!abrir ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setAbrir(true)}>Tenho um problema com esta compra</button>
      ) : (
        <div style={{ textAlign: 'left', background: 'var(--soft)', borderRadius: 10, padding: 12 }}>
          <strong style={{ fontFamily: 'Outfit', fontSize: 13 }}>Abrir reclamação</strong>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>Conte o que houve com o produto ou a entrega. Enquanto a reclamação estiver aberta, o pagamento fica retido com a plataforma.</p>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Descreva o problema…"
            style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-pri btn-sm" onClick={enviar} disabled={busy}>{busy ? 'Enviando…' : 'Abrir reclamação'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAbrir(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
