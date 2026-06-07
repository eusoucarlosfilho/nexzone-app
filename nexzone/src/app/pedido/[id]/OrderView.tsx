'use client';
import { useState, useEffect, useRef } from 'react';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

type Props = {
  orderId: string;
  initialStatus: string;
  pixCode: string | null;
  pixQr: string | null;
  conteudo: string | null;
  titulo: string;
  emoji: string;
  total: number;
};

export default function OrderView(props: Props) {
  const [status, setStatus] = useState(props.initialStatus);
  const [conteudo, setConteudo] = useState(props.conteudo);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pago = status === 'pago' || status === 'entregue';

  useEffect(() => {
    if (pago) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/order-status?id=${props.orderId}`, { credentials: 'include' });
        const d = await r.json();
        if (d.status === 'pago' || d.status === 'entregue') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus(d.status);
          setConteudo(d.conteudo ?? null);
        }
      } catch {}
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pago, props.orderId]);

  return (
    <div className="card">
      <div className="li" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="em">{props.emoji}</div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{props.titulo}</strong>
          <div className="muted">{money(props.total)}</div>
        </div>
      </div>

      {pago ? (
        <div style={{ textAlign: 'center', paddingTop: 18 }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', fontSize: 20 }}>✓ Pagamento confirmado!</div>
          <p className="muted" style={{ margin: '6px 0 14px' }}>Seu produto está liberado.</p>
          {conteudo && String(conteudo).startsWith('http')
            ? <a className="btn btn-pri" href={conteudo} target="_blank" rel="noreferrer">Acessar produto</a>
            : conteudo
              ? <div className="muted" style={{ fontSize: 13, wordBreak: 'break-word' }}>{conteudo}</div>
              : <p className="muted" style={{ fontSize: 13 }}>O vendedor ainda não cadastrou o conteúdo de entrega deste produto.</p>}
        </div>
      ) : (
        <div style={{ textAlign: 'center', paddingTop: 18 }}>
          <div className="slabel" style={{ color: 'var(--orange)' }}>Pague com Pix</div>
          {props.pixQr && <img alt="QR Pix" src={`data:image/png;base64,${props.pixQr}`} style={{ width: 200, height: 200 }} />}
          {props.pixCode && (
            <>
              <div className="muted" style={{ wordBreak: 'break-all', fontSize: 12, margin: '8px 0' }}>{props.pixCode}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(props.pixCode!)}>Copiar código Pix</button>
            </>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Aguardando confirmação… A tela atualiza sozinha quando o pagamento cair.</p>
        </div>
      )}
    </div>
  );
}
