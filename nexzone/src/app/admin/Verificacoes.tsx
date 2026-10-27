'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';

const dt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const COR: Record<string, string> = { pendente: '#B7791F', aprovado: '#00B87A', reprovado: '#E23B3B' };

// Admin → Verificações: identidade dos produtores (saque só depois de aprovado).
export default function Verificacoes({ onContagem }: { onContagem?: (n: number) => void }) {
  const [filtro, setFiltro] = useState<'pendente' | 'todos'>('pendente');
  const [d, setD] = useState<{ sql19: boolean; reforcado?: boolean; itens: any[] }>({ sql19: true, itens: [] });
  const [carregando, setCarregando] = useState(true);
  const [reprovar, setReprovar] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/admin/verificacoes?status=${filtro}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      setD({ sql19: j.sql19 !== false, reforcado: j.reforcado, itens: j.itens ?? [] }); onContagem?.(j.pendentes ?? 0);
    } catch { toast('Falha ao carregar.', 'error'); }
    finally { setCarregando(false); }
  }, [filtro, onContagem]);
  useEffect(() => { carregar(); }, [carregar]);

  async function decidir(userId: string, acao: 'aprovar' | 'reprovar') {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/verificacoes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, acao, motivo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return; }
      toast(acao === 'aprovar' ? 'Produtor verificado. Saques liberados.' : 'Verificação reprovada. O produtor foi avisado.', 'success');
      setReprovar(null); setMotivo(''); carregar();
    } finally { setBusy(false); }
  }

  if (!d.sql19) return <div className="adm-card"><b>Rode o SQL 19</b> no Supabase para ativar a verificação de produtores.</div>;
  return (
    <>
      <div className="adm-filters">
        <button className={`adm-fb ${filtro === 'pendente' ? 'on' : ''}`} onClick={() => setFiltro('pendente')}>Para analisar</button>
        <button className={`adm-fb ${filtro === 'todos' ? 'on' : ''}`} onClick={() => setFiltro('todos')}>Todas</button>
      </div>
      {!d.reforcado && <p style={{ color: 'var(--sub)', fontSize: 13, marginTop: -6 }}>O número completo do documento e a chave Pix aparecem só para admins com autorização reforçada.</p>}
      {carregando ? <div className="adm-empty">Carregando…</div> : !d.itens.length ? (
        <div className="adm-card adm-empty">{filtro === 'pendente' ? 'Nenhuma verificação esperando análise.' : 'Nenhuma verificação ainda.'}</div>
      ) : d.itens.map((v) => (
        <div key={v.user_id} className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontFamily: 'Outfit', fontSize: 16 }}>{v.nome}</b>
              <div style={{ color: 'var(--sub)', fontSize: 13 }}>
                {v.tipo === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'} · {v.documento}{v.nascimento ? ` · nasc. ${new Date(v.nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}{v.responsavel ? ` · resp.: ${v.responsavel}` : ''}
              </div>
              <div style={{ color: 'var(--sub)', fontSize: 13 }}>Loja: {v.loja || '—'} · Pix: {v.pix || 'não cadastrada'} · enviado em {dt(v.enviado_em)}</div>
            </div>
            <span className="adm-pill" style={{ background: `${COR[v.status]}22`, color: COR[v.status] }}>{v.status === 'pendente' ? 'Para analisar' : v.status === 'aprovado' ? 'Aprovado' : 'Reprovado'}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {(['frente', 'verso', 'selfie'] as const).map((k) => v.fotos?.[k] ? (
              <a key={k} href={v.fotos[k]} target="_blank" rel="noopener noreferrer" style={{ border: '1px solid var(--bd2)', borderRadius: 12, padding: 0, background: 'var(--panel2)', overflow: 'hidden', width: 150, textDecoration: 'none', display: 'block' }}>
                <img src={v.fotos[k]} alt={k} style={{ width: 150, height: 100, objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span style={{ display: 'block', fontSize: 12, padding: '4px 8px', color: 'var(--sub)', fontWeight: 800 }}>{k === 'frente' ? 'Frente' : k === 'verso' ? 'Verso' : 'Selfie'} · abrir ↗</span>
              </a>
            ) : null)}
          </div>
          {v.motivo && <div style={{ marginTop: 10, color: 'var(--sub)', fontSize: 13 }}>Motivo: {v.motivo}</div>}
          {v.status === 'pendente' && (reprovar === v.user_id ? (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={1000} placeholder="O que o produtor precisa corrigir (ex.: foto do documento cortada, nome diferente do documento)"
                style={{ width: '100%', borderRadius: 11, border: '1.5px solid var(--bd2)', background: 'var(--panel2)', color: 'var(--tx)', padding: 10, fontSize: 14 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="adm-btn ap" disabled={busy || motivo.trim().length < 10} onClick={() => decidir(v.user_id, 'reprovar')}>Reprovar e avisar</button>
                <button className="adm-btn rp" onClick={() => { setReprovar(null); setMotivo(''); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="adm-btn ap" disabled={busy} onClick={() => decidir(v.user_id, 'aprovar')}><Icon name="check" size={15} /> Aprovar</button>
              <button className="adm-btn rp" onClick={() => { setReprovar(v.user_id); setMotivo(''); }}><Icon name="x" size={15} /> Reprovar</button>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
