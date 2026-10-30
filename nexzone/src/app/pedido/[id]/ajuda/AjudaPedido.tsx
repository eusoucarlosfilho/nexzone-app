'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import ComplaintBox from '../ComplaintBox';
import GarantiaReembolso, { type GarantiaInfo } from '../GarantiaReembolso';
import { OPCOES_AJUDA, motivoReembolsoDe, type OpcaoAjuda } from '@/lib/ajudaPedido';

// Passo a passo: o que aconteceu → caminho mais rápido (vendedor) → suporte → reembolso.
// O reembolso nunca fica escondido: "Ir direto para o reembolso" aparece sempre, e "Quero desistir" abre o formulário na hora.
export default function AjudaPedido({ orderId, garantia, reclamacaoAberta, manual, reembolsado }: {
  orderId: string; garantia: GarantiaInfo | null; reclamacaoAberta: boolean; manual: boolean; reembolsado: boolean;
}) {
  const [op, setOp] = useState<OpcaoAjuda | 'reembolso' | null>(null);
  const [origem, setOrigem] = useState<OpcaoAjuda | null>(null); // o que a pessoa contou antes de ir para o reembolso
  const ultimo = garantia?.pedidos?.[0];
  const temPedido = !!ultimo && ultimo.status !== 'cancelado';
  const opcao = OPCOES_AJUDA.find((o) => o.id === op) ?? null;
  const direto = op === 'desistir' || op === 'reembolso';

  return (
    <div className="aj">
      <style dangerouslySetInnerHTML={{ __html: `
        .aj .card{margin-bottom:14px}
        .aj h2{font-family:Outfit;font-size:17px;font-weight:900;margin:0 0 10px}
        .aj-ops{display:grid;gap:8px}
        .aj-op{display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:#fff;border:1.5px solid var(--border);border-radius:14px;padding:13px 14px;font-size:14.5px;font-weight:700;cursor:pointer;color:var(--text);font-family:inherit}
        .aj-op.on{border-color:var(--orange);background:var(--soft)}
        .aj-op small{display:block;font-weight:500;color:var(--sub);font-size:12.5px;margin-top:2px}
        .aj-passo{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
        .aj-n{width:24px;height:24px;border-radius:50%;flex:none;background:var(--orange);color:#fff;font-family:Outfit;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center}
        .aj-lnk{background:none;border:0;padding:0;color:var(--sub);text-decoration:underline;font-size:13px;cursor:pointer;font-family:inherit}
      ` }} />

      {reembolsado && <div className="card"><b>Este pedido já foi reembolsado.</b> <span className="muted">O valor volta pela mesma forma de pagamento.</span></div>}

      {temPedido && garantia && !direto && (
        <div className="card"><GarantiaReembolso orderId={orderId} g={{ ...garantia, pode: false }} semBorda /></div>
      )}

      {!reembolsado && (
        <div className="card">
          <h2>O que aconteceu?</h2>
          <div className="aj-ops" role="radiogroup" aria-label="O que aconteceu">
            {OPCOES_AJUDA.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={op === o.id} className={`aj-op ${op === o.id ? 'on' : ''}`} onClick={() => { setOp(o.id); setOrigem(o.id); }}>
                <Icon name={o.icone as any} size={20} color="var(--orange-ink)" />
                <span>{o.rotulo}<small>{o.dica}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {opcao && !direto && (
        <div className="card">
          <h2>O caminho mais rápido</h2>
          <div className="aj-passo"><span className="aj-n">1</span><span style={{ flex: 1 }}>
            <b>Fale com o vendedor no chat do pedido.</b> <span className="muted">{manual ? 'Ele entrega por lá e costuma responder rápido.' : 'Ele pode reenviar o acesso ou explicar como usar.'} Ele recebe o aviso na hora.</span>
            <div style={{ marginTop: 10 }}><Link href={`/pedido/${orderId}#chat`} className="btn btn-pri btn-sm"><Icon name="chat" size={16} /> Falar com o vendedor</Link></div>
          </span></div>
          <div className="aj-passo" style={{ marginTop: 14 }}><span className="aj-n">2</span><span style={{ flex: 1 }}>
            <b>Não resolveu? Chame o suporte.</b> <span className="muted">A equipe Comprei Barato entra na conversa e o pagamento fica retido enquanto isso.</span>
            <div style={{ textAlign: 'left' }}><ComplaintBox orderId={orderId} aberta={reclamacaoAberta} /></div>
          </span></div>
          <div className="aj-passo" style={{ marginTop: 14 }}><span className="aj-n">3</span><span style={{ flex: 1 }}>
            <b>Prefere o dinheiro de volta?</b> <span className="muted">Você pode pedir o reembolso a qualquer momento dentro da garantia.</span>
            <div style={{ marginTop: 8 }}><button type="button" className="aj-lnk" onClick={() => setOp('reembolso')}>Pedir reembolso</button></div>
          </span></div>
        </div>
      )}

      {direto && garantia && (
        <div className="card">
          <h2>{op === 'desistir' ? 'Desistir da compra' : 'Pedido de reembolso'}</h2>
          {op === 'desistir' && <p className="muted" style={{ margin: '0 0 10px', fontSize: 13.5 }}>Dentro de {garantia.dias} dias você tem direito de desistir, sem precisar justificar.</p>}
          <GarantiaReembolso key={op} orderId={orderId} g={garantia} abertoInicial={garantia.pode} motivoInicial={motivoReembolsoDe(op === 'reembolso' ? origem : (op as any))} semBorda />
          {!garantia.pode && !temPedido && garantia.motivo && <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>{garantia.motivo}</p>}
        </div>
      )}
      {direto && !garantia && (
        <div className="card"><p style={{ margin: 0 }}>O pedido de reembolso pelo site ainda não está ativo. Fale com o suporte pela conversa do pedido ou em <Link href="/suporte">Suporte</Link>.</p></div>
      )}

      {!reembolsado && !direto && garantia?.pode && (
        <p style={{ textAlign: 'center', margin: '4px 0 0' }}><button type="button" className="aj-lnk" onClick={() => setOp('reembolso')}>Ir direto para o pedido de reembolso</button></p>
      )}
    </div>
  );
}
