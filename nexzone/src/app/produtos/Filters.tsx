'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Filters({ categorias }: any) {
  const router = useRouter(); const sp = useSearchParams(); const pathname = usePathname();
  const catAtiva = sp.get('cat') || '';
  const [min, setMin] = useState(sp.get('min') || '');
  const [max, setMax] = useState(sp.get('max') || '');

  function setParam(updates: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k); });
    router.push(`${pathname}?${p.toString()}`);
  }
  const temFiltro = catAtiva || sp.get('min') || sp.get('max') || sp.get('q');

  return (
    <div>
      <div style={card}>
        <h3 style={h3}>Categorias</h3>
        <button onClick={() => setParam({ cat: '' })} style={catBtn(!catAtiva)}>Todas</button>
        {categorias.map((c: any) => (
          <button key={c.slug} onClick={() => setParam({ cat: c.slug })} style={catBtn(catAtiva === c.slug)}>{c.emoji} {c.nome}</button>
        ))}
      </div>
      <div style={card}>
        <h3 style={h3}>Faixa de preço</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="Mín" type="number" style={inp} />
          <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="Máx" type="number" style={inp} />
        </div>
        <button className="btn btn-pri btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={() => setParam({ min, max })}>Aplicar</button>
      </div>
      {temFiltro ? <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => router.push(pathname)}>Limpar filtros</button> : null}
    </div>
  );
}
const card = { background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 } as const;
const h3 = { fontFamily: 'Outfit', fontWeight: 800, fontSize: 14, marginBottom: 10 } as const;
const inp = { width: '100%', height: 38, borderRadius: 9, border: '1px solid var(--border)', padding: '0 10px', fontSize: 14 } as const;
function catBtn(active: boolean): React.CSSProperties {
  return { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600, fontSize: 13, marginBottom: 2, background: active ? 'var(--soft)' : 'transparent', color: active ? 'var(--orange)' : 'var(--sub)' };
}
