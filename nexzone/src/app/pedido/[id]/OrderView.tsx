'use client';
import { useState, useEffect, useRef, useTransition } from 'react';
import TextoFormatado from '@/components/TextoFormatado';
import { ehSoLink } from '@/lib/textoFormatado';
import { enviarAvaliacao } from './actions';
import OrderChat from '@/components/OrderChat';
import ComplaintBox from './ComplaintBox';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';
import type { ExtraPedido } from '@/lib/extrasPedido';
import PosCompra from './PosCompra';
import type { RastreioProduto } from '@/lib/rastreioVenda';
import Link from 'next/link';
import GarantiaReembolso, { type GarantiaInfo } from './GarantiaReembolso';
import OfertaPosCompra from './OfertaPosCompra';
import { LinhaDoTempo, PromessaEntrega, ProtecaoCompra, type EntregaCheckout } from '@/components/ConfiancaCheckout';
import type { EtapaPedido } from '@/lib/confianca';
import { whatsappLegivel } from '@/lib/confianca';

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
  taxaPix?: number;                  // taxa de serviço do Pix (já somada no código Pix)
  taxaCartao?: number;               // taxa de serviço do cartão (somada ao abrir a Stripe)
  extras?: ExtraPedido[];
  reclamacaoAberta?: boolean;
  cartaoDisponivel?: boolean;
  voltouDoCartao?: boolean;
  produtoId?: string;
  rastreio?: RastreioProduto | null;   // pixels e página de obrigado do vendedor (Sprint 1)
  senhaPendente?: boolean;             // conta criada no checkout sem senha
  cursos?: { id: string; titulo: string }[]; // área de membros liberada por esta compra (SQL 18)
  garantia?: GarantiaInfo | null;            // garantia e reembolso pelo site (SQL 18)
  entrega?: EntregaCheckout | null;          // prazo prometido (na hora ou pelo vendedor no chat)
  etapas?: EtapaPedido[];                    // linha do tempo do pedido
  suporteWhatsapp?: string | null;           // WhatsApp do suporte (Admin › Configurações)
};

// Ajusta a linha do tempo ao que acontece na tela: pagamento que acabou de cair (polling) e
// entrega feita pelo vendedor no chat (o sistema não sabe quando ele entregou, então não marca como feita).
function etapasVisiveis(etapas: EtapaPedido[], pago: boolean, manual: boolean): EtapaPedido[] {
  let l = etapas.map((e) => ({ ...e }));
  if (pago && !l[1].feito) l = l.map((e, i) => (i === 1 ? { ...e, rotulo: 'Pagamento confirmado', feito: true, atual: false } : i === 2 ? { ...e, atual: true } : e));
  if (pago && manual) {
    l[2] = { ...l[2], rotulo: 'Entrega no chat', feito: false, atual: true, quando: null };
    l[3] = { ...l[3], atual: false };
  }
  return l;
}

