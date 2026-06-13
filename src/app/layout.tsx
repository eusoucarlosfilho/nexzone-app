import type { Metadata } from 'next';
import './globals.css';
import Toaster from '@/components/Toaster';
import { FavoritesProvider } from '@/lib/favorites';

export const metadata: Metadata = {
  title: 'Comprei Barato — Marketplace de Produtos Digitais',
  description: 'Compre e venda produtos digitais com entrega imediata e segurança.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><FavoritesProvider>{children}</FavoritesProvider><Toaster /></body>
    </html>
  );
}
