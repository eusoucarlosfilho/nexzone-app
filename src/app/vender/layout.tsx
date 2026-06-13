import Nav from '@/components/Nav';
import SellerSidebar from './SellerSidebar';
import SellerNotifier from './SellerNotifier';

export default function VenderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .sd-shell{display:flex;min-height:calc(100vh - 110px);max-width:1280px;margin:0 auto;}
        .sd-side{width:230px;flex-shrink:0;border-right:1px solid var(--border);padding:24px 14px;}
        .sd-shead{font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding:0 12px 10px;}
        .sd-nav{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;font-family:'Outfit';font-weight:600;font-size:14px;color:var(--sub);text-decoration:none;transition:.15s;margin-bottom:2px;}
        .sd-nav:hover{background:var(--surface);color:var(--text);}
        .sd-nav.on{background:var(--soft);color:var(--orange);}
        .sd-main{flex:1;padding:30px 36px;min-width:0;}
        .sd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:22px;}
        .sd-stat{background:#fff;border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:var(--sh);}
        .sd-stat .ic{width:40px;height:40px;border-radius:11px;background:var(--soft);color:var(--orange);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;}
        .sd-stat b{font-family:'Outfit';font-size:25px;font-weight:800;display:block;letter-spacing:-.5px;}
        .sd-stat small{color:var(--muted);font-size:12px;font-weight:700;}
        .sd-bars{display:flex;align-items:flex-end;gap:10px;height:150px;}
        .sd-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:flex-end;height:100%;}
        .sd-bar .b{width:100%;max-width:40px;background:var(--grad);border-radius:7px 7px 0 0;min-height:4px;}
        .sd-bar .l{font-size:11px;color:var(--muted);font-weight:700;}
        .sd-bar .v{font-size:11px;color:var(--text);font-weight:800;font-family:'Outfit';}
        .sd-meta{height:14px;border-radius:50px;background:var(--surface);overflow:hidden;border:1px solid var(--border);}
        .sd-meta .fill{height:100%;background:var(--grad);border-radius:50px;}
        @media(max-width:820px){.sd-shell{flex-direction:column;}.sd-side{width:100%;border-right:none;border-bottom:1px solid var(--border);display:flex;gap:4px;overflow-x:auto;padding:10px;}.sd-shead{display:none;}.sd-nav{white-space:nowrap;}.sd-main{padding:20px 16px;}}
      `}</style>
      <Nav />
      <SellerNotifier />
      <div className="sd-shell">
        <SellerSidebar />
        <div className="sd-main">{children}</div>
      </div>
    </>
  );
}
