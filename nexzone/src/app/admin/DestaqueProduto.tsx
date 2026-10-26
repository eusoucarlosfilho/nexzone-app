'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// Admin → Produtos → Gerenciar: coloca o produto na faixa de destaque do topo da página inicial.
const PRAZOS = [7, 15, 30, 60, 90];

export default function DestaqueProduto({ id }: { id: string }) {
  const [ate, setAte] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dias, setDias] = useState(30);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/feature?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (!vivo) return;
        if (!ok) { setErro(j.error || 'Indisponível.'); return; }
        setAte(j.destaque_ate ?? null); setStatus(j.status || ''); setCarregado(true);
      })
      .catch(() => vivo && setErro('Falha de conexão.'));
    return () => { vivo = false; };
  }, [id]);

  async function salvar(d: number) {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/feature', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, dias: d }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha ao salvar.', 'error'); return; }
      setAte(j.destaque_ate ?? null);
      toast(d > 0 ? 'Produto no destaque da página inicial.' : 'Destaque removido.', 'success');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(false); }
  }

  const ativo = !!ate && new Date(ate).getTime() > Date.now();
  return (
    <div className="pg-sec">
      <h4>Destaque na página inicial</h4>
      {erro ? <div className="pg-help" style={{ color: '#FF8A8A' }}>{erro}</div> : !carregado ? <div className="pg-help">Carregando…</div> : (
        <>
          <div className="pg-row">
            {ativo
              ? <span style={{ fontSize: 14 }}>Em destaque até <b>{new Date(ate!).toLocaleDateString('pt-BR')}</b></span>
              : <span className="muted" style={{ fontSize: 14 }}>Fora do destaque</span>}
          </div>
          <div className="pg-row" style={{ marginTop: 8 }}>
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Prazo do destaque"
              style={{ height: 40, borderRadius: 10, border: '1px solid var(--bd2)', padding: '0 10px', background: 'var(--panel)', color: 'var(--tx)' }}>
              {PRAZOS.map((p) => <option key={p} value={p}>{p} dias</option>)}
            </select>
            <button type="button" className="adm-btn ap" disabled={busy} onClick={() => salvar(dias)}>{busy ? 'Salvando…' : ativo ? 'Renovar destaque' : 'Destacar'}</button>
            {ativo && <button type="button" className="adm-btn" disabled={busy} onClick={() => salvar(0)}>Tirar do destaque</button>}
          </div>
          <div className="pg-help">
            Aparece na faixa do topo da página inicial, antes de tudo.{status !== 'ativo' ? ' Este produto não está ativo: o destaque só aparece quando ele estiver publicado.' : ''}
            {' '}Destaque só produtos com a entrega cadastrada.
          </div>
        </>
      )}
    </div>
  );
}
