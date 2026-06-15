'use client';
import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';

const PRI: Record<string, { label: string; cor: string }> = {
  importante: { label: 'Importante', cor: '#EF4444' },
  mediano: { label: 'Mediano', cor: '#F59E0B' },
  depois: { label: 'Fazer depois', cor: '#64748B' },
};
const ORDEM: Record<string, number> = { importante: 0, mediano: 1, depois: 2 };

function quando(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

export default function AdminNotes({ adminEmail }: { adminEmail?: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [prioridade, setPrioridade] = useState('mediano');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/notes');
      const j = await r.json();
      setNotes(Array.isArray(j.notes) ? j.notes : []);
    } catch { setNotes([]); }
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    const t = texto.trim();
    if (!t) { toast('Escreva a observação.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', texto: t, prioridade }),
      });
      const j = await r.json();
      if (j.ok) { setTexto(''); setPrioridade('mediano'); await carregar(); toast('Observação salva.'); }
      else toast(j.error || 'Falha ao salvar.');
    } catch { toast('Falha ao salvar.'); }
    setSaving(false);
  }

  async function toggle(id: string) {
    setBusy(id + ':t');
    try {
      await fetch('/api/admin/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id }),
      });
      await carregar();
    } catch {}
    setBusy('');
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta observação? Não dá pra desfazer.')) return;
    setBusy(id + ':d');
    try {
      await fetch('/api/admin/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      await carregar();
    } catch {}
    setBusy('');
  }

  // Pendentes primeiro, depois por prioridade, depois mais recentes.
  const ordenadas = [...notes].sort((a, b) => {
    if (!!a.feito !== !!b.feito) return a.feito ? 1 : -1;
    const pa = ORDEM[a.prioridade] ?? 1, pb = ORDEM[b.prioridade] ?? 1;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  const pendentes = notes.filter((n) => !n.feito).length;

  return (
    <div>
      <h1 className="an-h">Observações da administração</h1>
      <p className="an-sub">
        Quadro de recados entre administradores. Anote tarefas e avisos do site — fica registrado quem escreveu e quando.
        {pendentes > 0 && <> Há <strong style={{ color: 'var(--or2)' }}>{pendentes}</strong> pendente(s).</>}
      </p>

      <div className="an-card">
        <textarea
          className="an-ta" rows={3} value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma observação, tarefa ou recado para os outros admins..."
        />
        <div className="an-formrow">
          <div className="an-pris">
            {Object.entries(PRI).map(([k, v]) => (
              <button
                key={k} type="button"
                className={`an-prib ${prioridade === k ? 'on' : ''}`}
                onClick={() => setPrioridade(k)}
                style={prioridade === k ? { background: v.cor + '22', color: v.cor, borderColor: v.cor + '66' } : undefined}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button className="an-save" disabled={saving} onClick={salvar}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>

      {loading ? (
        <div className="an-empty">Carregando...</div>
      ) : ordenadas.length === 0 ? (
        <div className="an-empty">Nenhuma observação ainda. Escreva a primeira aí em cima.</div>
      ) : (
        <div className="an-list">
          {ordenadas.map((n) => {
            const pri = PRI[n.prioridade] || PRI.mediano;
            return (
              <div key={n.id} className={`an-item ${n.feito ? 'done' : ''}`}>
                <div className="an-itop">
                  <span className="an-badge" style={{ background: pri.cor + '22', color: pri.cor }}>{pri.label}</span>
                  {n.feito && <span className="an-badge" style={{ background: '#10B98122', color: '#10B981' }}>Feito</span>}
                </div>
                <div className="an-txt">{n.texto}</div>
                <div className="an-meta">
                  <span>{n.autor_email || 'admin'} · {quando(n.created_at)}</span>
                  <div className="an-acts">
                    <button className="an-mini" disabled={busy === n.id + ':t'} onClick={() => toggle(n.id)}>
                      {n.feito ? 'Desfazer' : 'Marcar feito'}
                    </button>
                    <button className="an-mini del" disabled={busy === n.id + ':d'} onClick={() => excluir(n.id)}>Excluir</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .an-h{font-family:'Outfit';font-weight:800;font-size:26px;margin:0 0 6px;color:var(--tx);}
        .an-sub{color:var(--sub);font-size:14px;margin:0 0 20px;max-width:640px;line-height:1.5;}
        .an-card{background:var(--panel);border:1px solid var(--bd2);border-radius:16px;padding:18px;margin-bottom:22px;}
        .an-ta{width:100%;background:var(--panel2);border:1px solid var(--bd2);border-radius:11px;padding:12px 14px;font-size:14px;font-family:inherit;color:var(--tx);resize:vertical;box-sizing:border-box;}
        .an-ta:focus{outline:none;border-color:var(--or2);}
        .an-formrow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap;}
        .an-pris{display:flex;gap:8px;flex-wrap:wrap;}
        .an-prib{font-family:'Outfit';font-weight:700;font-size:12px;padding:7px 13px;border-radius:50px;background:var(--panel2);color:var(--sub);border:1px solid var(--bd2);cursor:pointer;}
        .an-save{font-family:'Outfit';font-weight:700;font-size:13px;padding:9px 22px;border-radius:9px;border:none;cursor:pointer;background:var(--grad);color:#fff;}
        .an-save:disabled{opacity:.5;}
        .an-list{display:flex;flex-direction:column;gap:12px;}
        .an-item{background:var(--panel);border:1px solid var(--bd2);border-radius:14px;padding:16px 18px;}
        .an-item.done{opacity:.62;}
        .an-itop{display:flex;gap:7px;margin-bottom:9px;flex-wrap:wrap;}
        .an-badge{font-size:11px;font-weight:800;font-family:'Outfit';padding:3px 11px;border-radius:50px;white-space:nowrap;}
        .an-txt{font-size:14.5px;color:var(--tx);line-height:1.5;white-space:pre-wrap;word-break:break-word;}
        .an-item.done .an-txt{text-decoration:line-through;}
        .an-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px;flex-wrap:wrap;}
        .an-meta>span{font-size:12px;color:var(--sub);font-weight:600;word-break:break-all;}
        .an-acts{display:flex;gap:8px;}
        .an-mini{font-family:'Outfit';font-weight:700;font-size:12px;padding:6px 12px;border-radius:8px;background:none;border:1px solid var(--bd2);color:var(--sub);cursor:pointer;}
        .an-mini:disabled{opacity:.5;}
        .an-mini.del{color:#EF4444;border-color:#EF444455;}
        .an-empty{text-align:center;color:var(--sub);padding:40px;font-size:14px;background:var(--panel);border:1px solid var(--bd2);border-radius:16px;}
      `}</style>
    </div>
  );
}
