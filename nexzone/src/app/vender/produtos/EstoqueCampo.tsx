'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { avisoEstoque, lerEstoque } from '@/lib/estoque';

// Quantidade disponível do produto. Salvar NÃO manda o produto para revisão.
// Em branco = não controla estoque (nada aparece para o comprador).
export default function EstoqueCampo({ id, estoque, onSalvo }: {
  id: string; estoque: number | null;
  onSalvo: (r: { estoque: number | null; status?: string; pausado_sem_estoque?: boolean }) => void;
}) {
  const inicial = estoque === null || estoque === undefined ? '' : String(estoque);
  const [valor, setValor] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudou = valor.trim() !== salvo;
  const aviso = avisoEstoque(salvo === '' ? null : Number(salvo));

  async function salvar() {
    const lido = lerEstoque(valor);
    if (!lido.ok) { setErro(lido.erro); return; }
    setErro(null); setBusy(true);
    try {
      const r = await fetch('/api/seller/product', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, action: 'estoque', estoque: lido.valor === null ? '' : String(lido.valor) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(d.error || 'Não foi possível salvar o estoque.'); return; }
      const novo = d.estoque === null || d.estoque === undefined ? '' : String(d.estoque);
      setValor(novo); setSalvo(novo);
      onSalvo({ estoque: d.estoque ?? null, status: d.status, pausado_sem_estoque: d.pausado_sem_estoque });
      toast(novo === '' ? 'Estoque desligado: o comprador não vê quantidade.' : `Estoque salvo: ${novo} unidade${novo === '1' ? '' : 's'}.`, 'success');
    } catch { setErro('Falha de conexão. Tente de novo.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="pm-estoque">
      <label htmlFor={`est-${id}`}>Estoque</label>
      <input id={`est-${id}`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={7} placeholder="Ilimitado"
        value={valor} onChange={(e) => { setValor(e.target.value.replace(/[^\d]/g, '')); setErro(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (mudou) salvar(); } }}
        aria-invalid={!!erro} aria-describedby={`est-h-${id}`} />
      <button type="button" className="btn btn-ghost btn-sm" disabled={!mudou || busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar'}</button>
      <span id={`est-h-${id}`} className={`pm-est-h ${erro ? 'erro' : aviso?.nivel ?? ''}`}>
        {erro || (aviso ? `Comprador vê: "${aviso.texto}"` : 'Em branco: sem limite e sem quantidade na página.')}
      </span>
    </div>
  );
}
