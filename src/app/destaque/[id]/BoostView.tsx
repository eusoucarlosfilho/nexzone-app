'use client';
import { useState, useEffect, useRef } from 'react';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function BoostView(props: any) {
  const [status, setStatus] = useState(props.initialStatus);
  const [expira, setExpira] = useState(props.expira);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pago = status === 'pago';

  useEffect(() => {
    if (pago) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/boost-status?id=${props.boostId}`, { credentials: 'include' });
        const d = await r.json();
        if (d.status === 'pago') { if (pollRef.current) clearInterval(pollRef.current); setStatus('pago'); setExpira(d.expira_em); }
      } catch {}
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pago, props.boostId]);

  return (
    <div className="card">
      <div className="li" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="em">🚀</div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>Destaque — {props.dias} dias</strong>
          <div className="muted">{props.emoji} {props.titulo} · {money(props.valor)}</div>
        </div>
      </div>

      {pago ? (
        <div style={{ textAlign: 'center', paddingTop: 18 }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', fontSize: 20 }}>⭐ Destaque ativado!</div>
          <p className="muted" style={{ margin: '8px 0 14px' }}>
            Seu produto está em destaque{expira ? ` até ${new Date(expira).toLocaleDateString('pt-BR')}` : ''}. Ele já aparece no carrossel da página inicial.
          </p>
          <a className="btn btn-pri" href="/vender/produtos">Voltar aos meus produtos</a>
        </div>
      ) : (
        <div style={{ textAlign: 'center', paddingTop: 18 }}>
          <div className="slabel" style={{ color: 'var(--orange)' }}>Pague com Pix para ativar o destaque</div>
          {props.pixQr && <img alt="QR Pix" src={`data:image/png;base64,${props.pixQr}`} style={{ width: 200, height: 200 }} />}
          {props.pixCode && (
            <>
              <div className="muted" style={{ wordBreak: 'break-all', fontSize: 12, margin: '8px 0' }}>{props.pixCode}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(props.pixCode)}>Copiar código Pix</button>
            </>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Aguardando confirmação… A tela atualiza sozinha quando o pagamento cair.</p>
        </div>
      )}
    </div>
  );
}
