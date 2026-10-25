import type { CSSProperties } from 'react';
import { getTier } from '@/lib/journey';

/**
 * Selo da Jornada de faturamento — SVG puro (sem imagens).
 * <JourneyBadge tierId="decolagem" size={96} animate />  ·  <JourneyBadge tierId="lenda" size={64} locked />
 */
const SHIELD = 'M60 6 L108 21 V62 C108 96 87 118 60 131 C33 118 12 96 12 62 V21 Z';
const INNER = 'M60 15 L100 27.5 V62 C100 91 82 110 60 121.5 C38 110 20 91 20 62 V27.5 Z';
const STAR = 'M60 34 L66.5 49.5 L83 50.8 L70.4 61.7 L74.3 78 L60 69.3 L45.7 78 L49.6 61.7 L37 50.8 L53.5 49.5 Z';
const ROCKET = 'M60 30 C69 38 73 50 72 64 L76 72 L76 80 L69 75 L51 75 L44 80 L44 72 L48 64 C47 50 51 38 60 30 Z';

const CSS = `
.jb-shine{transform:translateX(-140px);animation:jb-sweep 3.6s ease-in-out 1s infinite;}
@keyframes jb-sweep{0%{transform:translateX(-140px)}45%,100%{transform:translateX(140px)}}
@media (prefers-reduced-motion: reduce){.jb-shine{animation:none;opacity:0}}
`;

export default function JourneyBadge({ tierId, size = 80, locked = false, animate = false, style }: {
  tierId: string; size?: number; locked?: boolean; animate?: boolean; style?: CSSProperties;
}) {
  const t = getTier(tierId);
  const c = t.cores;
  const k = `jb-${t.id}${locked ? '-l' : ''}`;
  const label = t.id === 'lenda' ? 'LENDA' : t.nome.toUpperCase();
  const long = label.length > 9;

  return (
    <svg width={size} height={size * (140 / 120)} viewBox="0 0 120 140" role="img"
      aria-label={`Selo ${t.nome}${locked ? ' (bloqueado)' : ''}`}
      style={{ flexShrink: 0, display: 'block', overflow: 'visible', filter: locked ? 'grayscale(1)' : undefined, opacity: locked ? 0.5 : 1, ...style }}>
      <title>{`Selo ${t.nome}`}</title>
      <defs>
        <linearGradient id={`${k}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.from} />
          <stop offset="1" stopColor={c.to} />
        </linearGradient>
        <linearGradient id={`${k}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".85" />
          <stop offset=".5" stopColor={c.edge} />
          <stop offset="1" stopColor={c.edge} />
        </linearGradient>
        <linearGradient id={`${k}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${k}-sweep`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${k}-clip`}><path d={SHIELD} /></clipPath>
      </defs>
      {animate && !locked && <style>{CSS}</style>}

      {/* escudo */}
      <path d={SHIELD} fill={`url(#${k}-rim)`} />
      <path d={INNER} fill={`url(#${k}-fill)`} stroke={c.edge} strokeOpacity=".35" strokeWidth="1" />
      <path d={INNER} fill={`url(#${k}-gloss)`} />

      {/* pequenas estrelas de fundo */}
      <g fill={c.ink} opacity=".35">
        <circle cx="34" cy="40" r="1.6" /><circle cx="88" cy="36" r="1.2" /><circle cx="84" cy="58" r="1.6" /><circle cx="36" cy="64" r="1.1" />
      </g>

      {/* símbolo */}
      {t.glyph === 'rocket' ? (
        <g>
          <path d={ROCKET} fill={c.ink} fillOpacity=".92" />
          <circle cx="60" cy="52" r="5.2" fill={c.from} />
          <path d="M54 77 L60 88 L66 77 Z" fill={c.from} opacity=".9" />
        </g>
      ) : (
        <path d={STAR} fill={c.ink} fillOpacity=".92" stroke={c.from} strokeOpacity=".6" strokeWidth="1.2" strokeLinejoin="round" />
      )}

      {/* brilho animado */}
      {animate && !locked && (
        <g clipPath={`url(#${k}-clip)`}>
          <g transform="skewX(-18)">
            <rect className="jb-shine" x="20" y="-10" width="34" height="160" fill={`url(#${k}-sweep)`} />
          </g>
        </g>
      )}

      {/* fita */}
      <path d="M2 96 L14 92 L14 116 L2 112 L8 104 Z" fill={c.ribbon} opacity=".8" />
      <path d="M118 96 L106 92 L106 116 L118 112 L112 104 Z" fill={c.ribbon} opacity=".8" />
      <rect x="10" y="91" width="100" height="22" rx="3" fill={c.ribbon} />
      <rect x="10" y="91" width="100" height="7" rx="3" fill="#fff" opacity=".18" />
      <text x="60" y="106.5" textAnchor="middle" fill="#fff" fontFamily="Outfit, system-ui, sans-serif" fontWeight="900"
        fontSize={long ? 10 : 11.5} letterSpacing={long ? 0.4 : 1.2} {...(long ? { textLength: 90, lengthAdjust: 'spacingAndGlyphs' } : {})}>
        {label}
      </text>

      {/* cadeado */}
      {locked && (
        <g transform="translate(78 4)">
          <circle cx="16" cy="16" r="15" fill="#fff" stroke="#9A9AAE" strokeWidth="2" />
          <g transform="translate(6 6) scale(.84)" fill="none" stroke="#3A3A52" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </g>
        </g>
      )}
    </svg>
  );
}
