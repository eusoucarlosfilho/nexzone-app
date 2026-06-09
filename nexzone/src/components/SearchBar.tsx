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
    <form onSubmit={go} style={{ display: 'flex', gap: 8, marginTop: 26, maxWidth: 540 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busque por prompts, templates, planilhas…"
        style={{ flex: 1, height: 50, borderRadius: 12, border: '1.5px solid var(--border)', padding: '0 16px', fontSize: 15, background: '#fff' }} />
      <button className="btn btn-pri" style={{ height: 50, padding: '0 22px' }}>Buscar</button>
    </form>
  );
}
