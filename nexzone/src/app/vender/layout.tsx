import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';
import SellerSidebar from './SellerSidebar';
import SellerNotifier from './SellerNotifier';
import SellerBell from '@/components/SellerBell';
import NotificacoesSino from '@/components/NotificacoesSino';

// PWA (preparação): manifest e modo "app" só nas páginas do painel do vendedor.
// Nenhum service worker é registrado nesta versão.
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Comprei Barato', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#FF6B00' };

export default function VenderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        body{background:var(--bg2);}
        .sd-shell{display:flex;min-height:calc(100vh - 160px);max-width:1360px;margin:0 auto;gap:0;}
        .sd-side{width:250px;flex-shrink:0;padding:22px 14px;position:sticky;top:150px;align-self:flex-start;display:flex;flex-direction:column;gap:3px;}
        .sd-shead{font-size:12px;font-weight:900;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding:0 14px 10px;}
        .sd-nav{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;font-weight:800;font-size:15px;color:#3A3A52;text-decoration:none;min-height:46px;transition:background .18s,color .18s,transform .18s var(--ease);}
        .sd-nav:hover{background:#fff;color:var(--text);transform:translateX(3px);}
        .sd-nav.on{background:var(--text);color:#fff;box-shadow:0 8px 20px rgba(22,22,42,.18);}
        .sd-cta{margin-top:14px;display:flex;flex-direction:column;gap:8px;padding:0 4px;}
        .sd-main{flex:1;padding:28px 30px 60px;min-width:0;}
        .sd-main h1{font-family:'Outfit';font-weight:900;letter-spacing:-1px;}
        .sd-main .card{border-color:#EDE6DF;border-radius:22px;}
        .sd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:22px;}
        .sd-stat{background:#fff;border:1px solid #EDE6DF;border-radius:20px;padding:20px;transition:transform .22s var(--ease),box-shadow .22s;animation:cb-up .55s var(--ease) both;}
        .sd-stat:nth-child(2){animation-delay:.06s}.sd-stat:nth-child(3){animation-delay:.12s}.sd-stat:nth-child(4){animation-delay:.18s}
        .sd-stat:hover{transform:translateY(-4px);box-shadow:0 18px 36px rgba(22,22,42,.08);}
        .sd-stat .ic{width:42px;height:42px;border-radius:13px;background:var(--soft);color:var(--orange-ink);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;}
        .sd-stat b{font-family:'Outfit';font-size:28px;font-weight:900;display:block;letter-spacing:-.8px;}
        .sd-stat small{color:var(--sub);font-size:13px;font-weight:800;}
        .sd-bars{display:flex;align-items:flex-end;gap:10px;height:180px;}
        .sd-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:flex-end;height:100%;}
        .sd-bar .b{width:100%;max-width:38px;background:#FFCBA1;border-radius:10px 10px 4px 4px;min-height:4px;transform-origin:bottom;animation:cb-grow .9s var(--ease) both;transition:background .2s;}
        .sd-bar:hover .b{background:var(--orange);}
        .sd-bar .l{font-size:12px;color:var(--muted);font-weight:800;}
        .sd-bar .v{font-size:12px;color:var(--text);font-weight:900;font-family:'Outfit';}
        .sd-meta{height:14px;border-radius:50px;background:var(--surface);overflow:hidden;border:1px solid var(--border);}
        .sd-meta .fill{height:100%;background:var(--orange);border-radius:50px;transform-origin:left;animation:cb-growx 1s var(--ease) both;}
        @media(max-width:860px){.sd-shell{flex-direction:column;}.sd-side{width:100%;position:static;flex-direction:row;overflow-x:auto;padding:10px 12px;gap:6px;}.sd-shead,.sd-cta{display:none;}.sd-nav{white-space:nowrap;}.sd-main{padding:20px 16px 50px;}}
      ` }} />
      <Nav />
      <SellerNotifier />
      <div className="sd-shell">
        <SellerSidebar />
        <div className="sd-main">
          <div className="sd-toolbar"><NotificacoesSino somenteFallback fallback={<SellerBell />} /></div>
          {children}
        </div>
      </div>
    </>
  );
}
