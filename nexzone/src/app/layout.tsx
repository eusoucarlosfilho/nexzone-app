import type { Metadata, Viewport } from 'next';
import './globals.css';
import Toaster from '@/components/Toaster';
import BuyerNotifier from '@/components/BuyerNotifier';
import SiteTracker from '@/components/SiteTracker';
import OrigemCadastro from '@/components/OrigemCadastro';
import NoticeBanner from '@/components/NoticeBanner';
import { FavoritesProvider } from '@/lib/favorites';
import { RegistrarApp } from '@/components/AppInstalavel';
import { MARCA, SITE, OG_PADRAO } from '@/lib/seoSite';
import { lerSeoConfig } from '@/lib/seo-servidor';

// SEO global: endereço base, nome da marca, imagem padrão de compartilhamento e verificação do Google/Bing
// (os códigos são colados pelo admin em Admin → SEO e Google).
export async function generateMetadata(): Promise<Metadata> {
  const cfg = await lerSeoConfig().catch(() => null);
  const titulo = `${MARCA} | Marketplace de contas, itens e gift cards de jogos`;
  const descricao = 'Compre e venda contas, skins, moedas, gift cards, keys e serviços de jogos, além de produtos digitais. Pix ou cartão e dinheiro protegido até a entrega.';
  return {
    metadataBase: new URL(SITE),
    title: titulo,
    description: descricao,
    applicationName: MARCA,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: MARCA, statusBarStyle: 'default' },
    icons: { apple: '/pwa/apple-touch-icon.png' },
    openGraph: { type: 'website', locale: 'pt_BR', siteName: MARCA, title: titulo, description: descricao, images: [{ url: OG_PADRAO, width: 1200, height: 630, alt: MARCA }] },
    twitter: { card: 'summary_large_image', title: titulo, description: descricao, images: [OG_PADRAO] },
    formatDetection: { telephone: false },
    verification: {
      ...(cfg?.google ? { google: cfg.google } : {}),
      ...(cfg?.bing ? { other: { 'msvalidate.01': cfg.bing } } : {}),
    },
  };
}
export const viewport: Viewport = { themeColor: '#FF6B00' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><FavoritesProvider><NoticeBanner />{children}</FavoritesProvider><Toaster /><BuyerNotifier /><SiteTracker /><OrigemCadastro /><RegistrarApp /></body>
    </html>
  );
}
