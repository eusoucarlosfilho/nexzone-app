// Camada ÚNICA de acesso ao provedor de WhatsApp. O resto do site só usa estas funções.
// Provedor atual: "ponte" própria na Square Cloud (pasta compreibarato-whatsapp), que mantém o número
// conectado por QR Code 24 h e fala as mesmas rotas da Evolution API v2 (também compatível com ela).
// Para trocar de provedor (Z-API, API oficial da Meta), basta implementar este mesmo contrato.
// SÓ SERVIDOR: usa a chave do provedor.
import { lerChave, lerConfig, type ConfigWhatsApp } from '@/lib/whatsapp/config';

export type EstadoConexao =
  | 'conectado'        // WhatsApp ligado e pronto para enviar
  | 'aguardando_qr'    // servidor no ar, esperando escanear o QR Code
  | 'desconectado'     // servidor no ar, WhatsApp desconectado
  | 'sem_endereco'     // endereço do servidor não salvo
  | 'sem_chave'        // chave (API_KEY) não salva
  | 'inacessivel'      // servidor não respondeu ou respondeu algo que não é o servidor do WhatsApp
  | 'chave_recusada'   // servidor respondeu 401/403: a chave não confere
  | 'erro';            // outro erro do servidor
export type StatusConexao = { estado: EstadoConexao; numero: string | null; detalhe?: string };
export type ResultadoEnvio = { ok: true; id: string | null } | { ok: false; erro: string };

type Ctx = { cfg: ConfigWhatsApp; chave: string };

async function contextoComMotivo(): Promise<{ ctx: Ctx } | { motivo: 'sem_endereco' | 'sem_chave' }> {
  const [cfg, chave] = await Promise.all([lerConfig(), lerChave()]);
  if (!cfg.apiUrl) return { motivo: 'sem_endereco' };
  if (!chave) return { motivo: 'sem_chave' };
  return { ctx: { cfg, chave } };
}
async function contexto(): Promise<Ctx | null> {
  const r = await contextoComMotivo();
  return 'ctx' in r ? r.ctx : null;
}
const MSG_MOTIVO = { sem_endereco: 'Salve o endereço do servidor do WhatsApp.', sem_chave: 'Salve a chave (API_KEY) do servidor do WhatsApp.' };

/** Classifica uma resposta sem sucesso do servidor. */
function diagnostico(r: { status: number; dados: any }): { estado: EstadoConexao; detalhe: string } {
  if (r.status === 0) return { estado: 'inacessivel', detalhe: `O servidor não respondeu (${r.dados?.message || 'sem conexão'}). Confira o endereço e se a aplicação está ligada na Square Cloud.` };
  if (r.status === 401 || r.status === 403) return { estado: 'chave_recusada', detalhe: 'O servidor recusou a chave. A chave salva aqui precisa ser igual à variável API_KEY da Square Cloud (com 24 caracteres ou mais).' };
  if (r.dados === null || typeof r.dados !== 'object') return { estado: 'inacessivel', detalhe: `O endereço respondeu (código ${r.status}), mas não parece ser o servidor do WhatsApp. Confira o endereço.` };
  if (r.status >= 500) return { estado: 'inacessivel', detalhe: `O servidor está com erro (código ${r.status}). Veja o console na Square Cloud.` };
  return { estado: 'erro', detalhe: erroDe(r) };
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
  if (!ctx) return { ok: false, erro: 'Configure o endereço e a chave do servidor do WhatsApp.' };
  const r = await chamar(ctx, 'POST', '/instance/create', { instanceName: ctx.cfg.instancia, integration: 'WHATSAPP-BAILEYS', qrcode: true });
  if (r.ok || /already|exist|em uso|in use/i.test(erroDe(r))) return { ok: true }; // instância já existente: segue
  return { ok: false, erro: diagnostico(r).detalhe };
}

/** QR Code atual (imagem base64) para escanear em Aparelhos conectados. */
export async function getQrCode(): Promise<{ ok: true; qr: string | null; codigoPareamento: string | null } | { ok: false; erro: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: 'Configure o endereço e a chave do servidor do WhatsApp.' };
  const r = await chamar(ctx, 'GET', `/instance/connect/${inst(ctx)}`, undefined, 12000);
  if (!r.ok) return { ok: false, erro: diagnostico(r).detalhe };
  const b64: string | null = r.dados?.base64 || r.dados?.qrcode?.base64 || null;
  const qr = b64 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(b64) ? b64 : null;
  return { ok: true, qr, codigoPareamento: typeof r.dados?.pairingCode === 'string' ? r.dados.pairingCode : null };
}

/** Estado da conexão e número conectado. */
export async function getStatus(tempoMs = 6000): Promise<StatusConexao> {
  const c = await contextoComMotivo();
  if ('motivo' in c) return { estado: c.motivo, numero: null, detalhe: MSG_MOTIVO[c.motivo] };
  const ctx = c.ctx;
  const r = await chamar(ctx, 'GET', `/instance/connectionState/${inst(ctx)}`, undefined, tempoMs);
  if (r.status === 404 && r.dados && typeof r.dados === 'object') return { estado: 'desconectado', numero: null, detalhe: 'Clique em Conectar WhatsApp para gerar o QR Code.' };
  if (!r.ok || !r.dados || typeof r.dados !== 'object') { const d = diagnostico(r); return { estado: d.estado, numero: null, detalhe: d.detalhe }; }
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
  if (st === 'connecting') return { estado: 'aguardando_qr', numero: null, detalhe: 'Escaneie o QR Code no celular.' };
  return { estado: 'desconectado', numero: null, detalhe: 'Servidor no ar. Clique em Conectar WhatsApp para gerar o QR Code.' };
}

/** Checagem rápida antes de enviar: só true com o WhatsApp conectado. Nunca lança erro. */
export async function conectado(): Promise<boolean> {
  try { return (await getStatus(3000)).estado === 'conectado'; } catch { return false; }
}

/** Desconecta o número (o celular sai de Aparelhos conectados). */
export async function disconnect(): Promise<{ ok: boolean; erro?: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: 'Provedor não configurado.' };
  const r = await chamar(ctx, 'DELETE', `/instance/logout/${inst(ctx)}`);
  return r.ok || r.status === 404 ? { ok: true } : { ok: false, erro: diagnostico(r).detalhe };
}

/** Envia texto simples. `numero` já normalizado (55 + DDD + número). */
export async function sendText(numero: string, texto: string, tempoMs = 6000): Promise<ResultadoEnvio> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: 'Provedor não configurado.' };
  if (!/^55\d{10,11}$/.test(numero)) return { ok: false, erro: 'Número inválido.' };
  const r = await chamar(ctx, 'POST', `/message/sendText/${inst(ctx)}`, { number: numero, text: texto }, tempoMs);
  if (!r.ok) return { ok: false, erro: r.status === 0 || r.status === 401 || r.status === 403 ? diagnostico(r).detalhe : erroDe(r) };
  return { ok: true, id: r.dados?.key?.id ?? null };
}
