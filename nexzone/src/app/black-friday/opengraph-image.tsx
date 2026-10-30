import { ImageResponse } from 'next/og';
import { cfgBF } from '@/lib/crescimento-servidor';
import { BF_PADRAO } from '@/lib/crescimento';

// Imagem que aparece quando o link /black-friday é compartilhado (WhatsApp, Instagram, Facebook).
export const alt = 'Black Friday Gamer · Comprei Barato';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

const dia = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

export default async function Imagem() {
  const cfg = await cfgBF().catch(() => BF_PADRAO);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#000', color: '#fff', padding: '64px 72px', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -120, top: -160, width: 620, height: 620, borderRadius: 620, background: 'radial-gradient(circle, rgba(255,107,0,0.55), rgba(255,107,0,0) 70%)', display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', background: '#FF6B00', color: '#000', fontSize: 26, fontWeight: 900, padding: '8px 20px', borderRadius: 999, letterSpacing: 2 }}>BLACK NOVEMBER</div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, color: '#FF9A3C' }}>{dia(cfg.inicio)} a {dia(cfg.fim)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 128, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4 }}>BLACK FRIDAY</div>
          <div style={{ display: 'flex', fontSize: 128, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4, color: '#FF6B00' }}>GAMER</div>
          <div style={{ display: 'flex', fontSize: 34, marginTop: 22, color: '#D6D6E0' }}>Contas, skins, moedas e gift cards com no mínimo {cfg.descontoMin}% OFF de verdade</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, fontWeight: 800 }}>
          <div style={{ display: 'flex' }}>Comprei <span style={{ color: '#FF6B00', marginLeft: 10 }}>Barato</span></div>
          <div style={{ display: 'flex', color: '#A9A9BA' }}>compreibarato.com.br/black-friday</div>
        </div>
      </div>
    ),
    size,
  );
}
