'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

type Item = { id: string; titulo: string; capa: string | null; vendas: number; precoHoje: number; inscrito: number | null; noAr: boolean };
const brl = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function InscreverBF({ itens: inicial, descontoMin }: { itens: Item[]; descontoMin: number }) {
  const [itens, setItens] = useState(inicial);
  const [valor, setValor] = useState<Record<string, string>>(() => Object.fromEntries(inicial.map((i) => [i.id, i.inscrito ? String(i.inscrito).replace('.', ',') : ''])));
  const [busy, setBusy] = useState<string | null>(null);
  const maximo = (p: number) => Math.floor(p * (1 - descontoMin / 100) * 100) / 100;

  async function salvar(i: Item) {
    setBusy(i.id);
    try {
      const r = await fetch('/api/seller/black-friday', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ productId: i.id, preco: valor[i.id] }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível salvar.', 'error'); return; }
      setItens((l) => l.map((x) => (x.id === i.id ? { ...x, inscrito: d.preco, precoHoje: d.precoRef } : x)));
      toast('Produto inscrito na Black Friday.', 'success');
    } finally { setBusy(null); }
  }
  async function tirar(i: Item) {
    setBusy(i.id);
    try {
      const r = await fetch('/api/seller/black-friday', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ productId: i.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível tirar.', 'error'); return; }
      setItens((l) => l.map((x) => (x.id === i.id ? { ...x, inscrito: null } : x))); setValor((v) => ({ ...v, [i.id]: '' }));
    } finally { setBusy(null); }
  }

  const n = itens.filter((i) => i.inscrito).length;
  if (!itens.length) return <div className="card">Você ainda não tem produtos ativos.</div>;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}><b>{n}</b> de {itens.length} produtos inscritos</div>
      {itens.map((i, k) => (
        <div key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: k ? '1px solid var(--border)' : 'none', flexWrap: 'wrap', background: i.inscrito ? '#F2FBF6' : undefined }}>
          <span style={{ width: 44, height: 44, borderRadius: 10, flex: 'none', background: `#F1F1F6 center/cover ${i.capa ? `url(${i.capa})` : ''}` }} />
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.titulo}</b>
            <small className="muted">Hoje {brl(i.precoHoje)} · na Black Friday no máximo {brl(maximo(i.precoHoje))}{i.vendas ? ` · ${i.vendas} vendidos` : ''}</small>
          </div>
          {i.noAr ? <b style={{ color: 'var(--green)', fontSize: 13 }}>No ar por {brl(i.inscrito || 0)}</b> : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input aria-label={`Preço na Black Friday de ${i.titulo}`} inputMode="decimal" placeholder="R$" value={valor[i.id] || ''} onChange={(e) => setValor((v) => ({ ...v, [i.id]: e.target.value }))}
                style={{ width: 96, height: 38, border: '1.5px solid var(--border)', borderRadius: 10, padding: '0 10px', fontSize: 15 }} />
              <button className="btn btn-pri btn-sm" disabled={busy === i.id || !valor[i.id]} onClick={() => salvar(i)}>{i.inscrito ? 'Atualizar' : 'Inscrever'}</button>
              {i.inscrito && <button className="btn btn-ghost btn-sm" disabled={busy === i.id} onClick={() => tirar(i)}>Tirar</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
