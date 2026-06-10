'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { salvarCheckoutConfig } from './actions';
import { toast } from '@/lib/toast';
import CoverUpload from '../../produtos/CoverUpload';

export default function CheckoutEditor({ productId, userId, titulo, inicial }: any) {
  const router = useRouter();
  const c = inicial || {};
  const [headline, setHeadline] = useState(c.headline || '');
  const [subtitle, setSubtitle] = useState(c.subtitle || '');
  const [banner, setBanner] = useState(c.banner_url || '');
  const [cor, setCor] = useState(c.cor || '#FF6B00');
  const [badge, setBadge] = useState(c.badge_text || '');
  const [countdown, setCountdown] = useState(c.countdown_until ? c.countdown_until.slice(0, 16) : '');
  const [busy, setBusy] = useState(false);

  async function salvar(limpar = false) {
    setBusy(true);
    const config = limpar ? null : {
      headline: headline.trim() || null,
      subtitle: subtitle.trim() || null,
      banner_url: banner || null,
      cor: cor || null,
      badge_text: badge.trim() || null,
      countdown_until: countdown ? new Date(countdown).toISOString() : null,
    };
    const r: any = await salvarCheckoutConfig(productId, config);
    setBusy(false);
    if (r?.ok) { toast(limpar ? 'Personalização removida.' : 'Checkout personalizado salvo!', 'success'); router.refresh(); }
    else toast(r?.error || 'Erro ao salvar', 'error');
  }

  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <p className="muted" style={{ marginBottom: 18 }}>Personalize a página de checkout de <strong>{titulo}</strong>. Deixe em branco para usar o padrão.</p>

      <div className="fg"><label>Título de destaque (headline)</label><input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Ex: Garanta seu acesso com desconto" /></div>
      <div className="fg"><label>Subtítulo</label><textarea rows={2} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex: Oferta especial por tempo limitado." /></div>

      <div className="fg"><label>Banner do checkout (opcional)</label>
        <CoverUpload userId={userId} value={banner} onUploaded={setBanner} hint="Larga, recomendado 1200×400px (JPG)" />
      </div>

      <div className="fg2">
        <div className="fg"><label>Cor de destaque</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ width: 52, height: 40, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
            <span className="muted" style={{ fontSize: 13 }}>{cor}</span>
          </div>
        </div>
        <div className="fg"><label>Selo/etiqueta (opcional)</label><input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Ex: Oferta de lançamento" /></div>
      </div>

      <div className="fg"><label>Contador regressivo — data e hora de fim (opcional)</label>
        <input type="datetime-local" value={countdown} onChange={(e) => setCountdown(e.target.value)} />
        <small className="muted" style={{ fontSize: 12 }}>⏳ O contador é real: conta até essa data e, quando chega, a oferta é marcada como encerrada (sem reiniciar).</small>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-pri" disabled={busy} onClick={() => salvar(false)}>{busy ? 'Salvando…' : 'Salvar personalização'}</button>
        <a className="btn btn-ghost" href={`/checkout/${productId}`} target="_blank" rel="noreferrer">Ver checkout</a>
        <button className="btn btn-ghost" disabled={busy} onClick={() => salvar(true)} style={{ color: 'var(--red)' }}>Limpar</button>
      </div>
    </div>
  );
}
