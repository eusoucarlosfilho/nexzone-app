'use client';
import { useEffect, useState } from 'react';

// Aviso discreto de compras recentes. Recebe SÓ pedidos reais dos últimos 7 dias
// (UF aproximada, título do produto e data). Nenhum nome, e-mail ou id de comprador.
type Venda = { uf: string | null; produto: string; em: string };

function haQuanto(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

export default function UltimasVendas({ vendas }: { vendas: Venda[] }) {
  const [i, setI] = useState(-1);      // -1 = escondido (nada é renderizado no servidor)
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (!vendas.length) return;
    let atual = 0;
    let t: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      setI(atual);
      t = setTimeout(() => {
        setI(-1);
        atual = (atual + 1) % vendas.length;
        t = setTimeout(mostrar, 14000);   // intervalo longo entre avisos: discreto
      }, 6000);                            // cada aviso fica 6 s
    };
    t = setTimeout(mostrar, 5000);         // primeiro aviso 5 s depois de abrir a página
    return () => clearTimeout(t);
  }, [vendas]);

  if (fechado || i < 0 || !vendas[i]) return null;
  const v = vendas[i];
  const quem = v.uf ? `Alguém de ${v.uf}` : 'Alguém';

  return (
    <div role="status" aria-live="polite" className="uv-toast">
      <style dangerouslySetInnerHTML={{ __html: `
        .uv-toast{position:fixed;left:16px;bottom:16px;z-index:60;max-width:min(340px,calc(100vw - 32px));display:flex;gap:10px;align-items:center;
          background:#fff;color:var(--text,#16161F);border:1px solid #EFE7DF;border-radius:14px;padding:10px 12px;
          box-shadow:0 10px 28px rgba(22,22,42,.12);font-size:13px;line-height:1.35;animation:uv-in .35s ease both}
        .uv-toast .ok{width:28px;height:28px;flex-shrink:0;border-radius:50%;background:#E7F5EC;display:flex;align-items:center;justify-content:center}
        .uv-toast b{font-weight:800}
        .uv-toast small{display:block;color:#8A8A9A;font-size:11.5px}
        .uv-toast button{background:none;border:none;color:#8A8A9A;font-size:18px;line-height:1;cursor:pointer;padding:0 0 0 4px;align-self:flex-start}
        @keyframes uv-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion: reduce){.uv-toast{animation:none}}
      ` }} />
      <span className="ok" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1FA463" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
      <span>
        {quem} comprou <b>{v.produto.length > 60 ? v.produto.slice(0, 57) + '…' : v.produto}</b>
        <small>{haQuanto(v.em)} · compra verificada</small>
      </span>
      <button aria-label="Fechar aviso" onClick={() => setFechado(true)}>×</button>
    </div>
  );
}
