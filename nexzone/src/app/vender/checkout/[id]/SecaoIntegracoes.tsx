'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';
import { EVENTOS_POSTBACK } from '@/lib/rastreioVenda';

// Construtor do checkout → "API de Conversões e postback" (Sprint 2).
// Campos de token são type="text" mascarados: com type="password" o Chrome colava a senha salva do site no token.
// Tem botão de salvar próprio: tokens e segredo vão criptografados para o servidor, nunca para a página.
const EXEMPLO = `{
  "evento": "venda_aprovada",
  "enviado_em": "2026-10-27T14:03:00.000Z",
  "pedido": { "id": "…", "status": "entregue", "total": 97, "moeda": "BRL", "criado_em": "…", "pago_em": "…" },
  "produto": { "id": "…", "titulo": "Nome do produto" },
  "itens_extras": [{ "id": "…", "titulo": "Order bump", "valor": 19.9 }],
  "comprador": { "nome": "Ana Souza", "email": "ana@email.com", "whatsapp": "5511999999999" },
  "origem": { "utm_source": "facebook", "utm_campaign": "black-friday" }
}`;

const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function SecaoIntegracoes({ productId, temPixelMeta, temPixelTiktok }: { productId: string; temPixelMeta: boolean; temPixelTiktok: boolean }) {
  const [d, setD] = useState<any>(null);
  const [metaToken, setMetaToken] = useState('');
  const [metaTeste, setMetaTeste] = useState('');
  const [tiktokToken, setTiktokToken] = useState('');
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<string[]>(['venda_aprovada']);
  const [segredo, setSegredo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function aplicar(j: any) {
    setD(j); setMetaTeste(j.metaTeste || ''); setUrl(j.postbackUrl || ''); setEventos(j.postbackEventos || ['venda_aprovada']);
    setMetaToken(''); setTiktokToken('');
  }
  useEffect(() => {
    fetch(`/api/seller/integracoes?productId=${encodeURIComponent(productId)}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json()).then(aplicar).catch(() => setD({ sql16: false }));
  }, [productId]);

  async function salvar(extra: Record<string, any> = {}, chave = 'salvar') {
    setBusy(chave);
    try {
      const r = await fetch('/api/seller/integracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ productId, metaToken, metaTeste, tiktokToken, postbackUrl: url, postbackEventos: eventos, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return; }
      aplicar(j);
      if (j.segredoNovo) setSegredo(j.segredoNovo);
      toast('Integrações salvas.', 'success');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(null); }
  }
  async function testar() {
    setBusy('teste');
    try {
      const r = await fetch('/api/seller/integracoes/teste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ productId }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) toast(`Teste entregue (HTTP ${j.status}).`, 'success');
      else toast(j.error || `O seu sistema respondeu ${j.status ?? 'sem resposta'}${j.resposta ? `: ${j.resposta}` : ''}`, 'error');
      const g = await fetch(`/api/seller/integracoes?productId=${encodeURIComponent(productId)}`, { credentials: 'include', cache: 'no-store' }).then((x) => x.json());
      setD(g);
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(null); }
  }
  const copiar = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Copiado!', 'success'));

  if (!d) return <section className="ce-sec"><span className="muted">Carregando integrações…</span></section>;
  if (!d.sql16) return <section className="ce-sec"><h3><Icon name="bolt" size={18} /> API de Conversões e postback</h3><p className="muted" style={{ fontSize: 13 }}>Disponível depois que o SQL 16 for aplicado.</p></section>;

  return (
    <section className="ce-sec">
      <h3><Icon name="bolt" size={18} /> API de Conversões e postback</h3>
      <p className="muted" style={{ fontSize: 13 }}>A venda aprovada também é enviada pelo nosso servidor: o Meta e o TikTok recebem a compra mesmo com bloqueador de anúncios ou iPhone. O evento tem o mesmo ID do pixel, então não conta em dobro.</p>

      <div className="fg"><label>Token da API de Conversões do Meta {d.metaToken && <span className="muted" style={{ fontWeight: 500 }}>· salvo {d.metaToken}</span>}</label>
        <input type="text" name="cb-meta-capi" autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true" style={{ WebkitTextSecurity: 'disc' } as any} value={metaToken} onChange={(e) => setMetaToken(e.target.value.trim())} placeholder={d.metaToken ? 'Deixe em branco para manter' : 'EAA…'} />
        <small className="muted" style={{ fontSize: 12 }}>Gerenciador de Eventos → seu pixel → Configurações → API de Conversões → Gerar token.{!temPixelMeta && ' Preencha também o ID do pixel na seção Tráfego pago.'}</small></div>
      <div className="fg2">
        <div className="fg"><label>Código de teste do Meta (opcional)</label>
          <input value={metaTeste} maxLength={20} onChange={(e) => setMetaTeste(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="TEST12345" />
          <small className="muted" style={{ fontSize: 12 }}>Só para conferir em “Testar eventos”. Apague depois.</small></div>
        <div className="fg"><label>Access Token da Events API do TikTok {d.tiktokToken && <span className="muted" style={{ fontWeight: 500 }}>· salvo {d.tiktokToken}</span>}</label>
          <input type="text" name="cb-tiktok-events" autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true" style={{ WebkitTextSecurity: 'disc' } as any} value={tiktokToken} onChange={(e) => setTiktokToken(e.target.value.trim())} placeholder={d.tiktokToken ? 'Deixe em branco para manter' : 'Cole o token'} />
          {!temPixelTiktok && <small className="muted" style={{ fontSize: 12 }}>Preencha também o pixel do TikTok em Tráfego pago.</small>}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        {d.metaToken && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => salvar({ limpar_metaToken: true, metaToken: '' }, 'lm')}>Remover token do Meta</button>}
        {d.tiktokToken && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => salvar({ limpar_tiktokToken: true, tiktokToken: '' }, 'lt')}>Remover token do TikTok</button>}
      </div>

      <div style={{ borderTop: '1px dashed var(--border)', marginTop: 12, paddingTop: 12 }}>
        <strong style={{ fontFamily: 'Outfit', fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="send" size={16} /> Postback (webhook)</strong>
        <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 8px' }}>Avisamos o seu sistema (n8n, Make, Zapier, ManyChat, área de membros…) a cada evento, com os dados do pedido e do comprador. Se o seu sistema não responder, tentamos de novo por até 15 horas.</p>
        <div className="fg"><label>Link do postback (https)</label>
          <input value={url} maxLength={500} inputMode="url" onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://seu-sistema.com/webhook/comprei-barato" /></div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13.5, marginBottom: 8 }}>
          {EVENTOS_POSTBACK.map((e) => (
            <label key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={eventos.includes(e.id)} onChange={(x) => setEventos((l) => (x.target.checked ? [...l, e.id] : l.filter((i) => i !== e.id)))} /> {e.rotulo}
            </label>
          ))}
        </div>
        {segredo && (
          <div className="ce-conf" style={{ cursor: 'default', marginTop: 0, marginBottom: 10, flexDirection: 'column', alignItems: 'stretch' }}>
            <b>Segredo de assinatura (aparece só agora):</b>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ flex: 1, wordBreak: 'break-all', fontSize: 12.5 }}>{segredo}</code>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(segredo)}><Icon name="copy" size={14} /> Copiar</button>
            </div>
            <span style={{ fontSize: 12 }}>Guarde no seu sistema para conferir o cabeçalho <code>X-CB-Assinatura</code>. Se perder, gere outro.</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-pri btn-sm" disabled={!!busy} onClick={() => salvar()}>{busy === 'salvar' ? 'Salvando…' : 'Salvar integrações'}</button>
          {d.postbackUrl && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={testar}>{busy === 'teste' ? 'Enviando…' : 'Enviar teste'}</button>}
          {d.postbackUrl && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => { if (confirm('Gerar um novo segredo? O antigo para de valer na hora.')) salvar({ gerarSegredo: true }, 'seg'); }}>Gerar novo segredo</button>}
        </div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>Como o postback chega</summary>
          <p className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}><b>POST</b> com JSON. Cabeçalhos: <code>X-CB-Evento</code> (venda_aprovada, pix_gerado, reembolso ou teste) e <code>X-CB-Assinatura: sha256=…</code> (HMAC-SHA256 do corpo com o seu segredo). Responda 2xx para confirmar.</p>
          <pre style={{ fontSize: 11.5, background: '#16161F', color: '#E6E6F0', borderRadius: 10, padding: 10, whiteSpace: 'pre-wrap', margin: 0 }}>{EXEMPLO}</pre>
        </details>
      </div>

      {Array.isArray(d.entregas) && d.entregas.length > 0 && (
        <div style={{ borderTop: '1px dashed var(--border)', marginTop: 12, paddingTop: 12 }}>
          <strong style={{ fontFamily: 'Outfit', fontSize: 14 }}>Últimos envios</strong>
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            {d.entregas.map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, color: e.ok ? 'var(--green)' : 'var(--red)' }}>{e.ok ? '✓' : '✗'}</span>
                <span style={{ minWidth: 64 }}>{e.destino === 'meta' ? 'Meta' : e.destino === 'tiktok' ? 'TikTok' : e.destino === 'postback_teste' ? 'Teste' : 'Postback'}</span>
                <span className="muted">{e.evento}</span>
                <span className="muted">{quando(e.created_at)}</span>
                {!e.ok && <span className="muted" style={{ flexBasis: '100%', paddingLeft: 18 }}>HTTP {e.http_status ?? '—'} {e.resposta}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
