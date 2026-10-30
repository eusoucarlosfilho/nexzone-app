import Link from 'next/link';
import Icon from './Icon';
import { formatarCnpj, whatsappLegivel, type DadosEmpresa, type EtapaPedido } from '@/lib/confianca';

// Peças de confiança do checkout e da página do pedido. Sem estado: funcionam no servidor e no navegador.

export type VendedorCheckout = { nome: string; selo: string | null; linhas: string[]; nova: boolean; oficial: boolean };
export type EntregaCheckout = { titulo: string; detalhe: string; manual: boolean };

export const CSS_CONFIANCA = `
.cf-vend{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border)}
.cf-av{width:40px;height:40px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;font-family:Outfit;font-weight:900;color:#fff;background:linear-gradient(135deg,#FF6B00,#FF9A3C)}
.cf-vend b{font-family:Outfit;font-size:14.5px}
.cf-selo{display:inline-flex;align-items:center;gap:4px;background:var(--green-bg);color:var(--green);border-radius:50px;padding:2px 9px;font-size:11.5px;font-weight:800;margin-left:6px;vertical-align:1px}
.cf-selo.novo{background:var(--soft);color:var(--orange-ink)}
.cf-lin{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;font-size:12.5px;color:var(--sub)}
.cf-ent{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;margin:14px 0 0;border-radius:12px;background:var(--soft);font-size:13px;line-height:1.45}
.cf-ent b{display:block;font-family:Outfit;font-size:14px;color:var(--text)}
.cf-prot{margin:16px 0 0;border:1.5px solid #BFE8D6;background:#F3FBF7;border-radius:14px;padding:14px 14px 10px}
.cf-prot h3{font-family:Outfit;font-size:15px;font-weight:900;margin:0 0 10px;display:flex;gap:8px;align-items:center;color:#0B5D3F}
.cf-passos{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.cf-passos li{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.45;color:#24443A}
.cf-n{width:22px;height:22px;border-radius:50%;flex:none;background:var(--green);color:#fff;font-family:Outfit;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center;margin-top:1px}
.cf-prot details{margin-top:10px;border-top:1px dashed #BFE8D6;padding-top:8px;font-size:12.5px;color:#24443A}
.cf-prot summary{cursor:pointer;font-weight:800;color:var(--green);list-style:none}
.cf-prot summary::-webkit-details-marker{display:none}
.cf-prot details p{margin:6px 0 0;line-height:1.5}
.cf-tl{list-style:none;margin:0 0 4px;padding:14px 0 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;border-bottom:1px solid var(--border)}
.cf-tl li{position:relative;text-align:center;font-size:11.5px;font-weight:700;color:var(--muted);line-height:1.3}
.cf-tl li::before{content:'';position:absolute;top:11px;left:-50%;width:100%;height:2px;background:#E4E4ED;z-index:0}
.cf-tl li:first-child::before{display:none}
.cf-tl li.ok::before,.cf-tl li.at::before{background:var(--green)}
.cf-tl .p{position:relative;z-index:1;width:24px;height:24px;border-radius:50%;margin:0 auto 6px;background:#E4E4ED;color:#fff;display:flex;align-items:center;justify-content:center}
.cf-tl li.ok{color:var(--text)}
.cf-tl li.ok .p{background:var(--green)}
.cf-tl li.at{color:var(--orange-ink)}
.cf-tl li.at .p{background:#fff;border:3px solid var(--orange)}
.cf-tl small{display:block;font-weight:600;color:var(--muted);font-size:10.5px;margin-top:2px}
.cf-rod{margin:22px auto 0;text-align:center;font-size:12px;color:var(--muted);line-height:1.7;max-width:520px}
.cf-rod a{color:var(--sub)}
.cf-rod .cf-meios{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;font-weight:700;color:var(--sub);margin-bottom:6px}
.cf-rod .cf-meios span{display:inline-flex;gap:5px;align-items:center}
`;

export function CartaoVendedor({ v }: { v: VendedorCheckout }) {
  return (
    <div className="cf-vend">
      <span className="cf-av" aria-hidden="true">{(v.nome || 'L').charAt(0).toUpperCase()}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>Vendido por</div>
        <b>{v.nome}</b>
        {v.selo ? <span className="cf-selo"><Icon name="check" size={11} strokeWidth={3} /> {v.selo}</span> : v.nova ? <span className="cf-selo novo">Loja nova</span> : null}
        <div className="cf-lin">
          {v.linhas.map((l) => <span key={l}>{l}</span>)}
          {v.nova && !v.oficial && <span>Primeiras vendas · protegidas pela garantia Comprei Barato</span>}
        </div>
      </div>
    </div>
  );
}

