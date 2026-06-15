'use client';
import { useState, useEffect, useRef, useTransition } from 'react';
import { enviarAvaliacao } from './actions';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

type Props = {
  orderId: string;
  initialStatus: string;
  pixCode: string | null;
  pixQr: string | null;
  conteudo: string | null;
  temArquivo?: boolean;
  jaAvaliou?: boolean;
  titulo: string;
  emoji: string;
  total: number;
  bumpTitulo?: string | null;
  bumpConteudo?: string | null;
  bumpTemArquivo?: boolean;
};

export default function OrderView(props: Props) {
  const [status, setStatus] = useState(props.initialStatus);
  const [conteudo, setConteudo] = useState(props.conteudo);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pago = status === 'pago' || status === 'entregue';

  const [avaliado, setAvaliado] = useState(!!props.jaAvaliou);
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [coment, setComent] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

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

  function enviar() {
    if (nota < 1) { setMsg('Escolha de 1 a 5 estrelas.'); return; }
    setMsg('');
    start(async () => {
      const r = await enviarAvaliacao(props.orderId, nota, coment);
      if (r.ok) setAvaliado(true);
      else setMsg(r.error || 'Erro ao enviar.');
    });
  }

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
        <div style={{ paddingTop: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', fontSize: 20 }}>✓ Pagamento confirmado!</div>
            <p className="muted" style={{ margin: '6px 0 14px' }}>Seu produto está liberado.</p>
            {props.temArquivo
              ? <a className="btn btn-pri" href={`/api/download?order=${props.orderId}`}>⬇ Baixar produto</a>
              : conteudo && String(conteudo).startsWith('http')
                ? <a className="btn btn-pri" href={conteudo} target="_blank" rel="noreferrer">Acessar produto</a>
                : conteudo
                  ? <div className="muted" style={{ fontSize: 13, wordBreak: 'break-word' }}>{conteudo}</div>
                  : <p className="muted" style={{ fontSize: 13 }}>O vendedor ainda não cadastrou o conteúdo de entrega deste produto.</p>}
          </div>

          {props.bumpTitulo && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18, textAlign: 'center' }}>
              <div className="slabel" style={{ color: 'var(--green)' }}>Item extra incluído</div>
              <strong style={{ fontFamily: 'Outfit', display: 'block', margin: '4px 0 10px' }}>➕ {props.bumpTitulo}</strong>
              {props.bumpTemArquivo
                ? <a className="btn btn-pri btn-sm" href={`/api/download?order=${props.orderId}&which=bump`}>⬇ Baixar item extra</a>
                : props.bumpConteudo && String(props.bumpConteudo).startsWith('http')
                  ? <a className="btn btn-pri btn-sm" href={props.bumpConteudo} target="_blank" rel="noreferrer">Acessar item extra</a>
                  : props.bumpConteudo
                    ? <div className="muted" style={{ fontSize: 13, wordBreak: 'break-word' }}>{props.bumpConteudo}</div>
                    : <p className="muted" style={{ fontSize: 13 }}>Conteúdo do item extra será disponibilizado pelo vendedor.</p>}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18 }}>
            {avaliado ? (
              <p style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontFamily: 'Outfit' }}>★ Obrigado pela sua avaliação!</p>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <strong style={{ fontFamily: 'Outfit', display: 'block', marginBottom: 10 }}>Avalie sua compra</strong>
                <div style={{ fontSize: 30, marginBottom: 10, cursor: 'pointer', userSelect: 'none' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} onClick={() => setNota(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                      style={{ color: (hover || nota) >= n ? '#FFB200' : '#D9D9E3', padding: '0 2px' }}>★</span>
                  ))}
                </div>
                <textarea value={coment} onChange={(e) => setComent(e.target.value)} rows={3}
                  placeholder="Conte como foi sua experiência (opcional)"
                  style={{ width: '100%', maxWidth: 420, marginBottom: 10 }} />
                <div>
                  <button className="btn btn-pri btn-sm" disabled={pending} onClick={enviar}>{pending ? 'Enviando…' : 'Enviar avaliação'}</button>
                </div>
                {msg && <p className="muted" style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{msg}</p>}
              </div>
            )}
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, color: 'var(--green, #00B87A)', fontWeight: 700, fontFamily: 'Outfit', fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green, #00B87A)', display: 'inline-block', animation: 'pulsePix 1.4s ease-in-out infinite' }} />
            Confirmamos seu pagamento automaticamente
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
            Transação 100% segura via Pix. Assim que o pagamento for identificado, a confirmação aparece aqui sozinha — não precisa enviar comprovante.
          </p>
          <style>{`@keyframes pulsePix{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}`}</style>
        </div>
      )}
    </div>
  );
}
