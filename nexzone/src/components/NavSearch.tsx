'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NavSearch() {
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get('q') ?? '');
  const router = useRouter();
  function go(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `/produtos?q=${encodeURIComponent(t)}` : '/produtos');
  }
  return (
    <form onSubmit={go} className="nav-search" role="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5A5A72" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produtos"
        placeholder="Busque prompts, planilhas, templates, automações…" />
      <button type="submit">Buscar</button>
    </form>
  );
}
