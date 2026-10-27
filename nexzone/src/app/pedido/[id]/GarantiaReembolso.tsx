'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { MOTIVOS, rotuloMotivo, diasRestantes } from '@/lib/garantia';

export type GarantiaInfo = {
  dias: number;
  ate: string | null;
  pode: boolean;
  motivo: string | null;
  pedidos: { id: number; status: string; motivo: string; detalhe: string | null; resposta: string | null; created_at: string; decidido_em: string | null }[];
};

const dataBR = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

// Garantia na página do pedido: prazo, botão "Pedir reembolso" e o andamento do pedido.
export default function GarantiaReembolso({ orderId, g }: { orderId: string; g: GarantiaInfo }) {
  const [abrir, setAbrir] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const ultimo = g.pedidos[0] || null;
  const restam = g.ate ? diasRestantes(new Date(g.ate)) : 0;
  const precisaDetalhe = ['nao_era_o_esperado', 'problema_tecnico', 'outro'].includes(motivo);

  async function enviar(corpo: any, ok: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/reembolso', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, ...corpo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível enviar.', 'error'); return; }
      toast(ok, 'success'); setAbrir(false); router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="gr">
      <style dangerouslySetInnerHTML={{ __html: `
        .gr{border-top:1px solid var(--border);margin-top:22px;padding-top:18px}
        .gr-h{display:flex;gap:10px;align-items:flex-start}
        .gr-ic{width:36px;height:36px;border-radius:11px;background:var(--green-bg);color:var(--green);display:flex;align-items:center;justify-content:center;flex:none}
        .gr-h b{font-family:'Outfit';font-size:15px;display:block}
        .gr-h small{color:var(--sub);font-size:13px}
        .gr-st{margin-top:12px;border-radius:14px;padding:12px 14px;font-size:14px}
        .gr-st.aberto{background:#FFF7E8;border:1px solid #F2C46D}
        .gr-st.aprovado{background:var(--green-bg);border:1px solid #9FD9BF}
        .gr-st.recusado{background:var(--red-bg);border:1px solid #F0B4B4}
        .gr-form{margin-top:12px;display:grid;gap:10px}
        .gr-form label.op{display:flex;gap:10px;align-items:center;border:1.5px solid var(--border2);border-radius:12px;padding:10px 12px;cursor:pointer;font-size:14px;font-weight:700}
        .gr-form label.op.on{border-color:var(--orange);background:var(--soft)}
        .gr-form textarea{width:100%;border:1.5px solid var(--border2);border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit}
        .gr-lnk{background:none;border:0;padding:0;color:var(--sub);text-decoration:underline;font-size:13px;cursor:pointer;margin-top:10px}
      ` }} />
      <div className="gr-h">
        <span className="gr-ic"><Icon name="shield" size={18} /></span>
        <div>
          <b>Garantia de {g.dias} dias</b>
          <small>{g.ate ? (restam > 0 ? `Você pode pedir reembolso até ${dataBR(g.ate)} (${restam} dia${restam === 1 ? '' : 's'}).` : `Encerrada em ${dataBR(g.ate)}.`) : 'Vale a partir da confirmação do pagamento.'}</small>
        </div>
      </div>

      {ultimo && ultimo.status !== 'cancelado' && (
        <div className={`gr-st ${ultimo.status}`} role="status">
          {ultimo.status === 'aberto' && <><b>Pedido de reembolso em análise.</b> Motivo: {rotuloMotivo(ultimo.motivo)}. A equipe responde por aqui e no sino de notificações, normalmente em até 2 dias úteis.
            <div><button type="button" className="gr-lnk" disabled={busy} onClick={() => { if (confirm('Desistir do pedido de reembolso?')) enviar({ acao: 'cancelar' }, 'Pedido de reembolso cancelado.'); }}>Desistir do reembolso</button></div></>}
          {ultimo.status === 'aprovado' && <><b>Reembolso aprovado.</b> O valor volta pela mesma forma de pagamento: no Pix, na conta de origem; no cartão, pode levar até 2 faturas.{ultimo.resposta ? <><br />{ultimo.resposta}</> : null}</>}
          {ultimo.status === 'recusado' && <><b>Reembolso não aprovado.</b> {ultimo.resposta}</>}
        </div>
      )}

      {g.pode && !abrir && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setAbrir(true)}><Icon name="undo" size={15} /> Pedir reembolso</button>
      )}
      {g.pode && abrir && (
        <div className="gr-form">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Antes, vale tentar falar com o vendedor pela conversa acima: muitos problemas se resolvem na hora. Se preferir o reembolso, escolha o motivo:</p>
          <div role="radiogroup" aria-label="Motivo" style={{ display: 'grid', gap: 6 }}>
            {MOTIVOS.map((m) => (
              <label key={m.id} className={`op ${motivo === m.id ? 'on' : ''}`}><input type="radio" name="motivo" checked={motivo === m.id} onChange={() => setMotivo(m.id)} /> {m.rotulo}</label>
            ))}
          </div>
          {motivo && <textarea rows={3} maxLength={2000} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder={precisaDetalhe ? 'Conte o que aconteceu (obrigatório)' : 'Quer contar algo mais? (opcional)'} />}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-pri btn-sm" disabled={busy || !motivo || (precisaDetalhe && detalhe.trim().length < 10)} onClick={() => enviar({ motivo, detalhe }, 'Pedido de reembolso enviado.')}>{busy ? 'Enviando…' : 'Enviar pedido de reembolso'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbrir(false)}>Voltar</button>
          </div>
        </div>
      )}
      {!g.pode && !ultimo && g.motivo && g.ate && restam === 0 && <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>{g.motivo}</p>}
    </div>
  );
}
