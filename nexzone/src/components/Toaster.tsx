'use client';
import { useEffect, useState } from 'react';

type T = { id: number; message: string; type: string };

export default function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    function on(e: any) {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, message: e.detail.message, type: e.detail.type || 'info' }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
    }
    window.addEventListener('nz-toast', on as any);
    return () => window.removeEventListener('nz-toast', on as any);
  }, []);
  const color = (t: string) => (t === 'success' ? '#00B87A' : t === 'error' ? '#E23B3B' : '#16162A');
  const icon = (t: string) => (t === 'success' ? '✓' : t === 'error' ? '⚠' : 'ℹ');
  return (
    <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      {items.map((t) => (
        <div key={t.id} style={{ background: '#fff', borderLeft: `4px solid ${color(t.type)}`, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: '13px 16px', fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: '#16162A', display: 'flex', gap: 10, alignItems: 'center', animation: 'nztoast .25s ease' }}>
          <span style={{ color: color(t.type), fontWeight: 800 }}>{icon(t.type)}</span>{t.message}
        </div>
      ))}
      <style>{`@keyframes nztoast{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
