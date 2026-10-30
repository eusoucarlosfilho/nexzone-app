import Link from 'next/link';
import Contagem from '@/components/Contagem';
import type { Product } from '@/lib/types';
import { descontoDe } from '@/lib/crescimento';

// Card grande da oferta do dia (home e /oferta-do-dia): foto, desconto, preço, contagem até meia-noite e canais.
const brl = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function OfertaDoDiaCard({ p, fim, canais, titulo = 'Oferta do dia', h = 'h2' }: { p: Product; fim: number; canais: { whatsapp: string; telegram: string }; titulo?: string; h?: 'h1' | 'h2' }) {
  const d = descontoDe({ preco: Number(p.preco), preco_promo: p.preco_promo == null ? null : Number(p.preco_promo) });
  const por = p.preco_promo != null && Number(p.preco_promo) < Number(p.preco) ? Number(p.preco_promo) : Number(p.preco);
  const H = h;
  return (
    <div className="odd">
      <style dangerouslySetInnerHTML={{ __html: `
        .odd{display:grid;grid-template-columns:minmax(0,260px) 1fr;gap:22px;align-items:center;border-radius:22px;padding:18px;background:linear-gradient(135deg,#16162A,#2A1A3A);color:#fff}
        .odd-img{aspect-ratio:1/1;border-radius:16px;background:#2A2A40 center/cover;position:relative;display:block}
        .odd-off{position:absolute;top:10px;left:10px;background:#FF6B00;color:#16162A;font-family:Outfit;font-weight:900;border-radius:50px;padding:5px 11px;font-size:14px}
        .odd-tag{font-family:Outfit;font-weight:900;font-size:12.5px;letter-spacing:1.4px;text-transform:uppercase;color:#FF9A3C}
        .odd h2,.odd h1{font-family:Outfit;font-weight:900;font-size:clamp(20px,2.4vw,28px);line-height:1.15;margin:6px 0 10px;color:#fff}
        .odd-preco{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
        .odd-preco s{opacity:.6}
        .odd-preco b{font-family:Outfit;font-size:30px;color:#fff}
        .odd-tempo{margin:10px 0 14px;font-size:14px;opacity:.9}
        .odd-tempo span{font-family:Outfit;font-weight:900;color:#FF9A3C;font-size:18px;margin-left:6px}
        .odd-acoes{display:flex;gap:8px;flex-wrap:wrap}
        .odd-canal{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:50px;padding:8px 14px;font-weight:800;font-size:13.5px;text-decoration:none}
        @media(max-width:640px){.odd{grid-template-columns:1fr}.odd-img{max-height:260px;aspect-ratio:auto;height:220px}}
      ` }} />
      <Link href={`/produto/${p.id}`} className="odd-img" style={p.capa_url ? { backgroundImage: `url(${p.capa_url})` } : undefined} aria-label={p.titulo}>
        {d > 0 && <span className="odd-off">−{d}%</span>}
      </Link>
      <div>
        <span className="odd-tag">🔥 {titulo}</span>
        <H>{p.titulo}</H>
        <div className="odd-preco">{d > 0 && <s>{brl(Number(p.preco))}</s>}<b>{brl(por)}</b></div>
        <div className="odd-tempo">Termina em<Contagem alvo={fim} rotuloFim="amanhã tem outra" /></div>
        <div className="odd-acoes">
          <Link href={`/produto/${p.id}`} className="btn btn-pri">Ver oferta</Link>
          {canais.whatsapp && <a className="odd-canal" href={canais.whatsapp} target="_blank" rel="noopener noreferrer">Canal no WhatsApp</a>}
          {canais.telegram && <a className="odd-canal" href={canais.telegram} target="_blank" rel="noopener noreferrer">Canal no Telegram</a>}
        </div>
        {(canais.whatsapp || canais.telegram) && <small style={{ display: 'block', marginTop: 10, opacity: .7, fontSize: 12.5 }}>Entre no canal e receba a oferta do dia todo dia.</small>}
      </div>
    </div>
  );
}
