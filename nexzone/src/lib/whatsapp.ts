// Camada ÚNICA de acesso ao provedor de WhatsApp. O resto do site só usa estas funções.
// Provedor atual: Evolution API v2 (sessão por QR Code mantida FORA da Vercel, ex.: Railway).
// Para trocar de provedor (Z-API, API oficial da Meta), basta implementar este mesmo contrato.
// SÓ SERVIDOR: usa a chave do provedor.
import { lerChave, lerConfig, type ConfigWhatsApp } from '@/lib/whatsapp/config';

export type StatusConexao = { estado: 'desconectado' | 'aguardando_qr' | 'conectado' | 'nao_configurado' | 'erro'; numero: string | null; detalhe?: string };
export type ResultadoEnvio = { ok: true; id: string | null } | { ok: false; erro: string };

type Ctx = { cfg: ConfigWhatsApp; chave: string };

async function contexto(): Promise<Ctx | null> {
  const [cfg, chave] = await Promise.all([lerConfig(), lerChave()]);
  if (!cfg.apiUrl || !chave) return null;
  return { cfg, chave };
}

async function chamar(ctx: Ctx, metodo: 'GET' | 'POST' | 'DELETE', caminho: string, corpo?: unknown, tempoMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), tempoMs);
  try {
    const r = await fetch(ctx.cfg.apiUrl + caminho, {
      method: metodo,
      headers: { apikey: ctx.chave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    let dados: any = null;
    try { dados = await r.json(); } catch { dados = null; }
    return { ok: r.ok, status: r.status, dados };
  } catch (e: any) {
    return { ok: false, status: 0, dados: { message: e?.name === 'AbortError' ? 'tempo esgotado' : 'sem conexão com o provedor' } };
  } finally {
    clearTimeout(t);
  }
}

const erroDe = (r: { status: number; dados: any }) => {
  const m = r.dados?.response?.message ?? r.dados?.message ?? r.dados?.error;
  const txt = Array.isArray(m) ? m.join('; ') : typeof m === 'string' ? m : '';
  return (txt || `erro ${r.status || 'de conexão'}`).slice(0, 300);
};
const inst = (ctx: Ctx) => encodeURIComponent(ctx.cfg.instancia);

/** Cria a instância no provedor (idempotente: se já existir, segue). */
export async function createInstance(): Promise<{ ok: boolean; erro?: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: 'Configure a URL e a chave do provedor.' };
  const r = await chamar(ctx, 'POST', '/instance/create', { instanceName: ctx.cfg.instancia, integration: 'WHATSAPP-BAILEYS', qrcode: true });
  if (r.ok || r.status === 403 || /already|exist|em uso|in use/i.test(erroDe(r))) return { ok: true };
  return { ok: false, erro: erroDe(r) };
}

/** QR Code atual (imagem base64) para escanear em Aparelhos conectados. */
export async function getQrCode(): Promise<{ ok: true; qr: string | null; codigoPareamento: string | null } | { ok: false; erro: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: 'Configure a URL e a chave do provedor.' };
  const r = await chamar(ctx, 'GET', `/instance/connect/${inst(ctx)}`);
  if (!r.ok) return { ok: false, erro: erroDe(r) };
  const b64: string | null = r.dados?.base64 || r.dados?.qrcode?.base64 || null;
  const qr = b64 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(b64) ? b64 : null;
  return { ok: true, qr, codigoPareamento: typeof r.dados?.pairingCode === 'string' ? r.dados.pairingCode : null };
}

/** Estado da conexão e número conectado. */
export async function getStatus(): Promise<StatusConexao> {
  const ctx = await contexto();
  if (!ctx) return { estado: 'nao_configurado', numero: null };
  const r = await chamar(ctx, 'GET', `/instance/connectionState/${inst(ctx)}`, undefined, 6000);
  if (r.status === 404) return { estado: 'desconectado', numero: null, detalhe: 'instância ainda não criada' };
  if (!r.ok) return { estado: 'erro', numero: null, detalhe: erroDe(r) };
  const st = String(r.dados?.instance?.state ?? r.dados?.state ?? '').toLowerCase();
  if (st === 'open') {
    let numero: string | null = null;
    const f = await chamar(ctx, 'GET', `/instance/fetchInstances?instanceName=${inst(ctx)}`, undefined, 6000);
    const item = Array.isArray(f.dados) ? f.dados[0] : f.dados;
    const jid: string = item?.ownerJid || item?.instance?.owner || item?.owner || '';
    const m = jid.match(/^(\d{10,15})/);
    if (m) numero = m[1];
    return { estado: 'conectado', numero };
  }
  if (st === 'connecting') return { estado: 'aguardando_qr', numero: null };
  return { estado: 'desconectado', numero: null };
}

/** Desconecta o número (o celular sai de Aparelhos conectados). */
export async function disconnect(): Promise<{ ok: boolean; erro?: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: 'Provedor não configurado.' };
  const r = await chamar(ctx, 'DELETE', `/instance/logout/${inst(ctx)}`);
  return r.ok || r.status === 404 ? { ok: true } : { ok: false, erro: erroDe(r) };
}

/** Envia texto simples. `numero` já normalizado (55 + DDD + número). */
export async function sendText(numero: string, texto: string, tempoMs = 6000): Promise<ResultadoEnvio> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: 'Provedor não configurado.' };
  if (!/^55\d{10,11}$/.test(numero)) return { ok: false, erro: 'Número inválido.' };
  const r = await chamar(ctx, 'POST', `/message/sendText/${inst(ctx)}`, { number: numero, text: texto }, tempoMs);
  if (!r.ok) return { ok: false, erro: erroDe(r) };
  return { ok: true, id: r.dados?.key?.id ?? null };
}
