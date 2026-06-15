'use client';
import { useEffect, useState } from 'react';

type Notice = { id: string; tipo: string; texto: string; created_at: string };

export default function NoticeBanner() {
  const [status, setStatus] = useState<string>('ativo');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/notices', { credentials: 'include' });
        if (!r.ok) return;
        const d = await r.json();
        setStatus(d.status || 'ativo');
        setNotices(d.notices || []);
      } catch {} finally { setCarregou(true); }
    })();
  }, []);

  async function dispensar() {
    setNotices([]);
    try { await fetch('/api/notices', { method: 'POST', credentials: 'include' }); } catch {}
  }

  if (!carregou) return null;
  const temRestricao = status === 'restrito';
  if (!temRestricao && notices.length === 0) return null;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {temRestricao && (
        <div style={{ background: '#FFF4E5', border: '1px solid #F2B65A', color: '#8A5800', borderRadius: 12, padding: '12px 14px', fontSize: 13.5 }}>
          ⚠️ <strong>Sua conta está restrita.</strong> Você ainda pode comprar, mas <strong>não pode vender nem sacar</strong> no momento. Fale com o suporte se tiver dúvidas.
        </div>
      )}
      {notices.map((n) => {
        const adv = n.tipo === 'advertencia';
        return (
          <div key={n.id} style={{
            background: adv ? '#FDECEC' : '#EAF2FF',
            border: `1px solid ${adv ? '#E79A9A' : '#A8C6F0'}`,
            color: adv ? '#9A2A2A' : '#1F4E8A',
            borderRadius: 12, padding: '12px 14px', fontSize: 13.5, display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
              {adv ? '🚨 Advertência: ' : '📢 Aviso do suporte: '}{n.texto}
            </span>
          </div>
        );
      })}
      {notices.length > 0 && (
        <div>
          <button onClick={dispensar} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            Marcar como lido
          </button>
        </div>
      )}
    </div>
  );
}
