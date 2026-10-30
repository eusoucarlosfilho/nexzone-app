'use client';
import { useEffect, useRef, useState } from 'react';
import IdentificacaoComprador, { type DadosComprador } from './IdentificacaoComprador';
import { usePixels, dispararPixel, coletarOrigem, coletarCliques } from '@/components/PixelsVenda';
import type { RastreioProduto } from '@/lib/rastreioVenda';
import BumpOferta from '@/components/BumpOferta';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';
import { CartaoVendedor, PromessaEntrega, ProtecaoCompra, type VendedorCheckout, type EntregaCheckout } from '@/components/ConfiancaCheckout';
import { taxaComprador, type ConfigTaxas } from '@/lib/taxas';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

// Valor mínimo que a Stripe aceita em BRL (o servidor confere de novo em /api/checkout/stripe).
const CARTAO_MIN_BRL = 0.5;

// Opção de forma de pagamento (radio visual).
function OpcaoPagamento({ selecionada, onSelect, accent, icone, titulo, subtitulo }: {
  selecionada: boolean; onSelect: () => void; accent: string; icone: React.ReactNode; titulo: string; subtitulo: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={selecionada}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px', cursor: 'pointer',
        border: `2px solid ${selecionada ? accent : 'var(--border)'}`, borderRadius: 12,
        background: selecionada ? 'var(--soft)' : '#fff', transition: 'border-color .15s, background .15s',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icone}
      </div>
      <div style={{ flex: 1 }}>
        <strong style={{ fontFamily: 'Outfit', fontSize: 15 }}>{titulo}</strong>
        <div className="muted" style={{ fontSize: 12 }}>{subtitulo}</div>
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff', flexShrink: 0,
        border: selecionada ? `6px solid ${accent}` : '2px solid var(--border)',
      }} />
    </div>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active?: boolean; done?: boolean }) {
  const bg = done ? 'var(--green, #00B87A)' : active ? 'var(--orange, #FF6B00)' : '#E4E4ED';
  const col = done || active ? '#fff' : '#9A9AAE';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit', fontWeight: 800, fontSize: 14 }}>
        {done ? <Icon name="check" size={16} strokeWidth={3} /> : n}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--text)' : 'var(--muted)', fontFamily: 'Outfit' }}>{label}</span>
    </div>
  );
}

