import type { ReactNode } from 'react';
import { CATEGORIAS, acharCategoria, type IconeCategoria } from '@/lib/categorias';

/**
 * Ícone por categoria — substitui os emojis que vêm do banco (categories.emoji / products.emoji).
 * Aceita o slug ('ia-ferramentas') ou o nome ('IA & Ferramentas').
 */
// Desenho de cada ícone (estilo traço 24×24, igual aos atuais). Cores vêm de src/lib/categorias.ts.
const D: Record<IconeCategoria | 'outros', ReactNode> = {
  ia: <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></>,
  templates: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  design: <><path d="m12 19 7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="m2 2 7.586 7.586" /><circle cx="11" cy="11" r="2" /></>,
  automacoes: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  marketing: <><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  cursos: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5V21h16" /></>,
  // controle de videogame
  jogos: <><rect x="2" y="6" width="20" height="12" rx="4" /><path d="M6 12h4M8 10v4" /><path d="M15 13h.01M18 11h.01" /></>,
  programacao: <><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>,
  video: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8Z" /></>,
  musica: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  fotografia: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></>,
  negocios: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  concursos: <><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
  idiomas: <><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></>,
  saude: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" /></>,
  culinaria: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></>,
  infantil: <><path d="M9 12h.01M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" /></>,
  religiao: <><path d="M12 2v6M9 5h6" /><path d="M18 22V11l-6-3-6 3v11" /><path d="M4 22h16" /><path d="M10 22v-4a2 2 0 0 1 4 0v4" /></>,
  moda: <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />,
  artesanato: <><circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" /></>,
  outros: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
};
const COR_OUTROS = { bg: '#F1EEEA', fg: '#3A3A52' };

type Visual = { bg: string; fg: string; d: ReactNode };

/** Ícone e cor da categoria. Aceita slug ('jogos-games') ou nome ('Jogos & Games'). */
function visual(v?: string | null): Visual {
  const c = acharCategoria(v);
  if (c) return { ...c.cor, d: D[c.icone] };
  // valores antigos/aproximados (ex.: 'ia', 'templates') — mantém o comportamento de antes
  const s = (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const legado = (k: IconeCategoria) => { const cat = CATEGORIAS.find((x) => x.icone === k)!; return { ...cat.cor, d: D[k] }; };
  if (s.includes('ia') && (s.includes('ferrament') || s === 'ia' || s.startsWith('ia-') || s.startsWith('ia '))) return legado('ia');
  if (s.includes('template') || s.includes('planilha')) return legado('templates');
  if (s.includes('design')) return legado('design');
  if (s.includes('automa')) return legado('automacoes');
  if (s.includes('marketing')) return legado('marketing');
  if (s.includes('curso') || s.includes('ebook')) return legado('cursos');
  return { ...COR_OUTROS, d: D.outros };
}

export function categoryColors(v?: string | null) { const c = visual(v); return { bg: c.bg, fg: c.fg }; }

export default function CategoryIcon({ cat, size = 22, color }: { cat?: string | null; size?: number; color?: string }) {
  const c = visual(cat);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || c.fg} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>{c.d}</svg>
  );
}

/** Capa de reserva quando o produto não tem imagem: fundo da categoria + ícone grande. */
export function CategoryCover({ cat, size = 56 }: { cat?: string | null; size?: number }) {
  const c = visual(cat);
  return (
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CategoryIcon cat={cat} size={size} />
    </span>
  );
}
