'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

type Q = {
  id: string; autor_nome: string | null; pergunta: string; resposta: string | null;
  respondida_em: string | null; created_at: string; produto: string; emoji: string;
};
const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function PerguntasClient({ perguntas }: { perguntas: Q[] }) {
  const [lista, setLista] = useState<Q[]>(perguntas);
  const [aberto, setAberto] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState<'pendentes' | 'todas'>('pendentes');

  const pendentes = lista.filter((q) => !q.resposta);
  const exibidas = filtro === 'pendentes' ? pendentes : lista;

  async function responder(id: string) {
    const t = texto.trim();
    if (!t) { toast('Escreva uma resposta.', 'error'); return; }
    setBusy(true);
    const r = await fetch('/api/questions/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ questionId: id, resposta: t }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) {
      setLista((ls) => ls.map((q) => q.id === id ? { ...q, resposta: t, respondida_em: new Date().toISOString() } : q));
      setAberto(null); setTexto('');
      toast('Resposta enviada! O cliente será avisado.', 'success');
    } else toast(d.error || 'Erro ao responder.', 'error');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 900 }}>Perguntas</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => setFiltro('pendentes')}
            style={{ background: filtro === 'pendentes' ? 'var(--orange, #FF6B00)' : '#fff', color: filtro === 'pendentes' ? '#fff' : 'var(--sub)', border: '1px solid var(--border)' }}>
            Pendentes {pendentes.length ? `(${pendentes.length})` : ''}
          </button>
          <button className="btn btn-sm" onClick={() => setFiltro('todas')}
            style={{ background: filtro === 'todas' ? 'var(--orange, #FF6B00)' : '#fff', color: filtro === 'todas' ? '#fff' : 'var(--sub)', border: '1px solid var(--border)' }}>
            Todas
          </button>
        </div>
      </div>

      {exibidas.length === 0 ? (
        <p className="muted">{filtro === 'pendentes' ? 'Nenhuma pergunta pendente. 🎉' : 'Nenhuma pergunta ainda.'}</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {exibidas.map((q) => (
            <div key={q.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{q.emoji} {q.produto} · {fmt(q.created_at)}</div>
              <div style={{ fontSize: 14 }}><strong style={{ fontFamily: 'Outfit' }}>{q.autor_nome || 'Cliente'}:</strong> {q.pergunta}</div>

              {q.resposta ? (
                <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '3px solid var(--orange, #FF6B00)' }}>
                  <strong style={{ fontFamily: 'Outfit', fontSize: 12, color: 'var(--orange, #FF6B00)' }}>Sua resposta</strong>
                  <div style={{ fontSize: 14, color: 'var(--sub)', marginTop: 3 }}>{q.resposta}</div>
                </div>
              ) : aberto === q.id ? (
                <div style={{ marginTop: 10 }}>
                  <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000}
                    placeholder="Escreva sua resposta…" autoFocus
                    style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', padding: 10, fontSize: 14, marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-pri btn-sm" disabled={busy} onClick={() => responder(q.id)}>{busy ? 'Enviando…' : 'Enviar resposta'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAberto(null); setTexto(''); }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-dark btn-sm" style={{ marginTop: 10 }} onClick={() => { setAberto(q.id); setTexto(''); }}>Responder</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
