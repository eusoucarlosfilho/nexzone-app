'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';
import { PLANOS, type Plano } from '@/lib/taxas';

// Troca rápida do plano de visibilidade na lista de Meus produtos (sem voltar para revisão).
export default function PlanoRapido({ productId, plano, pcts, ativos }: { productId: string; plano: Plano; pcts: { basico: number; destaque: number; topo: number }; ativos: boolean }) {
  const [atual, setAtual] = useState<Plano>(ativos ? plano : 'basico');
  const [busy, setBusy] = useState(false);
  const fmt = (n: number) => `${String(n).replace('.', ',')}%`;

  async function trocar(novo: Plano) {
    if (novo === atual || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/seller/product', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: productId, action: 'plano', plano: novo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível trocar o plano.', 'error'); return; }
      setAtual(novo);
      toast(`Plano ${PLANOS.find((p) => p.id === novo)?.nome} ativado (${fmt(pcts[novo])} por venda).`, 'success');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <label className={`btn btn-ghost btn-sm pr-plano ${atual}`} title={ativos ? 'Plano de visibilidade do anúncio' : 'No lançamento todos os anúncios ficam no Básico'}>
      <Icon name={atual === 'topo' ? 'trophy' : atual === 'destaque' ? 'star' : 'rocket'} size={16} />
      <select value={atual} disabled={!ativos || busy} onChange={(e) => trocar(e.target.value as Plano)} aria-label="Plano do anúncio">
        {PLANOS.map((p) => <option key={p.id} value={p.id}>{p.nome} · {fmt(pcts[p.id])}</option>)}
      </select>
      <style dangerouslySetInnerHTML={{ __html: '.pr-plano{display:inline-flex;align-items:center;gap:4px;cursor:pointer}.pr-plano select{border:0;background:none;font:inherit;font-weight:800;color:inherit;padding:0;height:auto;min-height:0;box-shadow:none;appearance:auto;cursor:pointer}.pr-plano.topo{border-color:#FF9A3C;background:#FFF2E8}.pr-plano.destaque{border-color:#FFD3B0}' }} />
    </label>
  );
}
