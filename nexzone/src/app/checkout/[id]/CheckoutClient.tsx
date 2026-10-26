'use client';
import { useState } from 'react';
import BumpOferta from '@/components/BumpOferta';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';

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

export default function CheckoutClient({ productId, titulo, emoji, categoria, capa_url, loja, preco, cor, bumps = [], aceitaCupom, meusPontos = 0, perBrl = 100, cartaoDisponivel = false }: any) {
  const router = useRouter();
  const [cupom, setCupom] = useState('');
  const [aplicado, setAplicado] = useState<{ codigo: string; desconto: number; final: number } | null>(null);
  const [checando, setChecando] = useState(false);
  const [gerando, setGerando] = useState(false);
  // Order bumps marcados (ids dos produtos). O servidor confere e cobra pelo preço salvo pelo vendedor.
  const [marcados, setMarcados] = useState<string[]>([]);
  const bumpsMarcados: any[] = (bumps as any[]).filter((b) => marcados.includes(b.id));
  const [erro, setErro] = useState('');
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

  async function aplicarCupom() {
    if (!cupom.trim()) return;
    setChecando(true);
    const r = await fetch('/api/coupon/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ codigo: cupom, productId }),
    });
    const d = await r.json();
    setChecando(false);
    if (r.ok) { setAplicado({ codigo: d.codigo, desconto: d.desconto, final: d.final }); toast('Cupom aplicado!', 'success'); }
    else { setAplicado(null); toast(d.error || 'Cupom inválido', 'error'); }
  }

  async function pagar() {
    setErro('');
    setGerando(true);
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ productId, cupom: aplicado?.codigo || null, bumps: bumpsMarcados.map((b) => b.id), usarPontos }),
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
    ? (gerando ? 'Abrindo pagamento seguro…' : `Pagar ${money(total)} com cartão`)
    : (gerando ? 'Gerando Pix…' : `Pagar ${money(total)} com Pix`);

  return (
    <div className="card">
      {/* Etapas */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '4px 0 18px', borderBottom: '1px solid var(--border)' }}>
        <Step n={1} label="Revisar" active />
        <div style={{ flex: 1, height: 2, background: '#E4E4ED', marginTop: 14 }} />
        <Step n={2} label="Pagar" />
        <div style={{ flex: 1, height: 2, background: '#E4E4ED', marginTop: 14 }} />
        <Step n={3} label="Receber" />
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

      {aceitaCupom && (
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>Tem um cupom?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} placeholder="CUPOM" disabled={!!aplicado}
              style={{ flex: 1, height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, textTransform: 'uppercase' }} />
            {aplicado
              ? <button className="btn btn-ghost btn-sm" onClick={() => { setAplicado(null); setCupom(''); }}>Remover</button>
              : <button className="btn btn-dark btn-sm" onClick={aplicarCupom} disabled={checando}>{checando ? '…' : 'Aplicar'}</button>}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Outfit', fontWeight: 900, fontSize: 20, marginTop: 8 }}>
          <span>Total</span><span>{money(total)}</span>
        </div>
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
            subtitulo="Aprovação na hora · entrega imediata"
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

      {erro && (
        <div style={{ background: '#FDECEC', border: '1px solid #F5C2C2', color: '#C0392B', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '14px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="alert" size={16} style={{ marginTop: 1 }} /><span>{erro}</span>
        </div>
      )}

      <button className="btn btn-pri" style={{ width: '100%', marginTop: 16, ...(cor ? { background: cor } : {}) }} onClick={pagar} disabled={gerando}>
        {gerando ? textoBotao : <><Icon name={metodoEfetivo === 'cartao' ? 'lock' : 'bolt'} size={18} /> {textoBotao}</>}
      </button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="lock" size={13} /> Pagamento seguro · entrega imediata após o pagamento</p>
    </div>
  );
}
