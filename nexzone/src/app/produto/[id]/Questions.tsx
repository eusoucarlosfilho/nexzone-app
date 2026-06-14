'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

type Q = {
  id: string; autor: string; autor_nome: string | null;
  pergunta: string; resposta: string | null; respondida_em: string | null; created_at: string;
};

const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Questions({ productId, initial, userId, loggedIn }: { productId: string; initial: Q[]; userId: string | null; loggedIn: boolean }) {
  const router = useRouter();
  const [lista, setLista] = useState<Q[]>(initial || []);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);

  async function recarregar() {
    try {
      const r = await fetch(`/api/questions?productId=${productId}`, { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d.questions)) setLista(d.questions);
    } catch {}
  }

  async function enviar() {
    if (!loggedIn) { router.push('/login'); return; }
    const t = texto.trim();
    if (t.length < 5) { toast('Escreva uma pergunta com pelo menos 5 caracteres.', 'error'); return; }
    setBusy(true);
    const r = await fetch('/api/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ productId, pergunta: t }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { setTexto(''); toast('Pergunta enviada! O vendedor será avisado.', 'success'); recarregar(); }
    else toast(d.error || 'Não foi possível enviar.', 'error');
  }

  return (
    <div className="pdp-sec">
      <h2>Perguntas e respostas</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
          maxLength={500}
          placeholder={loggedIn ? 'Tem uma dúvida? Pergunte ao vendedor…' : 'Entre para perguntar ao vendedor…'}
          style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--border)', padding: '0 14px', fontSize: 14, background: '#fff' }}
        />
        <button className="btn btn-dark" disabled={busy} onClick={enviar} style={{ flexShrink: 0 }}>
          {busy ? 'Enviando…' : 'Perguntar'}
        </button>
      </div>

      {lista.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>Nenhuma pergunta ainda. Seja o primeiro a perguntar!</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {lista.map((q) => (
            <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong style={{ fontFamily: 'Outfit', fontSize: 15 }}>
                  {q.autor === userId ? 'Você' : (q.autor_nome || 'Cliente')} perguntou:
                </strong>
                <span className="muted" style={{ fontSize: 12, flexShrink: 0 }}>{fmt(q.created_at)}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 4 }}>{q.pergunta}</div>

              {q.resposta ? (
                <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: '3px solid var(--orange, #FF6B00)' }}>
                  <strong style={{ fontFamily: 'Outfit', fontSize: 13, color: 'var(--orange, #FF6B00)' }}>Resposta do vendedor</strong>
                  <div style={{ fontSize: 14, color: 'var(--sub)', marginTop: 4 }}>{q.resposta}</div>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12, marginTop: 10, fontStyle: 'italic' }}>⏳ Aguardando resposta do vendedor</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
