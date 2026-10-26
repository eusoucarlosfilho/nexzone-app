'use client';
import { useState, useEffect } from 'react';
import Icon from '@/components/Icon';

export default function Countdown({ until, cor }: { until: string; cor?: string }) {
  const target = new Date(until).getTime();
  // Começa sem horário (igual no servidor e no navegador) para não dar diferença na hidratação
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (isNaN(target)) return null;
  const diff = target - (now ?? 0);
  if (now === null) {
    return <div style={{ background: cor || 'var(--orange)', color: '#fff', borderRadius: 12, padding: '12px 14px', textAlign: 'center', marginBottom: 14, fontFamily: 'Outfit', fontWeight: 800, letterSpacing: .3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="hourglass" size={18} /> Oferta termina em --:--:--</div>;
  }
  if (diff <= 0) {
    return <div style={{ background: '#f1f1f4', color: 'var(--sub)', borderRadius: 12, padding: '10px 14px', textAlign: 'center', fontSize: 13, marginBottom: 14, fontWeight: 700 }}>Esta oferta foi encerrada.</div>;
  }
  const d = (n: number) => String(n).padStart(2, '0');
  const dias = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  return (
    <div style={{ background: cor || 'var(--orange)', color: '#fff', borderRadius: 12, padding: '12px 14px', textAlign: 'center', marginBottom: 14, fontFamily: 'Outfit', fontWeight: 800, letterSpacing: .3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Icon name="hourglass" size={18} /> Oferta termina em {dias > 0 ? `${dias}d ` : ''}{d(h)}:{d(m)}:{d(s)}
    </div>
  );
}
