import type { ReactNode } from 'react';

/**
 * Ícone por categoria — substitui os emojis que vêm do banco (categories.emoji / products.emoji).
 * Aceita o slug ('ia-ferramentas') ou o nome ('IA & Ferramentas').
 */
const C: Record<string, { bg: string; fg: string; d: ReactNode }> = {
  ia: { bg: '#FFE3CC', fg: '#8F3A00', d: <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></> },
  templates: { bg: '#DDF3E8', fg: '#00603F', d: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></> },
  design: { bg: '#E6E4FF', fg: '#3B33A8', d: <><path d="m12 19 7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="m2 2 7.586 7.586" /><circle cx="11" cy="11" r="2" /></> },
  automacoes: { bg: '#FFF1C7', fg: '#7A5200', d: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /> },
  marketing: { bg: '#FFDCDC', fg: '#A61B1B', d: <><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></> },
  cursos: { bg: '#D9EEFF', fg: '#0B5394', d: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5V21h16" /></> },
  outros: { bg: '#F1EEEA', fg: '#3A3A52', d: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></> },
};

export function categoryKey(v?: string | null): keyof typeof C {
  const s = (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.includes('ia') && (s.includes('ferrament') || s === 'ia' || s.startsWith('ia-') || s.startsWith('ia '))) return 'ia';
  if (s.includes('template') || s.includes('planilha')) return 'templates';
  if (s.includes('design')) return 'design';
  if (s.includes('automa')) return 'automacoes';
  if (s.includes('marketing')) return 'marketing';
  if (s.includes('curso') || s.includes('ebook')) return 'cursos';
  return 'outros';
}

export function categoryColors(v?: string | null) { const c = C[categoryKey(v)]; return { bg: c.bg, fg: c.fg }; }

export default function CategoryIcon({ cat, size = 22, color }: { cat?: string | null; size?: number; color?: string }) {
  const c = C[categoryKey(cat)];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || c.fg} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>{c.d}</svg>
  );
}

/** Capa de reserva quando o produto não tem imagem: fundo da categoria + ícone grande. */
export function CategoryCover({ cat, size = 56 }: { cat?: string | null; size?: number }) {
  const c = C[categoryKey(cat)];
  return (
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CategoryIcon cat={cat} size={size} />
    </span>
  );
}