export default function OrderView(props: Props) {
  const [status, setStatus] = useState(props.initialStatus);
  const [conteudo, setConteudo] = useState(props.conteudo);
  const [extras, setExtras] = useState<ExtraPedido[]>(props.extras || []);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pago = status === 'pago' || status === 'entregue';
  const [temOferta, setTemOferta] = useState<boolean | null>(null); // oferta pós-compra (SQL 19)

  const [avaliado, setAvaliado] = useState(!!props.jaAvaliou);
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [coment, setComent] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const [copiado, setCopiado] = useState(false);
  async function copiarPix() {
    try { await navigator.clipboard.writeText(props.pixCode || ''); }
    catch {
      // navegador sem permissão: seleciona o texto para copiar manualmente
      const el = document.getElementById('ov-pix-code'); if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  }

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
          if (Array.isArray(d.extras)) setExtras(d.extras);
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
    <>
    <OfertaPosCompra orderId={props.orderId} pago={pago} onTemOferta={setTemOferta} />
    <div className="card">
      <div className="li" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)' }}>
        <ProductThumb className="em" capa_url={props.capa_url} categoria={props.categoria} titulo={props.titulo} tamanho={46} raio={14} icone={22} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{props.titulo}</strong>
          <div className="muted">{money(props.total)}</div>
        </div>
        {(pago || status === 'reembolsado') && (
          <Link href={`/pedido/${props.orderId}/comprovante`} className="btn btn-ghost btn-sm" style={{ flex: 'none' }}><Icon name="receipt" size={15} /> Comprovante</Link>
        )}
      </div>

      {props.etapas && status !== 'reembolsado' && status !== 'cancelado' && (
        <LinhaDoTempo etapas={etapasVisiveis(props.etapas, pago, !!props.entrega?.manual)} />
      )}
      {pago ? (
        <div style={{ paddingTop: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--green)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="checkCircle" size={22} /> Pagamento confirmado!</div>
            <p className="muted" style={{ margin: '6px 0 14px' }}>{props.entrega?.manual ? 'O vendedor já foi avisado e entrega pelo chat abaixo.' : 'Seu produto está liberado.'}</p>
            {props.entrega?.manual && <div style={{ textAlign: 'left', marginBottom: 14 }}><PromessaEntrega e={props.entrega} /></div>}
            {(props.cursos ?? []).length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                {(props.cursos ?? []).map((c, i) => (
                  <Link key={c.id} href={`/curso/${c.id}`} className={`btn ${i === 0 ? 'btn-pri' : 'btn-ghost'}`} style={{ width: '100%' }}>
                    <Icon name="play" size={18} /> {(props.cursos ?? []).length > 1 ? `Acessar: ${c.titulo}` : 'Acessar a área de membros'}
                  </Link>
                ))}
              </div>
            )}
            {props.temArquivo
              ? <a className="btn btn-pri" href={`/api/download?order=${props.orderId}`}><Icon name="download" size={18} /> Baixar produto</a>
              : conteudo && ehSoLink(conteudo)
                ? <a className="btn btn-pri" href={String(conteudo).trim()} target="_blank" rel="noopener noreferrer">Acessar produto</a>
                : !conteudo && !props.entrega?.manual && <p className="muted" style={{ fontSize: 13 }}>O vendedor ainda não cadastrou o conteúdo de entrega deste produto.</p>}
            {/* Mensagem pós-compra do vendedor, com a formatação (negrito, listas, links) */}
            {conteudo && !ehSoLink(conteudo) && (
              <div style={{ textAlign: 'left', marginTop: props.temArquivo ? 16 : 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', fontSize: 14.5 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--orange-ink)', marginBottom: 6 }}>Mensagem do vendedor</div>
                <TextoFormatado texto={String(conteudo)} corLink="#B84A00" />
              </div>
            )}
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

          {props.garantia && <GarantiaReembolso orderId={props.orderId} g={props.garantia} />}

          {extras.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18, textAlign: 'center' }}>
              <div className="slabel" style={{ color: 'var(--green)' }}>{extras.length === 1 ? 'Item extra incluído' : `${extras.length} itens extras incluídos`}</div>
              {extras.map((x) => (
                <div key={x.i} style={{ padding: '10px 0', borderBottom: x.i < extras.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                  <strong style={{ fontFamily: 'Outfit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '4px 0 10px' }}><Icon name="plusCircle" size={16} /> {x.titulo}</strong>
                  {x.temArquivo
                    ? <a className="btn btn-pri btn-sm" href={`/api/download?order=${props.orderId}&which=bump&i=${x.i}`}><Icon name="download" size={16} /> Baixar item extra</a>
                    : x.conteudo && ehSoLink(x.conteudo)
                      ? <a className="btn btn-pri btn-sm" href={String(x.conteudo).trim()} target="_blank" rel="noopener noreferrer">Acessar item extra</a>
                      : x.conteudo
                        ? <div style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', fontSize: 14 }}><TextoFormatado texto={x.conteudo} corLink="#B84A00" /></div>
                        : <p className="muted" style={{ fontSize: 13 }}>Conteúdo do item extra será disponibilizado pelo vendedor.</p>}
                </div>
              ))}
            </div>
          )}

          <div id="avaliar" style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18, scrollMarginTop: 80 }}>
            {avaliado ? (
              <p style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="star" size={16} style={{ fill: 'currentColor' }} /> Obrigado pela sua avaliação!</p>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <strong style={{ fontFamily: 'Outfit', display: 'block', marginBottom: 4 }}>Avalie sua compra</strong>
                <p className="muted" style={{ fontSize: 12.5, margin: '0 auto 10px', maxWidth: 360 }}>Sua avaliação aparece no anúncio como &quot;Comprador verificado&quot; e ajuda outros gamers a comprar com segurança.</p>
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
      ) : status === 'reembolsado' || status === 'cancelado' ? (
        <div style={{ textAlign: 'center', paddingTop: 18 }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name={status === 'reembolsado' ? 'undo' : 'x'} size={20} /> {status === 'reembolsado' ? 'Pedido reembolsado' : 'Pedido cancelado'}
          </div>
          <p className="muted" style={{ margin: '6px auto 0', maxWidth: 380, fontSize: 14 }}>
            {status === 'reembolsado' ? 'O valor volta pela mesma forma de pagamento (Pix: na conta de origem; cartão: em até 2 faturas). O acesso ao produto foi encerrado.' : 'Este pedido não foi pago. Se ainda quiser o produto, faça uma nova compra.'}
          </p>
          {props.garantia && props.garantia.pedidos.length > 0 && <GarantiaReembolso orderId={props.orderId} g={{ ...props.garantia, pode: false }} />}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 16, textAlign: 'left' }}>
            <OrderChat orderId={props.orderId} theme="light" />
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
          <div className="ov-valor">
            <b>{money(props.total + (props.taxaPix || 0))}</b>
            {(props.taxaPix || 0) > 0 && <small>{money(props.total)} + {money(props.taxaPix || 0)} de taxa de serviço</small>}
          </div>
          {props.pixQr && <img alt="QR Pix" src={`data:image/png;base64,${props.pixQr}`} style={{ width: 200, height: 200 }} />}
          {props.pixCode && (
            <>
              <button className="btn btn-pri" style={{ width: '100%', maxWidth: 360, minHeight: 52, fontSize: 16, margin: '6px auto 0', display: 'flex' }} onClick={copiarPix} aria-live="polite">
                <Icon name={copiado ? 'check' : 'copy'} size={18} /> {copiado ? 'Código copiado!' : 'Copiar código Pix'}
              </button>
              <div id="ov-pix-code" className="muted" style={{ wordBreak: 'break-all', fontSize: 11.5, margin: '10px auto 0', maxWidth: 360, maxHeight: 54, overflow: 'auto', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 10, padding: '8px 10px', userSelect: 'all' }}>{props.pixCode}</div>
              <ol className="ov-como">
                <li><b>1</b><span>Abra o app do seu banco e escolha <b>Pix › Copia e cola</b></span></li>
                <li><b>2</b><span>Cole o código e confira o valor de {money(props.total + (props.taxaPix || 0))}</span></li>
                <li><b>3</b><span>Pronto: a confirmação aparece aqui sozinha e chega no seu WhatsApp</span></li>
              </ol>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, color: 'var(--green, #00B87A)', fontWeight: 700, fontFamily: 'Outfit', fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green, #00B87A)', display: 'inline-block', animation: 'pulsePix 1.4s ease-in-out infinite' }} />
            Aguardando o pagamento · confirmação automática
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
            Não precisa enviar comprovante. Pode fechar esta página: o pedido fica salvo em Minhas compras.
          </p>
          <div style={{ textAlign: 'left' }}>
            <ProtecaoCompra garantiaDias={props.garantia?.dias || 7} manual={!!props.entrega?.manual} />
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
            Dúvida antes de pagar?{' '}
            {props.suporteWhatsapp
              ? <a href={`https://wa.me/${props.suporteWhatsapp}?text=${encodeURIComponent('Oi! Tenho uma dúvida sobre o pedido ' + props.orderId.slice(0, 8))}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 800 }}>Chame o suporte no WhatsApp {whatsappLegivel(props.suporteWhatsapp)}</a>
              : <Link href="/suporte" style={{ color: 'var(--orange-ink)', fontWeight: 800 }}>Fale com o suporte</Link>}
          </p>
          {props.cartaoDisponivel && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 18 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Prefere cartão?</div>
              <button className="btn btn-dark" style={{ width: '100%', maxWidth: 360 }} onClick={pagarComCartao} disabled={cartaoBusy}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
                {cartaoBusy ? 'Abrindo pagamento seguro…' : `Pagar ${money(props.total + (props.taxaCartao || 0))} com cartão`}
              </button>
              {(props.taxaCartao || 0) > 0 && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Inclui {money(props.taxaCartao || 0)} de taxa de serviço do cartão.</p>}
              <p className="muted" style={{ fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="lock" size={13} /> Você será levado ao ambiente seguro da Stripe. Não guardamos dados do cartão.
              </p>
              {cartaoErro && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{cartaoErro}</p>}
            </div>
          )}
          <style dangerouslySetInnerHTML={{ __html: `@keyframes pulsePix{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}@keyframes spinCartao{to{transform:rotate(360deg)}}.ov-como{list-style:none;padding:0;margin:14px auto 0;max-width:360px;display:grid;gap:8px;text-align:left;font-size:13px;color:var(--sub)}.ov-como li{display:flex;gap:10px;align-items:flex-start;line-height:1.45}.ov-como li>b:first-child{width:22px;height:22px;border-radius:50%;flex:none;background:var(--soft);color:var(--orange-ink);font-family:Outfit;display:flex;align-items:center;justify-content:center;font-size:12px}.ov-valor{margin:4px 0 12px}.ov-valor b{display:block;font-family:Outfit;font-size:26px;font-weight:900}.ov-valor small{color:var(--muted);font-size:12.5px;font-weight:700}` }} />
        </div>
      )}
    </div>
    <PosCompra pago={pago} orderId={props.orderId} produtoId={props.produtoId || ''} titulo={props.titulo} valor={props.total}
      rastreio={props.rastreio ?? null} senhaPendente={!!props.senhaPendente} segurar={temOferta !== false} />
    </>
  );
}
