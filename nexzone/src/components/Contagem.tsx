'use client';
import { useEffect, useState } from 'react';

// Contagem regressiva até `alvo` (ms). Mostra "2d 05:12:33" ou "05:12:33". No servidor, um traço (sem pulo de hidratação).
export default function Contagem({ alvo, rotuloFim = 'Encerrado', className, style }: { alvo: number; rotuloFim?: string; className?: string; style?: React.CSSProperties }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => { setAgora(Date.now()); const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (agora === null) return <span className={className} style={style} aria-hidden="true">--:--:--</span>;
  let s = Math.max(0, Math.floor((alvo - agora) / 1000));
  if (s <= 0) return <span className={className} style={style}>{rotuloFim}</span>;
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }} role="timer">{d > 0 ? `${d}d ` : ''}{p(h)}:{p(m)}:{p(s)}</span>;
}
