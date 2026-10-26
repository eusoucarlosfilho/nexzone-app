'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { acharEvento } from '@/lib/whatsapp/eventos';

// Histórico de envios por WhatsApp (aba Torpedos enviados), com reenvio dos que falharam ou foram adiados.
type Linha = { id: number; evento: string; destino: string; status: string; erro: string | null; tentativas: number; created_at: string };
const COR: Record<string, string> = { enviado: 'var(--green)', falhou: '#E23B3B', adiado: '#C98A00', enviando: 'var(--sub)' };
const ROT: Record<string, string> = { enviado: 'Enviado', falhou: 'Falhou', adiado: 'Adiado', enviando: 'Enviando' };
const nomeEvento = (k: string) => (k === 'promocao' ? 'Promoção' : k === 'teste' ? 'Teste' : acharEvento(k)?.rotulo || k);

export default function WhatsAppLog() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/admin/whatsapp/log${filtro ? `?status=${filtro}` : ''}`, { credentials: 'include', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(d.error || 'Indisponível.'); setLinhas([]); return; }
    setErro(null); setLinhas(d.linhas || []);
  }, [filtro]);
  useEffect(() => { carregar(); }, [carregar]);

  async function reenviar(id: number) {
    setOcupado(id);
    const r = await fetch('/api/admin/whatsapp/reenviar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const d = await r.json().catch(() => ({}));
    setOcupado(null);
    if (r.ok) toast('Reenviado.', 'success'); else toast(d.error || 'Falhou de novo.', 'error');
    carregar();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '18px 0 10px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 16 }}>WhatsApp · histórico</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por situação" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel, #fff)', color: 'inherit' }}>
            <option value="">Todos</option><option value="enviado">Enviados</option><option value="falhou">Falharam</option><option value="adiado">Adiados</option>
          </select>
          <button className="adm-btn" onClick={carregar}>Atualizar</button>
        </div>
      </div>
      {erro && <div className="adm-card"><p style={{ color: 'var(--sub)', padding: 8 }}>{erro}</p></div>}
      {linhas && linhas.length === 0 && !erro && <div className="adm-card"><p style={{ color: 'var(--sub)', textAlign: 'center', padding: 18 }}>Nenhum WhatsApp enviado ainda.</p></div>}
      {linhas && linhas.length > 0 && (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          {linhas.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'var(--panel2)', color: 'var(--sub)' }}>whatsapp</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 13.5 }}>{nomeEvento(l.evento)}</div>
                <div style={{ color: 'var(--sub)', fontSize: 12 }}>{l.destino} · {new Date(l.created_at).toLocaleString('pt-BR')}{l.tentativas > 1 ? ` · ${l.tentativas} tentativas` : ''}{l.erro ? ` · ${l.erro}` : ''}</div>
              </div>
              <span style={{ color: COR[l.status] || 'var(--sub)', fontWeight: 700, fontSize: 12.5 }}>{ROT[l.status] || l.status}</span>
              {(l.status === 'falhou' || l.status === 'adiado') && <button className="adm-btn" disabled={ocupado === l.id} onClick={() => reenviar(l.id)}>Reenviar</button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
