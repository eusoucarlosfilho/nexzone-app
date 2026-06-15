'use client';
import { useState } from 'react';
import OrderChat from '@/components/OrderChat';
import { toast } from '@/lib/toast';

export default function SellerChatView({ orderId, entregue, conteudoAtual }: { orderId: string; entregue: boolean; conteudoAtual: string }) {
  const [jaEntregue, setJaEntregue] = useState(entregue);
  const [abrir, setAbrir] = useState(!entregue);
  const [conteudo, setConteudo] = useState(conteudoAtual);
  const [enviando, setEnviando] = useState(false);
  const [refresh, setRefresh] = useState(0);

  async function entregar() {
    if (!conteudo.trim()) { toast('Escreva o que será entregue (link, acesso, etc.).', 'error'); return; }
    setEnviando(true);
    const r = await fetch('/api/chat/deliver', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ orderId, conteudo }),
    });
    setEnviando(false);
    if (r.ok) {
      setJaEntregue(true); setAbrir(false); setRefresh((x) => x + 1);
      toast('Produto entregue! O cliente foi avisado na conversa.', 'success');
    } else {
      const d = await r.json().catch(() => ({}));
      toast(d.error || 'Falha ao entregar.', 'error');
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${jaEntregue ? 'var(--green)' : 'var(--orange)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <strong style={{ fontFamily: 'Outfit', fontSize: 15 }}>{jaEntregue ? '✓ Produto entregue' : 'Entregar produto'}</strong>
            <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
              {jaEntregue ? 'O conteúdo já foi liberado para o cliente. Você pode atualizar abaixo se precisar.' : 'Cole o link, os dados de acesso ou as instruções. Ao entregar, o cliente é avisado na conversa e o conteúdo fica liberado na compra dele.'}
            </p>
          </div>
          {jaEntregue && <button className="btn btn-ghost btn-sm" onClick={() => setAbrir((a) => !a)}>{abrir ? 'Fechar' : 'Atualizar'}</button>}
        </div>

        {abrir && (
          <div style={{ marginTop: 14 }}>
            <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={4}
              placeholder="Ex.: Aqui está seu produto: https://... &#10;Login: ... / Senha: ..."
              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            <button className="btn btn-pri" style={{ marginTop: 10 }} onClick={entregar} disabled={enviando}>
              {enviando ? 'Entregando…' : (jaEntregue ? 'Atualizar entrega' : '⚡ Entregar agora')}
            </button>
          </div>
        )}
      </div>

      <OrderChat key={refresh} orderId={orderId} theme="light" />
    </>
  );
}
