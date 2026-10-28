// ============================================================
// Recrutamento de produtores — parte do servidor:
//   • configuração (WhatsApp da equipe, Pixel do Meta, token da API de Conversões) guardada em settings
//   • envio dos eventos de Lead pela API de Conversões do Meta (com o mesmo event_id do navegador)
// O token fica cifrado (AES-GCM) e nunca volta para o navegador.
// ============================================================
import { createHash } from 'crypto';
import { cifrar, decifrar } from './whatsapp/config';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export type ConfigRecrutamento = { whatsapp: string; pixel: string; tokenDefinido: boolean; teste: string };
const CHAVES = ['recrut_whatsapp', 'recrut_pixel', 'recrut_capi', 'recrut_teste'];

const texto = (v: any) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export async function lerConfig(admin: any): Promise<ConfigRecrutamento & { token: string }> {
  try {
    const { data } = await admin.from('settings').select('key, value').in('key', CHAVES);
    const m: Record<string, any> = Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, r.value]));
    const bruto = texto(m.recrut_capi);
    let token = '';
    try { token = bruto ? decifrar(bruto) : ''; } catch { token = ''; }
    return {
      whatsapp: texto(m.recrut_whatsapp).replace(/\D/g, ''),
      pixel: texto(m.recrut_pixel).replace(/\D/g, ''),
      teste: texto(m.recrut_teste).replace(/[^A-Za-z0-9]/g, ''),
      tokenDefinido: !!token,
      token,
    };
  } catch {
    return { whatsapp: '', pixel: '', teste: '', tokenDefinido: false, token: '' };
  }
}

/** Valida e monta as linhas de settings a gravar (token em branco = mantém o atual). */
export function linhasDeConfig(b: any): { ok: true; linhas: { key: string; value: string }[] } | { ok: false; erro: string } {
  const linhas: { key: string; value: string }[] = [];
  if (b.whatsapp != null) {
    const w = String(b.whatsapp).replace(/\D/g, '');
    if (w && (w.length < 12 || w.length > 13)) return { ok: false, erro: 'WhatsApp: use 55 + DDD + número (ex.: 5563999998888).' };
    linhas.push({ key: 'recrut_whatsapp', value: w });
  }
  if (b.pixel != null) {
    const p = String(b.pixel).replace(/\D/g, '');
    if (p && (p.length < 10 || p.length > 20)) return { ok: false, erro: 'ID do Pixel inválido (só números, 15 ou 16 dígitos).' };
    linhas.push({ key: 'recrut_pixel', value: p });
  }
  if (b.teste != null) linhas.push({ key: 'recrut_teste', value: String(b.teste).replace(/[^A-Za-z0-9]/g, '').slice(0, 40) });
  if (b.limparToken === true) linhas.push({ key: 'recrut_capi', value: '' });
  else if (typeof b.token === 'string' && b.token.trim()) {
    const t = b.token.trim();
    if (!/^[A-Za-z0-9_-]{30,600}$/.test(t)) return { ok: false, erro: 'Token da API de Conversões inválido.' };
    linhas.push({ key: 'recrut_capi', value: cifrar(t) });
  }
  return { ok: true, linhas };
}

export type EventoLead = {
  nome: 'Lead' | 'LeadParcial' | 'Contact';
  eventId: string;
  url: string;
  ip: string | null;
  userAgent: string | null;
  fbp?: string | null;
  fbc?: string | null;
  pessoa: { nome?: string | null; whatsapp?: string | null; email?: string | null; id?: string | null };
  dados?: Record<string, any>;
};

/** Corpo do POST /{pixel}/events (puro; exportado para teste). */
export function corpoEventoLead(e: EventoLead, teste?: string) {
  const ud: Record<string, any> = { country: [sha('br')] };
  const partes = String(e.pessoa.nome || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (partes[0]) ud.fn = [sha(partes[0])];
  if (partes.length > 1) ud.ln = [sha(partes[partes.length - 1])];
  if (e.pessoa.email) ud.em = [sha(e.pessoa.email.trim().toLowerCase())];
  if (e.pessoa.whatsapp) ud.ph = [sha(e.pessoa.whatsapp.replace(/\D/g, ''))];
  if (e.pessoa.id) ud.external_id = [sha(e.pessoa.id)];
  if (e.ip) ud.client_ip_address = e.ip;
  if (e.userAgent) ud.client_user_agent = e.userAgent;
  if (e.fbp) ud.fbp = e.fbp;
  if (e.fbc) ud.fbc = e.fbc;
  return {
    data: [{
      event_name: e.nome,
      event_time: Math.floor(Date.now() / 1000),
      event_id: e.eventId,
      action_source: 'website',
      event_source_url: e.url,
      user_data: ud,
      custom_data: { content_name: 'Produtor fundador', content_category: 'recrutamento_produtores', ...(e.dados || {}) },
    }],
    ...(teste ? { test_event_code: teste } : {}),
  };
}

/** Envia ao Meta. Nunca lança erro: falha do Meta não pode travar o cadastro. */
export async function enviarEventoMeta(admin: any, e: EventoLead): Promise<boolean> {
  const cfg = await lerConfig(admin);
  if (!cfg.pixel || !cfg.token) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${cfg.pixel}/events?access_token=${encodeURIComponent(cfg.token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoEventoLead(e, cfg.teste || undefined)),
      signal: ctrl.signal, cache: 'no-store',
    });
    if (!r.ok) console.warn('[recrutamento] Meta respondeu', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return r.ok;
  } catch (err: any) {
    console.warn('[recrutamento] Meta falhou', String(err?.message || err).slice(0, 120));
    return false;
  } finally { clearTimeout(t); }
}

export const ipDaRequisicao = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || null;

/** Cookie _fbp / _fbc (ou monta o fbc a partir do fbclid do anúncio). */
export function cliquesMeta(req: Request, fbclid?: string | null) {
  const c = req.headers.get('cookie') || '';
  const pega = (n: string) => { const m = new RegExp(`(?:^|;\\s*)${n}=([^;]+)`).exec(c); return m ? decodeURIComponent(m[1]).slice(0, 255) : null; };
  const fbp = pega('_fbp');
  let fbc = pega('_fbc');
  if (!fbc && fbclid && /^[A-Za-z0-9_-]{10,255}$/.test(fbclid)) fbc = `fb.1.${Date.now()}.${fbclid}`;
  return { fbp, fbc };
}
