'use client';
import { useState, useEffect, useRef, useTransition } from 'react';
import { enviarAvaliacao } from './actions';
import OrderChat from '@/components/OrderChat';
import ComplaintBox from './ComplaintBox';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';

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
  categoria?: string | null;
  capa_url?: string | null;
  total: number;
  bumpTitulo?: string | null;
  bumpConteudo?: string | null;
  bumpTemArquivo?: boolean;
  reclamacaoAberta?: boolean;
  cartaoDisponivel?: boolean;
  voltouDoCartao?: boolean;
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

  // Cartão (Stripe Checkout): o servidor cria a sessão e devolve a URL hospedada pela Stripe.
  const [cartaoBusy, setCartaoBusy] = useState(false);
  const [cartaoErro, setCartaoErro] = useState('');
  async function pagarComCartao() {
    setCartaoBusy(true); setCartaoErro('');
    try {
      const r = await fetch('/api/checkout/stripe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ orderId: props.orderId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      setCartaoErro(d.error || 'Não foi possível abrir o pagamento com cartão. Tente o Pix.');
    } catch {
      setCartaoErro('Falha de conexão. Tente novamente ou pague com Pix.');
    }
    setCartaoBusy(false);
  }

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
        <ProductThumb className="em" capa_url={props.capa_url} categoria={props.categoria} titulo={props.titulo} tamanho={46} raio={14} icone={22} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{props.titulo}</strong>
          <div className="muted">{money(props.total)}</div>
        </div>
      </div>

      {pago ? (
        <div style={{ paddingTop: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="checkCircle" size={22} /> Pagamento confirmado!</div>
            <p className="muted" style={{ margin: '6px 0 14px' }}>Seu produto está liberado.</p>
            {props.temArquivo
              ? <a className="btn btn-pri" href={`/api/download?order=${props.orderId}`}><Icon name="download" size={18} /> Baixar produto</a>
              : conteudo && String(conteudo).startsWith('http')
                ? <a className="btn btn-pri" href={conteudo} target="_blank" rel="noreferrer">Acessar produto</a>
                : conteudo
                  ? <div className="muted" style={{ fontSize: 13, wordBreak: 'break-word' }}>{conteudo}</div>
                  : <p className="muted" style={{ fontSize: 13 }}>O vendedor ainda não cadastrou o conteúdo de entrega deste produto.</p>}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <strong style={{ fontFamily: 'Outfit', fontSize: 15 }}>Conversa com o vendedor</strong>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
              Pagamento confirmado! Fale com o vendedor por aqui — é por esta conversa que ele entrega o produto e tira suas dúvidas. Você também pode pedir ajuda do suporte por aqui.
            </p>
            <OrderChat orderId={props.orderId} theme="light" />
            <ComplaintBox orderId={props.orderId} aberta={!!props.reclamacaoAberta} />
          </div>

          {props.bumpTitulo && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18, textAlign: 'center' }}>
              <div className="slabel" style={{ color: 'var(--green)' }}>Item extra incluído</div>
              <strong style={{ fontFamily: 'Outfit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '4px 0 10px' }}><Icon name="plusCircle" size={16} /> {props.bumpTitulo}</strong>
              {props.bumpTemArquivo
                ? <a className="btn btn-pri btn-sm" href={`/api/download?order=${props.orderId}&which=bump`}><Icon name="download" size={16} /> Baixar item extra</a>
                : props.bumpConteudo && String(props.bumpConteudo).startsWith('http')
                  ? <a className="btn btn-pri btn-sm" href={props.bumpConteudo} target="_blank" rel="noreferrer">Acessar item extra</a>
                  : props.bumpConteudo
                    ? <div className="muted" style={{ fontSize: 13, wordBreak: 'break-word' }}>{props.bumpConteudo}</div>
                    : <p className="muted" style={{ fontSize: 13 }}>Conteúdo do item extra será disponibilizado pelo vendedor.</p>}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18 }}>
            {avaliado ? (
              <p style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="star" size={16} style={{ fill: 'currentColor' }} /> Obrigado pela sua avaliação!</p>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <strong style={{ fontFamily: 'Outfit', display: 'block', marginBottom: 10 }}>Avalie sua compra</strong>
                <div style={{ marginBottom: 10, cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} onClick={() => setNota(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                      style={{ padding: '0 2px', display: 'inline-flex' }}><Icon name="star" size={30} color={(hover || nota) >= n ? '#FF9A3C' : '#D8CFC6'} style={(hover || nota) >= n ? { fill: '#FF9A3C' } : undefined} /></span>
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
          {props.voltouDoCartao && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 18, fontWeight: 800 }}>
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #FFD9BD', borderTopColor: 'var(--orange)', display: 'inline-block', animation: 'spinCartao .8s linear infinite' }} />
              Processando pagamento com cartão…
            </div>
          )}
          <div className="slabel" style={{ color: 'var(--orange-ink)' }}>Pague com Pix</div>
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
          {props.cartaoDisponivel && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 18 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Prefere cartão?</div>
              <button className="btn btn-dark" style={{ width: '100%', maxWidth: 360 }} onClick={pagarComCartao} disabled={cartaoBusy}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
                {cartaoBusy ? 'Abrindo pagamento seguro…' : 'Pagar com cartão de crédito'}
              </button>
              <p className="muted" style={{ fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="lock" size={13} /> Você será levado ao ambiente seguro da Stripe. Não guardamos dados do cartão.
              </p>
              {cartaoErro && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{cartaoErro}</p>}
            </div>
          )}
          <style>{`@keyframes pulsePix{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}@keyframes spinCartao{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  );
}
