'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBar() {
  const [q, setQ] = useState('');
  const router = useRouter();
  function go(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/produtos?q=${encodeURIComponent(q.trim())}`);
  }
  return (
    <form onSubmit={go} style={{ display: 'flex', gap: 10, marginTop: 26, maxWidth: 600 }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 16, pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busque por prompts, templates, planilhas…"
          style={{ width: '100%', height: 56, borderRadius: 14, border: '2px solid #FFCBA1', padding: '0 16px 0 46px', fontSize: 16, background: '#fff', boxShadow: '0 8px 28px rgba(255,107,0,.12)', outline: 'none' }} />
      </div>
      <button className="btn btn-pri" style={{ height: 56, padding: '0 28px', fontSize: 16, boxShadow: '0 8px 24px rgba(255,107,0,.32)' }}>Buscar</button>
    </form>
  );
}
