'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';
import { validarRastreio, type RastreioProduto } from '@/lib/rastreioVenda';

// Construtor do checkout → "Tráfego pago": pixels, página de obrigado e link de checkout com UTM.
const SITE = 'https://www.compreibarato.com.br';

// Script para a página de vendas do produtor: repassa UTM/fbclid/ttclid/gclid da URL dele
// para todos os links de checkout do Comprei Barato. Texto fixo (não tem nada do usuário).
const SCRIPT_REPASSE = `<script>
(function(){var q=new URLSearchParams(location.search),k=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck','fbclid','ttclid','gclid'],p=[];
k.forEach(function(x){var v=q.get(x);if(v)p.push(x+'='+encodeURIComponent(v))});if(!p.length)return;
document.querySelectorAll('a[href*="compreibarato.com.br/checkout/"]').forEach(function(a){a.href+=(a.href.indexOf('?')<0?'?':'&')+p.join('&')});})();
</script>`;

export default function SecaoRastreio({ productId, valor, onValor }: { productId: string; valor: RastreioProduto; onValor: (r: RastreioProduto) => void }) {
  const [utm, setUtm] = useState({ source: 'facebook', medium: 'cpc', campaign: '', content: '' });
  const erro = validarRastreio(valor);
  const set = (p: Partial<RastreioProduto>) => onValor({ ...valor, ...p });

  const link = (() => {
    const sp = new URLSearchParams();
    if (utm.source) sp.set('utm_source', utm.source);
    if (utm.medium) sp.set('utm_medium', utm.medium);
    if (utm.campaign) sp.set('utm_campaign', utm.campaign);
    if (utm.content) sp.set('utm_content', utm.content);
    const q = sp.toString();
    return `${SITE}/checkout/${productId}${q ? `?${q}` : ''}`;
  })();
  const copiar = (t: string, m: string) => navigator.clipboard?.writeText(t).then(() => toast(m, 'success'), () => toast('Não consegui copiar. Selecione e copie manualmente.', 'error'));

  return (
    <section className="ce-sec">
      <h3><Icon name="target" size={18} /> Tráfego pago: pixels e página de obrigado</h3>
      <p className="muted" style={{ fontSize: 13 }}>Para quem anuncia: o checkout avisa seus pixels quando a pessoa começa a compra, escolhe pagar e quando o pagamento é aprovado.</p>

      <div className="fg2">
        <div className="fg"><label>Pixel do Meta (Facebook/Instagram)</label>
          <input value={valor.meta} inputMode="numeric" maxLength={20} placeholder="Ex.: 1234567890123456" onChange={(e) => set({ meta: e.target.value.replace(/\D/g, '') })} /></div>
        <div className="fg"><label>Pixel do TikTok</label>
          <input value={valor.tiktok} maxLength={30} placeholder="Ex.: C4A1B2C3D4E5F6G7H8I9" onChange={(e) => set({ tiktok: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></div>
      </div>
      <div className="fg2">
        <div className="fg"><label>Google Analytics 4 (opcional)</label>
          <input value={valor.ga4} maxLength={20} placeholder="G-ABC123XYZ" onChange={(e) => set({ ga4: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} /></div>
        <div className="fg"><label>Google Ads: ID e rótulo da conversão (opcional)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={valor.adsId} maxLength={20} placeholder="AW-123456789" onChange={(e) => set({ adsId: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} />
            <input value={valor.adsLabel} maxLength={60} placeholder="Rótulo" onChange={(e) => set({ adsLabel: e.target.value.replace(/[^A-Za-z0-9_-]/g, '') })} />
          </div></div>
      </div>
      <div className="fg"><label>Página de obrigado (opcional)</label>
        <input value={valor.obrigadoUrl} maxLength={500} inputMode="url" placeholder="https://suapagina.com/obrigado" onChange={(e) => set({ obrigadoUrl: e.target.value.trim() })} />
        <small className="muted" style={{ fontSize: 12 }}>Depois do pagamento, o comprador é levado para esta página (com ?pedido=…&amp;produto=…). O acesso ao produto continua no pedido e no e-mail dele.</small></div>
      {erro && <div className="ce-conf" style={{ marginTop: 0, cursor: 'default', background: 'var(--red-bg)' }}><Icon name="alert" size={16} /> <span>{erro}</span></div>}

      <div style={{ borderTop: '1px dashed var(--border)', marginTop: 14, paddingTop: 14 }}>
        <strong style={{ fontFamily: 'Outfit', fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="link" size={16} /> Link de checkout com UTM</strong>
        <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 8px' }}>Use no botão da sua página de vendas ou direto no anúncio. Cada venda fica marcada com a campanha em <b>Vendas → Vendas por origem</b>.</p>
        <div className="fg2">
          <div className="fg"><label>Origem (utm_source)</label><input value={utm.source} maxLength={60} onChange={(e) => setUtm({ ...utm, source: e.target.value })} /></div>
          <div className="fg"><label>Mídia (utm_medium)</label><input value={utm.medium} maxLength={60} onChange={(e) => setUtm({ ...utm, medium: e.target.value })} /></div>
        </div>
        <div className="fg2">
          <div className="fg"><label>Campanha (utm_campaign)</label><input value={utm.campaign} maxLength={80} placeholder="black-friday" onChange={(e) => setUtm({ ...utm, campaign: e.target.value })} /></div>
          <div className="fg"><label>Anúncio (utm_content)</label><input value={utm.content} maxLength={80} placeholder="video-01" onChange={(e) => setUtm({ ...utm, content: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ flex: '1 1 260px', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', wordBreak: 'break-all' }}>{link}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(link, 'Link copiado!')}><Icon name="copy" size={14} /> Copiar link</button>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13.5 }}>Tem página de vendas própria? Repasse as UTMs automaticamente</summary>
          <p className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}>Cole este código no fim da sua página de vendas (antes de &lt;/body&gt;). Ele copia as UTMs e os identificadores de clique (fbclid, ttclid, gclid) do anúncio para todos os botões que levam ao checkout do Comprei Barato.</p>
          <pre style={{ fontSize: 11.5, background: '#16161F', color: '#E6E6F0', borderRadius: 10, padding: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{SCRIPT_REPASSE}</pre>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => copiar(SCRIPT_REPASSE, 'Código copiado!')}><Icon name="copy" size={14} /> Copiar código</button>
        </details>
      </div>
    </section>
  );
}
