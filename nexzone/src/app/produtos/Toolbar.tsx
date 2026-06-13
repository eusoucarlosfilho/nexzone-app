'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Toolbar({ total, sort }: { total: number; sort: string }) {
  const router = useRouter(); const sp = useSearchParams(); const pathname = usePathname();
  const [q, setQ] = useState(sp.get('q') || '');

  function setParam(updates: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k); });
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <form onSubmit={(e) => { e.preventDefault(); setParam({ q }); }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos…" style={{ flex: 1, height: 44, borderRadius: 11, border: '1.5px solid var(--border)', padding: '0 14px', fontSize: 14 }} />
        <button className="btn btn-pri" style={{ height: 44 }}>Buscar</button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{total} produto{total === 1 ? '' : 's'}</span>
        <select value={sort} onChange={(e) => setParam({ sort: e.target.value })} style={{ height: 40, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, fontWeight: 600 }}>
          <option value="vendas">Mais vendidos</option>
          <option value="novos">Mais novos</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
        </select>
      </div>
    </div>
  );
}
