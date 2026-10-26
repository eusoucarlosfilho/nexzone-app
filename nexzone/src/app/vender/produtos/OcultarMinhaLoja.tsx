'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

// Só aparece para quem é ADMIN e também vendedor: liga/desliga "Vender como Comprei Barato"
// na própria loja (mesma chave do Admin → Usuários). Vale para todos os produtos da loja.
export default function OcultarMinhaLoja({ storeId, nomeLoja, ocultoInicial }: { storeId: string; nomeLoja: string; ocultoInicial: boolean }) {
  const [oculto, setOculto] = useState(ocultoInicial);
  const [busy, setBusy] = useState(false);

  async function alternar() {
    const ligar = !oculto;
    if (ligar && !confirm(`Todos os produtos de "${nomeLoja}" vão aparecer como vendidos pelo Comprei Barato (página, card, checkout, chat e e-mails). O nome da loja fica visível só no Admin. Continuar?`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/store-visibility', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ store_id: storeId, ocultar: ligar }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível alterar.', 'error'); return; }
      setOculto(d.ocultar_vendedor === true);
      toast(d.ocultar_vendedor ? 'Pronto: sua loja agora vende como Comprei Barato.' : `Pronto: seus produtos voltaram a mostrar "${nomeLoja}".`, 'success');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16, padding: '14px 18px', borderColor: oculto ? 'var(--orange)' : undefined }}>
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <strong style={{ fontFamily: 'Outfit', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          Nome da loja nas vendas
          <span className="ui-badge" style={{ fontSize: 11, padding: '2px 8px', background: oculto ? '#FF6B00' : 'var(--green-bg)', color: oculto ? '#fff' : 'var(--green)' }}>
            {oculto ? 'Oculto · aparece "Comprei Barato"' : `Visível · aparece "${nomeLoja}"`}
          </span>
        </strong>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Opção de administrador. Vale para todos os seus produtos. Pagamento e repasse não mudam.</div>
      </div>
      <button type="button" className={oculto ? 'btn btn-ghost btn-sm' : 'btn btn-pri btn-sm'} disabled={busy} onClick={alternar} aria-pressed={oculto}>
        {busy ? 'Salvando…' : oculto ? 'Mostrar o nome da minha loja' : 'Ocultar o nome da minha loja'}
      </button>
    </div>
  );
}
