'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';

export default function SearchBar() {
  const [q, setQ] = useState('');
  const router = useRouter();
  function go(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/produtos?q=${encodeURIComponent(q.trim())}`);
  }
  return (
    <form onSubmit={go} role="search" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26, maxWidth: 600, width: '100%' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Icon name="search" size={20} color="#5A5A72" strokeWidth={2.4} style={{ position: 'absolute', left: 16, pointerEvents: 'none' }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busque por prompts, templates, planilhas…" aria-label="Buscar produtos" type="search"
          style={{ width: '100%', minWidth: 0, height: 56, borderRadius: 14, border: '1.5px solid #E6DED6', padding: '0 16px 0 46px', fontSize: 16, background: '#fff', boxShadow: '0 8px 28px rgba(22,22,42,.06)', outline: 'none' }} />
      </div>
      <button className="btn btn-pri" style={{ height: 56, padding: '0 28px', fontSize: 16, boxShadow: '0 8px 24px rgba(255,107,0,.32)', flex: '0 0 auto' }}>Buscar</button>
    </form>
  );
}
