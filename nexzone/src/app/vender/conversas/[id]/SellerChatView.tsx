'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OrderChat from '@/components/OrderChat';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';

// Textos para pedidos que NÃO podem ser entregues (mesma regra de /api/chat/deliver)
const BLOQUEIO: Record<string, { titulo: string; texto: string }> = {
  pendente: {
    titulo: 'Aguardando pagamento',
    texto: 'O comprador ainda não concluiu o pagamento. A entrega fica disponível assim que o pagamento for confirmado — você não precisa fazer nada agora.',
  },
  cancelado: {
    titulo: 'Pedido cancelado',
    texto: 'Este pedido foi cancelado e não será pago. Não há entrega a fazer.',
  },
  reembolsado: {
    titulo: 'Pedido reembolsado',
    texto: 'O valor foi devolvido ao comprador. A entrega foi encerrada e não pode mais ser feita ou atualizada.',
  },
  regularizacao: {
    titulo: 'Pedido precisa de regularização',
    texto: 'Este pedido consta como entregue, mas está sem a data de entrega. Para não afetar o seu saldo, ele não pode ser atualizado por aqui. Fale com o suporte do Comprei Barato para regularizar.',
  },
};

export default function SellerChatView({ orderId, status, podeEntregar, conteudoAtual, entregaConfirmada, confirmadaEm, sql25 }: {
  orderId: string; status: string; entregue?: boolean; podeEntregar: boolean; conteudoAtual: string;
  entregaConfirmada: boolean; confirmadaEm: string | null; sql25: boolean;
}) {
  const router = useRouter();
  const [entregueOk, setEntregueOk] = useState(entregaConfirmada);
  const [abrir, setAbrir] = useState(false);
  const [conteudo, setConteudo] = useState(conteudoAtual);
  const [marcarAoEnviar, setMarcarAoEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [avisoPendente, setAvisoPendente] = useState(false);

  const [cancelando, setCancelando] = useState(false);
  async function cancelarVenda() {
    const motivo = prompt('Cancelar esta venda e devolver o dinheiro ao cliente?\n\nConte o motivo (o cliente vê na conversa):');
    if (motivo === null) return;
    if (motivo.trim().length < 5) { toast('Escreva o motivo em poucas palavras.', 'error'); return; }
    if (!confirm('Confirmar o cancelamento? O valor desta venda sai do seu saldo e volta para o cliente. Não dá para desfazer.')) return;
    setCancelando(true);
    try {
      const r = await fetch('/api/chat/cancelar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ orderId, motivo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível cancelar.', 'error'); return; }
      toast('Venda cancelada. O suporte devolve o valor ao cliente.', 'success'); setRefresh((x) => x + 1); router.refresh();
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setCancelando(false); }
  }

  async function marcar() {
    if (!confirm('Marcar este pedido como entregue? O cliente recebe um aviso para conferir.')) return;
    setMarcando(true);
    try {
      const r = await fetch('/api/chat/entregue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ orderId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível marcar.', 'error'); return; }
      setEntregueOk(true); setRefresh((x) => x + 1); router.refresh();
      toast('Pedido marcado como entregue. O cliente foi avisado.', 'success');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setMarcando(false); }
  }

  async function entregar() {
    if (!conteudo.trim()) { toast('Escreva o que será enviado (link, acesso, instruções).', 'error'); return; }
    setEnviando(true);
    let r: Response | null = null;
    let d: any = {};
    try {
      r = await fetch('/api/chat/deliver', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ orderId, conteudo, marcarEntregue: !entregueOk && marcarAoEnviar }),
      });
      d = await r.json().catch(() => ({}));
    } catch {
      setEnviando(false);
      toast('Falha de conexão. Verifique a internet e tente de novo.', 'error');
      return;
    }
    setEnviando(false);
    if (r.ok && d.ok) {
      if (d.entregue) setEntregueOk(true);
      setAbrir(false); setRefresh((x) => x + 1); router.refresh();
      if (!d.avisoRegistrado) { setAvisoPendente(true); toast('Conteúdo salvo na compra, mas a mensagem no chat não foi registrada.', 'info'); return; }
      setAvisoPendente(false);
      toast(d.entregue ? 'Enviado e marcado como entregue.' : entregueOk ? 'Entrega atualizada e enviada ao cliente.' : 'Enviado ao cliente. Marque como entregue quando ele tiver recebido.', 'success');
      return;
    }
    if (r.status === 409) { toast(d.error || 'Este pedido não pode ser entregue no status atual.', 'error'); router.refresh(); return; }
    toast(d.error || 'Falha ao enviar.', 'error');
  }

  const bloqueio = !podeEntregar ? (BLOQUEIO[status] ?? { titulo: 'Entrega indisponível', texto: 'Este pedido não pode ser entregue no status atual.' }) : null;
  const dataBR = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <>
      {bloqueio ? (
        <div className="card" role="status" style={{ marginBottom: 16, borderLeft: '3px solid var(--border)' }}>
          <strong style={{ fontFamily: 'Outfit', fontSize: 15 }}>{bloqueio.titulo}</strong>
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>{bloqueio.texto}</p>
        </div>
      ) : (
      <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${entregueOk ? 'var(--green)' : 'var(--orange)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <strong style={{ fontFamily: 'Outfit', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              {entregueOk ? <><Icon name="checkCircle" size={16} color="var(--green)" /> Pedido entregue</> : <><Icon name="package" size={16} color="var(--orange-ink)" /> Aguardando entrega</>}
            </strong>
            <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
              {entregueOk
                ? `Marcado como entregue${confirmadaEm ? ` em ${dataBR(confirmadaEm)}` : ''}. Se precisar corrigir o que foi enviado, use "Atualizar entrega".`
                : 'Converse e envie os dados pelo chat. Quando o cliente tiver recebido, marque como entregue: ele é avisado para conferir.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!entregueOk && sql25 && <button className="btn btn-pri btn-sm" onClick={marcar} disabled={marcando}><Icon name="check" size={15} /> {marcando ? 'Marcando…' : 'Marcar como entregue'}</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => setAbrir((a) => !a)}>{abrir ? 'Fechar' : entregueOk ? 'Atualizar entrega' : 'Enviar entrega'}</button>
          </div>
        </div>
        {!sql25 && <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>O botão "Marcar como entregue" aparece depois que o SQL 25 for aplicado.</p>}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <small className="muted" style={{ fontSize: 12 }}>Não vai conseguir entregar ou o cliente desistiu?</small>
          <button type="button" onClick={cancelarVenda} disabled={cancelando} style={{ background: 'none', border: 0, color: 'var(--red)', fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>{cancelando ? 'Cancelando…' : 'Cancelar venda e devolver ao cliente'}</button>
        </div>

        {avisoPendente && (
          <div role="alert" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--yellow-bg)', color: 'var(--yellow)', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, lineHeight: 1.45 }}>
            <Icon name="alert" size={15} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>O conteúdo foi salvo na compra, mas a mensagem não entrou nesta conversa. Envie uma mensagem ao comprador abaixo para avisá-lo.</span>
          </div>
        )}

        {abrir && (
          <div style={{ marginTop: 14 }}>
            <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={4} aria-label="Conteúdo da entrega"
              placeholder="Ex.: Aqui está seu produto: https://... &#10;Login: ... / Senha: ..."
              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', padding: 12, fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }} />
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>Vai para o chat e fica salvo na compra do cliente.</p>
            {!entregueOk && sql25 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, fontWeight: 700, margin: '10px 0 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={marcarAoEnviar} onChange={(e) => setMarcarAoEnviar(e.target.checked)} style={{ width: 18, height: 18 }} />
                Marcar como entregue ao enviar
              </label>
            )}
            <button className="btn btn-pri" style={{ marginTop: 10 }} onClick={entregar} disabled={enviando}>
              {enviando ? 'Enviando…' : entregueOk ? 'Atualizar entrega' : marcarAoEnviar ? <><Icon name="check" size={18} /> Enviar e marcar como entregue</> : <><Icon name="send" size={18} /> Enviar ao cliente</>}
            </button>
          </div>
        )}
      </div>
      )}

      <OrderChat key={refresh} orderId={orderId} theme="light" />
    </>
  );
}
