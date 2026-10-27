'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';

type Oferta = {
  etapa: 'upsell' | 'downsell'; productId: string; titulo: string; capa: string | null; precoNormal: number; preco: number;
  chamada: string; texto: string; botao: string; expira: string | null;
};
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Oferta logo depois da compra (SQL 19). Aceitar = novo pedido com Pix pronto, sem preencher nada.
// Avisa o componente pai quando há oferta (para segurar o redirecionamento da página de obrigado).
export default function OfertaPosCompra({ orderId, pago, onTemOferta }: { orderId: string; pago: boolean; onTemOferta?: (v: boolean) => void }) {
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [busy, setBusy] = useState<'sim' | 'nao' | null>(null);
  const [resta, setResta] = useState<number | null>(null);
  const router = useRouter();

  async function carregar() {
    try {
      const r = await fetch(`/api/oferta-pos-compra?orderId=${orderId}`, { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      setOferta(d.oferta || null); onTemOferta?.(!!d.oferta);
    } catch { onTemOferta?.(false); }
  }
  useEffect(() => { if (pago) carregar(); else onTemOferta?.(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pago, orderId]);

  useEffect(() => {
    if (!oferta?.expira) { setResta(null); return; }
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(oferta.expira!).getTime() - Date.now()) / 1000));
      setResta(s);
      if (s === 0) { setOferta(null); onTemOferta?.(false); }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oferta?.expira]);

  async function responder(aceitar: boolean) {
    setBusy(aceitar ? 'sim' : 'nao');
    try {
      const r = await fetch('/api/oferta-pos-compra', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, aceitar }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível agora.', 'error'); setOferta(null); onTemOferta?.(false); return; }
      if (aceitar && d.novoPedido) { router.push(`/pedido/${d.novoPedido}`); return; }
      setOferta(null);
      await carregar(); // recusou o 1º: pode haver a segunda oferta
    } finally { setBusy(null); }
  }

  if (!oferta) return null;
  const desc = oferta.precoNormal > oferta.preco ? Math.round((1 - oferta.preco / oferta.precoNormal) * 100) : 0;
  const mm = resta !== null ? String(Math.floor(resta / 60)).padStart(2, '0') : '';
  const ss = resta !== null ? String(resta % 60).padStart(2, '0') : '';
  return (
    <div className="opc" role="region" aria-label="Oferta especial">
      <style dangerouslySetInnerHTML={{ __html: `
        .opc{border:2px solid var(--orange);border-radius:20px;background:linear-gradient(160deg,#FFF5EC,#fff 55%);padding:18px;margin-bottom:14px;box-shadow:0 14px 34px rgba(255,107,0,.14);animation:cb-up .45s var(--ease) both}
        .opc-top{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
        .opc-tag{background:var(--orange);color:#fff;font-weight:900;font-size:12px;border-radius:50px;padding:4px 12px;letter-spacing:.3px}
        .opc-rel{font-family:'Outfit';font-weight:900;font-size:15px;color:var(--orange-ink);display:flex;gap:6px;align-items:center}
        .opc h2{font-family:'Outfit';font-size:21px;font-weight:900;letter-spacing:-.4px;margin:0 0 10px;line-height:1.2}
        .opc-prod{display:flex;gap:12px;align-items:center;margin-bottom:10px}
        .opc-prod img{width:64px;height:64px;border-radius:14px;object-fit:cover;flex:none}
        .opc-prod b{display:block;font-size:15px}
        .opc-preco{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
        .opc-preco s{color:var(--muted);font-size:14px}
        .opc-preco strong{font-family:'Outfit';font-size:24px;font-weight:900;color:var(--green)}
        .opc-preco em{font-style:normal;background:var(--green-bg);color:var(--green);font-weight:900;font-size:12px;border-radius:50px;padding:2px 8px}
        .opc p{margin:0 0 12px;font-size:14.5px;color:#3A3A52;white-space:pre-wrap}
        .opc-sim{width:100%;background:var(--green);color:#fff;font-size:16px;min-height:52px}
        .opc-sim:hover{filter:brightness(1.06)}
        .opc-nao{display:block;margin:10px auto 0;background:none;border:0;color:var(--sub);text-decoration:underline;font-size:13px;cursor:pointer}
        .opc-nota{text-align:center;font-size:12px;color:var(--sub);margin-top:8px;display:flex;gap:6px;justify-content:center;align-items:center}
      ` }} />
      <div className="opc-top">
        <span className="opc-tag">{oferta.etapa === 'upsell' ? 'OFERTA EXCLUSIVA' : 'ÚLTIMA CHANCE'}</span>
        {resta !== null && <span className="opc-rel" aria-live="off"><Icon name="clock" size={16} /> {mm}:{ss}</span>}
      </div>
      <h2>{oferta.chamada}</h2>
      <div className="opc-prod">
        {oferta.capa && <img src={oferta.capa} alt="" />}
        <div>
          <b>{oferta.titulo}</b>
          <div className="opc-preco">
            {desc > 0 && <s>{money(oferta.precoNormal)}</s>}
            <strong>{money(oferta.preco)}</strong>
            {desc >= 5 && <em>{desc}% OFF</em>}
          </div>
        </div>
      </div>
      {oferta.texto && <p>{oferta.texto}</p>}
      <button type="button" className="btn opc-sim" disabled={!!busy} onClick={() => responder(true)}>
        {busy === 'sim' ? 'Preparando seu pedido…' : <><Icon name="check" size={18} /> {oferta.botao} — {money(oferta.preco)}</>}
      </button>
      <div className="opc-nota"><Icon name="lock" size={13} /> Sem preencher nada de novo: o pagamento (Pix ou cartão) abre na próxima tela.</div>
      <button type="button" className="opc-nao" disabled={!!busy} onClick={() => responder(false)}>{busy === 'nao' ? '…' : 'Não, obrigado'}</button>
    </div>
  );
}