export default function CheckoutClient({ productId, titulo, emoji, categoria, capa_url, loja, preco, cor, bumps = [], aceitaCupom, meusPontos = 0, perBrl = 100, cartaoDisponivel = false, convidado: convidadoInicial = false, emailLogado = null, rastreio = null, taxas = null, vendedor = null, entrega = null, garantiaDias = 7, promo = null, cashback = null }: any) {
  // Campanhas (SQL 28): promo = { ativo, cartao, primeira: true | false | null (convidado: ainda não sabemos) }; cashback = { pct, pontosPorReal }
  const v = vendedor as VendedorCheckout | null;
  const ent = entrega as EntregaCheckout | null;
  // Checkout sem login (Sprint 1): quem não está logado preenche nome, e-mail e WhatsApp aqui mesmo
  const [convidado, setConvidado] = useState<boolean>(!!convidadoInicial);
  const [modoId, setModoId] = useState<'form' | 'existe'>('form');
  const [dados, setDados] = useState<DadosComprador>({ nome: '', email: '', whatsapp: '', avisosWhatsapp: true, site: '' });
  const [errosId, setErrosId] = useState<Partial<Record<'nome' | 'email' | 'whatsapp', string>>>({});
  // Pixels do vendedor (Meta/TikTok/Google): carrega e marca o início do checkout
  usePixels(rastreio as RastreioProduto | null);
  useEffect(() => {
    if (!rastreio) return;
    const t = setTimeout(() => dispararPixel(rastreio, 'InitiateCheckout', { valor: Number(preco), produtoId: productId, titulo }), 400);
    return () => clearTimeout(t);
  }, [rastreio, preco, productId, titulo]);
  useEffect(() => {
    // pré-preenche o e-mail se veio no link (?email=)
    try { const e = new URLSearchParams(window.location.search).get('email'); if (e && convidadoInicial) setDados((d) => ({ ...d, email: e.slice(0, 160) })); } catch {}
    try { const n = new URLSearchParams(window.location.search).get('nome'); if (n && convidadoInicial) setDados((d) => ({ ...d, nome: n.replace(/[<>]/g, '').slice(0, 80) })); } catch {}
  }, [convidadoInicial]);
  // Link de oferta: ?cupom=CODIGO já aplica o cupom ao abrir o checkout
  useEffect(() => {
    if (!aceitaCupom) return;
    try {
      const c = (new URLSearchParams(window.location.search).get('cupom') || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
      if (c) { setCupom(c); aplicarCupom(c); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aceitaCupom]);
  const router = useRouter();
  const [cupom, setCupom] = useState('');
  const [aplicado, setAplicado] = useState<{ codigo: string; desconto: number; final: number } | null>(null);
  const [checando, setChecando] = useState(false);
  const [gerando, setGerando] = useState(false);
  // Order bumps marcados (ids dos produtos). O servidor confere e cobra pelo preço salvo pelo vendedor.
  const [marcados, setMarcados] = useState<string[]>([]);
  const bumpsMarcados: any[] = (bumps as any[]).filter((b) => marcados.includes(b.id));
  const [erro, setErro] = useState('');
  // Celular: barra fixa com o total enquanto o botão de pagar não está na tela
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const erroRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef<HTMLDivElement | null>(null);
  const [botaoNaTela, setBotaoNaTela] = useState(true);
  useEffect(() => {
    const el = botaoRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setBotaoNaTela(e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (erro) erroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [erro]);
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix');

  const subtotalProduto = aplicado ? aplicado.final : preco;
  const totalBruto = +(subtotalProduto + bumpsMarcados.reduce((s, b) => s + Number(b.valor), 0)).toFixed(2);

  const [usarPontos, setUsarPontos] = useState(false);
  // valor máximo dos pontos, deixando ao menos R$1,00 para pagar via Pix
  const valorPontos = perBrl ? Math.floor((meusPontos / perBrl) * 100) / 100 : 0;
  const descontoPontos = usarPontos ? Math.max(0, Math.min(valorPontos, +(totalBruto - 1).toFixed(2))) : 0;
  const total = +(totalBruto - descontoPontos).toFixed(2);
  const podeUsarPontos = meusPontos > 0 && valorPontos >= 0.01 && totalBruto > 1;
  const accent = cor || 'var(--orange)';

  // Cartão só aparece se o Admin ligou (e as chaves existem) e o total cobre o mínimo da Stripe.
  const mostrarCartao = !!cartaoDisponivel && total >= CARTAO_MIN_BRL;
  // Se o cartão sumir (ex.: cupom/pontos baixaram o total), volta para Pix.
  const metodoEfetivo: 'pix' | 'cartao' = mostrarCartao ? metodo : 'pix';
  // Taxa de serviço do meio de pagamento (paga pelo comprador; mostrada antes de pagar, como manda o CDC)
  // = tarifa do Pix/cartão + taxa da plataforma; a mesma conta do servidor (lib/taxas)
  const taxaNormal = taxas ? taxaComprador(metodoEfetivo, total, taxas as ConfigTaxas) : 0;
  // 1ª compra sem taxa: o servidor confere de novo ao gerar o Pix/cartão (mesma regra)
  const promoVale = !!promo?.ativo && (metodoEfetivo === 'pix' || !!promo?.cartao);
  const semTaxa = promoVale && promo?.primeira === true && taxaNormal > 0;
  const taxaServico = semTaxa ? 0 : taxaNormal;
  const pontosVolta = cashback && cashback.pct > 0 ? Math.floor(total * cashback.pct / 100 * (cashback.pontosPorReal || 100)) : 0;
  const valorVolta = pontosVolta ? Math.floor((pontosVolta / (cashback.pontosPorReal || 100)) * 100) / 100 : 0;
  const totalAPagar = Math.round((total + taxaServico) * 100) / 100;

  async function aplicarCupom(codigoLink?: string) {
    const codigo = (codigoLink ?? cupom).trim();
    if (!codigo) return;
    setChecando(true);
    const r = await fetch('/api/coupon/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ codigo, productId }),
    });
    const d = await r.json();
    setChecando(false);
    if (r.ok) { setAplicado({ codigo: d.codigo, desconto: d.desconto, final: d.final }); toast('Cupom aplicado!', 'success'); }
    else { setAplicado(null); toast(d.error || 'Cupom inválido', 'error'); }
  }

  // Identifica o comprador sem login. Devolve true quando pode seguir para o pagamento.
  async function identificar(): Promise<boolean> {
    const e: typeof errosId = {};
    if (!/\S+\s+\S+/.test(dados.nome.trim())) e.nome = 'Informe nome e sobrenome.';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(dados.email.trim())) e.email = 'Informe um e-mail válido.';
    if (dados.whatsapp.replace(/\D/g, '').length < 10) e.whatsapp = 'Informe o WhatsApp com DDD.';
    setErrosId(e);
    if (Object.keys(e).length) { setErro('Preencha seus dados para continuar.'); return false; }
    const r = await fetch('/api/checkout/identificar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...dados, productId }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) { setConvidado(false); return true; }
    if (r.ok && d.existe) { setModoId('existe'); setErro(''); return false; }
    if (d.campo) setErrosId({ [d.campo]: d.error });
    setErro(d.error || 'Não foi possível continuar. Tente de novo.');
    return false;
  }

  async function pagar() {
    setErro('');
    setGerando(true);
    if (convidado) {
      if (modoId === 'existe') { setGerando(false); setErro('Entre na sua conta (acima) para continuar.'); return; }
      const ok = await identificar().catch(() => false);
      if (!ok) { setGerando(false); return; }
    }
    dispararPixel(rastreio, 'AddPaymentInfo', { valor: total, produtoId: productId, titulo });
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ productId, cupom: aplicado?.codigo || null, bumps: bumpsMarcados.map((b) => b.id), usarPontos, origem: coletarOrigem(), cliques: coletarCliques() }),
    });
    if (res.status === 401) { router.push('/login?next=' + encodeURIComponent(window.location.pathname)); return; }
    const data = await res.json();
    if (!res.ok) { setGerando(false); setErro(data.error || 'Falha ao gerar o pedido.'); return; }

    if (metodoEfetivo === 'pix') {
      router.push(`/pedido/${data.orderId}`);
      return;
    }

    // Cartão: o pedido já existe; agora abre a Checkout Session da Stripe.
    try {
      const r = await fetch('/api/checkout/stripe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ orderId: data.orderId }),
      });
      const d = await r.json().catch(() => ({} as any));
      if (r.ok && d?.url) {
        window.location.href = d.url;
        return;
      }
      const msg = d?.error || 'Não foi possível abrir o pagamento com cartão. Você pode pagar com Pix.';
      setErro(msg);
      toast(msg, 'error');
    } catch {
      const msg = 'Falha de conexão ao abrir o pagamento com cartão. Você pode pagar com Pix.';
      setErro(msg);
      toast(msg, 'error');
    }
    // Leva ao pedido, onde o Pix continua disponível (e o botão "Prefere cartão?").
    setTimeout(() => router.push(`/pedido/${data.orderId}`), 1800);
  }

  const textoBotao = metodoEfetivo === 'cartao'
    ? (gerando ? 'Abrindo pagamento seguro…' : `Pagar ${money(totalAPagar)} com cartão`)
    : (gerando ? 'Gerando Pix…' : `Pagar ${money(totalAPagar)} com Pix`);

  return (
    <div className="card">
      {/* Etapas: dados → pagamento → entrega */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '4px 0 18px', borderBottom: '1px solid var(--border)' }}>
        <Step n={1} label="Seus dados" active={convidado} done={!convidado} />
        <div style={{ flex: 1, height: 2, background: convidado ? '#E4E4ED' : 'var(--green, #00B87A)', marginTop: 14 }} />
        <Step n={2} label="Pagamento" active={!convidado} />
        <div style={{ flex: 1, height: 2, background: '#E4E4ED', marginTop: 14 }} />
        <Step n={3} label="Entrega" />
      </div>

      {/* Produto */}
      <div className="li" style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <ProductThumb className="em" capa_url={capa_url} categoria={categoria} titulo={titulo} tamanho={46} raio={14} icone={22} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{titulo}</strong>
          <div className="muted">{loja}</div>
        </div>
        <strong style={{ fontFamily: 'Outfit' }}>{money(preco)}</strong>
      </div>
      {v && <CartaoVendedor v={v} />}
      {ent && <PromessaEntrega e={ent} />}

      <div ref={idRef} style={{ scrollMarginTop: 16 }} />
      {convidado ? (
        <IdentificacaoComprador dados={dados} onDados={setDados} modo={modoId} productId={productId} erros={errosId} accent={accent} onTrocarEmail={() => { setModoId('form'); setErro(''); }}
          onLogado={() => { setConvidado(false); setErro(''); toast('Pronto! Agora é só pagar.', 'success'); }} />
      ) : emailLogado ? (
        <div className="muted" style={{ fontSize: 12.5, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          Comprando como <b style={{ color: 'var(--text)' }}>{emailLogado}</b>
        </div>
      ) : null}

      {aceitaCupom && (
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>Tem um cupom?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} placeholder="CUPOM" disabled={!!aplicado}
              style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 16, textTransform: 'uppercase' }} />
            {aplicado
              ? <button className="btn btn-ghost btn-sm" onClick={() => { setAplicado(null); setCupom(''); }}>Remover</button>
              : <button className="btn btn-dark btn-sm" onClick={() => aplicarCupom()} disabled={checando}>{checando ? '…' : 'Aplicar'}</button>}
          </div>
        </div>
      )}

      {(bumps as any[]).map((b) => (
        <BumpOferta key={b.id} bump={b} marcado={marcados.includes(b.id)} cor={accent}
          onToggle={(on) => setMarcados((l) => (on ? [...l.filter((i) => i !== b.id), b.id] : l.filter((i) => i !== b.id)))} />
      ))}

      {/* Resumo */}
      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
          <span className="muted">Subtotal</span><span>{money(preco)}</span>
        </div>
        {bumpsMarcados.map((b) => (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, marginBottom: 6 }}>
            <span className="muted">+ {b.titulo}</span><span style={{ whiteSpace: 'nowrap' }}>{money(Number(b.valor))}</span>
          </div>
        ))}
        {aplicado && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, color: 'var(--green)' }}>
            <span>Cupom {aplicado.codigo}</span><span>- {money(aplicado.desconto)}</span>
          </div>
        )}
        {descontoPontos > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, color: 'var(--green)' }}>
            <span>CB Points</span><span>- {money(descontoPontos)}</span>
          </div>
        )}
        {taxaServico > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span className="muted">Taxa de serviço ({metodoEfetivo === 'cartao' ? 'cartão' : 'Pix'})<small style={{ display: 'block', fontSize: 11.5 }}>Referente à tarifa do {metodoEfetivo === 'cartao' ? 'cartão' : 'Pix'} e ao serviço da plataforma</small></span><span>{money(taxaServico)}</span>
          </div>
        )}
        {semTaxa && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, color: 'var(--green)', fontWeight: 700 }}>
            <span>Taxa de serviço · 1ª compra</span><span><s style={{ color: 'var(--muted)', fontWeight: 500, marginRight: 6 }}>{money(taxaNormal)}</s>Grátis</span>
          </div>
        )}
        {promoVale && promo?.primeira === null && taxaNormal > 0 && (
          <p style={{ fontSize: 12.5, margin: '0 0 6px', color: 'var(--green)', fontWeight: 700 }}>🎁 1ª compra no Comprei Barato? A taxa de serviço{promo?.cartao ? '' : ' do Pix'} sai grátis: o desconto aparece no valor final do pagamento.</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Outfit', fontWeight: 900, fontSize: 20, marginTop: 8 }}>
          <span>Total</span><span>{money(totalAPagar)}</span>
        </div>
        {valorVolta >= 0.01 && <p style={{ fontSize: 12.5, margin: '6px 0 0', color: 'var(--orange-ink)', fontWeight: 700 }}>⚡ Você ganha {money(valorVolta)} de volta em CB Points para usar na próxima compra.</p>}
      </div>

      {podeUsarPontos && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px', margin: '14px 0', border: `1.5px solid ${usarPontos ? accent : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', background: usarPontos ? 'var(--soft)' : '#fff' }}>
          <input type="checkbox" checked={usarPontos} onChange={(e) => setUsarPontos(e.target.checked)} />
          <span style={{ flex: 1 }}>
            <strong style={{ fontFamily: 'Outfit', display: 'block', fontSize: 14 }}>Usar meus CB Points</strong>
            <span className="muted" style={{ fontSize: 12.5 }}>Você tem <strong>{meusPontos}</strong> pontos (vale {money(valorPontos)}). Aplica até {money(Math.max(0, +(totalBruto - 1).toFixed(2)))} neste pedido.</span>
            <span className="muted" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>Desconto para compras na plataforma. Não disponível para saque.</span>
          </span>
        </label>
      )}

      {/* Forma de pagamento */}
      <div style={{ padding: '16px 0 4px' }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>Forma de pagamento</label>
        <div role="radiogroup" aria-label="Forma de pagamento" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <OpcaoPagamento
            selecionada={metodoEfetivo === 'pix'}
            onSelect={() => !gerando && setMetodo('pix')}
            accent={accent}
            titulo="Pix"
            subtitulo={ent?.manual ? 'Aprovação na hora · o vendedor é avisado na hora' : 'Aprovação na hora · entrega imediata'}
            icone={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={metodoEfetivo === 'pix' ? accent : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 2 12l10 10 10-10z" /><path d="M7 12l5 5 5-5-5-5z" />
              </svg>
            }
          />
          {mostrarCartao && (
            <OpcaoPagamento
              selecionada={metodoEfetivo === 'cartao'}
              onSelect={() => !gerando && setMetodo('cartao')}
              accent={accent}
              titulo="Cartão de crédito"
              subtitulo="Visa, Master, Elo · pagamento seguro via Stripe"
              icone={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={metodoEfetivo === 'cartao' ? accent : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" />
                </svg>
              }
            />
          )}
        </div>
      </div>

      <ProtecaoCompra garantiaDias={Number(garantiaDias) || 7} manual={!!ent?.manual} />

      {erro && (
        <div ref={erroRef} style={{ background: '#FDECEC', border: '1px solid #F5C2C2', color: '#C0392B', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '14px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="alert" size={16} style={{ marginTop: 1 }} /><span>{erro}</span>
        </div>
      )}

      <button ref={botaoRef} className="btn btn-pri" style={{ width: '100%', marginTop: 16, minHeight: 52, fontSize: 16, ...(cor ? { background: cor } : {}) }} onClick={pagar} disabled={gerando}>
        {gerando ? textoBotao : <><Icon name={metodoEfetivo === 'cartao' ? 'lock' : 'bolt'} size={18} /> {textoBotao}</>}
      </button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="lock" size={13} /> {ent?.manual ? 'Pagamento seguro · o vendedor só recebe depois da garantia' : 'Pagamento seguro · entrega na hora após o pagamento'}</p>

      {/* Celular: total e atalho para pagar sempre à mão */}
      {!botaoNaTela && (
        <div className="ck-barra" role="region" aria-label="Pagar">
          <span><small>Total</small><b>{money(totalAPagar)}</b></span>
          <button type="button" className="btn btn-pri" style={cor ? { background: cor } : undefined} disabled={gerando}
            onClick={() => { if (convidado) { idRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } pagar(); }}>
            {convidado ? 'Continuar' : metodoEfetivo === 'cartao' ? 'Pagar com cartão' : 'Pagar com Pix'}
          </button>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `.ck-barra{display:none}@media (max-width:640px){.ck-barra{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;gap:12px;align-items:center;justify-content:space-between;background:#fff;border-top:1px solid var(--border);box-shadow:0 -6px 20px rgba(0,0,0,.08);padding:10px 16px calc(10px + env(safe-area-inset-bottom))}.ck-barra small{display:block;font-size:11px;color:var(--muted);font-weight:700}.ck-barra b{font-family:Outfit;font-size:19px;font-weight:900}.ck-barra .btn{flex:1;max-width:240px;min-height:48px}}` }} />
    </div>
  );
}
