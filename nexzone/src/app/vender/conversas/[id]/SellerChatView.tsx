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

export default function SellerChatView({ orderId, status, entregue, podeEntregar, conteudoAtual }: {
  orderId: string; status: string; entregue: boolean; podeEntregar: boolean; conteudoAtual: string;
}) {
  const router = useRouter();
  const [jaEntregue, setJaEntregue] = useState(entregue);
  const [abrir, setAbrir] = useState(podeEntregar && !entregue);
  const [conteudo, setConteudo] = useState(conteudoAtual);
  const [enviando, setEnviando] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Aviso persistente quando a entrega foi gravada mas a mensagem no chat não foi registrada
  const [avisoPendente, setAvisoPendente] = useState(false);

  async function entregar() {
    if (!conteudo.trim()) { toast('Escreva o que será entregue (link, acesso, etc.).', 'error'); return; }
    setEnviando(true);
    let r: Response | null = null;
    let d: any = {};
    try {
      r = await fetch('/api/chat/deliver', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ orderId, conteudo }),
      });
      d = await r.json().catch(() => ({}));
    } catch {
      setEnviando(false);
      toast('Falha de conexão. Verifique a internet e tente de novo.', 'error');
      return;
    }
    setEnviando(false);

    if (r.ok && d.ok) {
      const atualizou = d.modo === 'atualizado' || jaEntregue;
      setJaEntregue(true); setAbrir(false); setRefresh((x) => x + 1);
      if (d.avisoRegistrado) {
        setAvisoPendente(false);
        toast(atualizou
          ? 'Entrega atualizada. O aviso foi registrado na conversa do pedido.'
          : 'Produto entregue. O aviso foi registrado na conversa do pedido.', 'success');
      } else {
        // Sucesso parcial: não afirmar que o comprador foi avisado
        setAvisoPendente(true);
        toast('Conteúdo liberado na compra, mas o aviso na conversa não foi registrado.', 'info');
      }
      return;
    }

    if (r.status === 409) {
      // O status do pedido não permite (ou mudou), ou o pedido precisa de regularização:
      // mostra o motivo e recarrega os dados da página (que passa a exibir o card correspondente)
      toast(d.error || 'Este pedido não pode ser entregue no status atual.', 'error');
      router.refresh();
      return;
    }
    toast(d.error || 'Falha ao entregar.', 'error');
  }

  const bloqueio = !podeEntregar ? (BLOQUEIO[status] ?? { titulo: 'Entrega indisponível', texto: 'Este pedido não pode ser entregue no status atual.' }) : null;

  return (
    <>
      {bloqueio ? (
        <div className="card" role="status" style={{ marginBottom: 16, borderLeft: '3px solid var(--border)' }}>
          <strong style={{ fontFamily: 'Outfit', fontSize: 15 }}>{bloqueio.titulo}</strong>
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>{bloqueio.texto}</p>
        </div>
      ) : (
      <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${jaEntregue ? 'var(--green)' : 'var(--orange)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <strong style={{ fontFamily: 'Outfit', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>{jaEntregue ? <><Icon name="checkCircle" size={16} color="var(--green)" /> Produto entregue</> : 'Entregar produto'}</strong>
            <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
              {jaEntregue
                ? 'O conteúdo já está liberado na compra do cliente. Se precisar corrigir, atualize abaixo — a data da entrega é mantida.'
                : 'Cole o link, os dados de acesso ou as instruções. Ao entregar, o conteúdo fica liberado na compra do cliente e um aviso é registrado nesta conversa.'}
            </p>
          </div>
          {jaEntregue && <button className="btn btn-ghost btn-sm" onClick={() => setAbrir((a) => !a)}>{abrir ? 'Fechar' : 'Atualizar'}</button>}
        </div>

        {avisoPendente && (
          <div role="alert" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--yellow-bg)', color: 'var(--yellow)', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, lineHeight: 1.45 }}>
            <Icon name="alert" size={15} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>A entrega foi gravada e o conteúdo está liberado na compra, mas não conseguimos registrar o aviso nesta conversa. Envie uma mensagem ao comprador abaixo para avisá-lo.</span>
          </div>
        )}

        {abrir && (
          <div style={{ marginTop: 14 }}>
            <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={4} aria-label="Conteúdo da entrega"
              placeholder="Ex.: Aqui está seu produto: https://... &#10;Login: ... / Senha: ..."
              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            <button className="btn btn-pri" style={{ marginTop: 10 }} onClick={entregar} disabled={enviando}>
              {enviando ? (jaEntregue ? 'Atualizando…' : 'Entregando…') : (jaEntregue ? 'Atualizar entrega' : <><Icon name="bolt" size={18} /> Entregar agora</>)}
            </button>
          </div>
        )}
      </div>
      )}

      <OrderChat key={refresh} orderId={orderId} theme="light" />
    </>
  );
}