export function PromessaEntrega({ e }: { e: EntregaCheckout }) {
  return (
    <div className="cf-ent">
      <Icon name={e.manual ? 'chat' : 'bolt'} size={18} color="var(--orange-ink)" style={{ marginTop: 1, flex: 'none' }} />
      <span><b>{e.titulo}</b>{e.detalhe}</span>
    </div>
  );
}

/** Os 3 passos da proteção + a explicação da garantia (abre ao tocar). */
export function ProtecaoCompra({ garantiaDias, manual }: { garantiaDias: number; manual: boolean }) {
  return (
    <div className="cf-prot" role="region" aria-label="Compra garantida">
      <h3><Icon name="shield" size={18} color="var(--green)" /> Compra garantida Comprei Barato</h3>
      <ol className="cf-passos">
        <li><span className="cf-n">1</span><span>Você paga e o valor fica <b>retido pelo Comprei Barato</b>. Ele não vai direto para o vendedor.</span></li>
        <li><span className="cf-n">2</span><span>{manual ? 'O vendedor entrega pelo chat do pedido e você confere.' : 'O produto é liberado na hora e você confere.'}</span></li>
        <li><span className="cf-n">3</span><span>Só depois do prazo de garantia o vendedor recebe. <b>Não recebeu ou não é o que foi anunciado? Devolvemos o valor.</b></span></li>
      </ol>
      <details>
        <summary>Como funciona a garantia de {garantiaDias} dias ›</summary>
        <p>Pela página do pedido você fala com o vendedor e, se precisar, pede o reembolso em até {garantiaDias} dias, sem burocracia. Se o vendedor não resolver, o suporte do Comprei Barato analisa e decide. O reembolso volta pelo mesmo meio de pagamento.</p>
        <p><Link href="/termos#reembolso" style={{ color: 'var(--green)', fontWeight: 800 }}>Ler a política de reembolso</Link></p>
      </details>
    </div>
  );
}

/** Rodapé do checkout: meios de pagamento, empresa (CNPJ) e contato. */
export function RodapeConfianca({ empresa, cartao }: { empresa: DadosEmpresa; cartao: boolean }) {
  const wa = empresa.whatsapp;
  return (
    <div className="cf-rod">
      <div className="cf-meios">
        <span><Icon name="lock" size={13} /> Conexão segura</span>
        <span><Icon name="bolt" size={13} /> Pix com confirmação automática</span>
        {cartao && <span><Icon name="shield" size={13} /> Cartão processado pela Stripe</span>}
      </div>
      {(empresa.razao || empresa.cnpj) && (
        <div>{[empresa.razao, empresa.cnpj && `CNPJ ${formatarCnpj(empresa.cnpj)}`, empresa.cidade].filter(Boolean).join(' · ')}</div>
      )}
      <div>
        {wa && <><a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp {whatsappLegivel(wa)}</a> · </>}
        {empresa.email && <><a href={`mailto:${empresa.email}`}>{empresa.email}</a> · </>}
        <Link href="/suporte">Suporte</Link> · <Link href="/termos">Termos</Link> · <Link href="/termos#reembolso">Reembolso</Link> · <Link href="/privacidade">Privacidade</Link>
      </div>
    </div>
  );
}

const dataCurta = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
};

/** Linha do tempo do pedido: criado → pago → entregue → garantia. */
export function LinhaDoTempo({ etapas }: { etapas: EtapaPedido[] }) {
  return (
    <ol className="cf-tl" aria-label="Andamento do pedido">
      {etapas.map((e) => (
        <li key={e.id} className={e.feito ? 'ok' : e.atual ? 'at' : ''} aria-current={e.atual ? 'step' : undefined}>
          <span className="p" aria-hidden="true">{e.feito && <Icon name="check" size={13} strokeWidth={3} />}</span>
          {e.rotulo}
          {e.quando && <small>{e.id === 'garantia' && !e.feito ? `até ${dataCurta(e.quando)}` : dataCurta(e.quando)}</small>}
        </li>
      ))}
    </ol>
  );
}
