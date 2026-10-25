'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

// Admin → Configurações → Suporte (salvo na tabela settings)
export default function SuporteConfig({ inicial }: { inicial?: { avisoMe: boolean; emailCliente: boolean } }) {
  const [avisoMe, setAvisoMe] = useState(inicial?.avisoMe !== false);
  const [emailCliente, setEmailCliente] = useState(inicial?.emailCliente !== false);
  const [busy, setBusy] = useState(false);

  async function salvar(patch: { avisarMe?: boolean; emailCliente?: boolean }) {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/suporte/preferencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(patch),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar');
      toast('Configuração do suporte salva.', 'success');
      return true;
    } catch (e: any) { toast(e?.message || 'Erro ao salvar', 'error'); return false; }
    finally { setBusy(false); }
  }

  const linha = { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderTop: '1px solid var(--bd2)', cursor: 'pointer' } as const;
  const caixa = { width: 20, height: 20, marginTop: 2, accentColor: '#FF6B00', flexShrink: 0 } as const;

  return (
    <div className="adm-card" style={{ maxWidth: 560 }}>
      <h3 className="adm-ct" style={{ marginBottom: 6 }}>Suporte</h3>
      <p style={{ fontSize: 13, color: 'var(--sub)', margin: '0 0 6px' }}>Desligar não apaga nada: as mensagens continuam salvas e o Admin mostra “e-mail não enviado (notificação desativada)”.</p>
      <label style={linha}>
        <input type="checkbox" style={caixa} checked={avisoMe} disabled={busy}
          onChange={async (e) => { const v = e.target.checked; setAvisoMe(v); if (!(await salvar({ avisarMe: v }))) setAvisoMe(!v); }} />
        <span>
          <b style={{ display: 'block', fontFamily: 'Outfit' }}>Avisar os admins por e-mail quando um chamado for aberto</b>
          <span style={{ fontSize: 12.5, color: 'var(--sub)' }}>Vale só para o SEU e-mail de admin (os outros admins escolhem o deles). Inclui o aviso de “cliente respondeu”. Os e-mails de suporte da seção acima recebem sempre.</span>
        </span>
      </label>
      <label style={linha}>
        <input type="checkbox" style={caixa} checked={emailCliente} disabled={busy}
          onChange={async (e) => { const v = e.target.checked; setEmailCliente(v); if (!(await salvar({ emailCliente: v }))) setEmailCliente(!v); }} />
        <span>
          <b style={{ display: 'block', fontFamily: 'Outfit' }}>Enviar por e-mail ao cliente cada resposta nossa</b>
          <span style={{ fontSize: 12.5, color: 'var(--sub)' }}>Vale para todos os admins. Desligado: a resposta fica salva e o cliente só a vê ao entrar no chamado pelo site. Na caixa de resposta dá para marcar ou desmarcar o envio de uma resposta específica.</span>
        </span>
      </label>
    </div>
  );
}
