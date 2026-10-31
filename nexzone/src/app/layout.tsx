import type { Metadata, Viewport } from 'next';
import './globals.css';
import Toaster from '@/components/Toaster';
import BuyerNotifier from '@/components/BuyerNotifier';
import SiteTracker from '@/components/SiteTracker';
import OrigemCadastro from '@/components/OrigemCadastro';
import VincularIndicacao from '@/components/VincularIndicacao';
import NoticeBanner from '@/components/NoticeBanner';
import { FavoritesProvider } from '@/lib/favorites';
import { RegistrarApp } from '@/components/AppInstalavel';
import { MARCA, SITE, OG_PADRAO } from '@/lib/seoSite';
import { lerSeoConfig } from '@/lib/seo-servidor';
import FaixaBlack from '@/components/FaixaBlack';
import { lerTemaBlack } from '@/lib/crescimento-servidor';
import { FaixaCampanha } from '@/components/CampanhaSite';
import { campanhaNoAr } from '@/lib/campanhasSite-servidor';

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
// viewportFit 'cover': libera env(safe-area-inset-bottom) para nada ficar atrás da barra do Safari/iPhone
// Tema Black ligado: barra do navegador do celular fica preta.
export async function generateViewport(): Promise<Viewport> {
  const tema = await lerTemaBlack();
  return { themeColor: tema.ativo ? '#000000' : '#FF6B00', viewportFit: 'cover' };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = await lerTemaBlack();
  const alvo = Date.parse(tema.fase === 'black' ? tema.cfg.fim : tema.cfg.inicio);
  // Faixa de campanha (Admin › Campanhas e ofertas): só quando a Black não está no ar (a Black tem prioridade)
  const faixa = tema.ativo ? null : await campanhaNoAr('faixa');
  return (
    <html lang="pt-BR" data-tema={tema.ativo ? 'black' : undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><FavoritesProvider><NoticeBanner />{tema.ativo && tema.fase && <FaixaBlack fase={tema.fase} alvo={alvo} />}{faixa && <FaixaCampanha c={faixa} />}{children}</FavoritesProvider><Toaster /><BuyerNotifier /><SiteTracker /><OrigemCadastro /><VincularIndicacao /><RegistrarApp /></body>
    </html>
  );
}
