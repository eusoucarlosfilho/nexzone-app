// Configuração do WhatsApp (tabela settings, chave/valor). SÓ SERVIDOR.
// - 'whatsapp'          → JSON com interruptor, provedor, URL, instância, eventos/modelos, limites e promoções
// - 'whatsapp_api_key'  → chave do provedor, guardada à parte e NUNCA devolvida ao navegador
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { CHAVES_EVENTOS } from './eventos';
import { normalizarTelefone } from './telefone';

export type ConfigWhatsApp = {
  ativo: boolean;
  provedor: 'evolution';
  apiUrl: string;
  instancia: string;
  limitePorMinuto: number;
  adminNumero: string | null;
  eventos: Record<string, { ativo: boolean; modelo: string | null }>;
  promo: { tetoDiario: number; intervaloMin: number; intervaloMax: number };
};

export const CONFIG_PADRAO: ConfigWhatsApp = {
  ativo: false,
  provedor: 'evolution',
  apiUrl: '',
  instancia: 'comprei-barato',
  limitePorMinuto: 20,
  adminNumero: null,
  eventos: Object.fromEntries(CHAVES_EVENTOS.map((k) => [k, { ativo: true, modelo: null }])),
  promo: { tetoDiario: 150, intervaloMin: 10, intervaloMax: 20 },
};

const n = (v: unknown, min: number, max: number, def: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : def;
};

/** Valida e completa o que vem do banco ou do formulário. */
export function normalizarConfig(v: any): ConfigWhatsApp {
  const o = v && typeof v === 'object' ? v : {};
  const url = typeof o.apiUrl === 'string' ? o.apiUrl.trim().replace(/\/+$/, '').slice(0, 300) : '';
  const eventos: ConfigWhatsApp['eventos'] = {};
  for (const k of CHAVES_EVENTOS) {
    const e = o.eventos && typeof o.eventos === 'object' ? o.eventos[k] : null;
    const modelo = e && typeof e.modelo === 'string' && e.modelo.trim() ? e.modelo.slice(0, 1000) : null;
    eventos[k] = { ativo: e ? e.ativo !== false : true, modelo };
  }
  const p = o.promo && typeof o.promo === 'object' ? o.promo : {};
  const min = n(p.intervaloMin, 5, 300, 10);
  return {
    ativo: o.ativo === true,
    provedor: 'evolution',
    apiUrl: /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url) ? url : '',
    instancia: typeof o.instancia === 'string' && /^[a-zA-Z0-9_-]{2,40}$/.test(o.instancia) ? o.instancia : CONFIG_PADRAO.instancia,
    limitePorMinuto: n(o.limitePorMinuto, 1, 60, 20),
    adminNumero: normalizarTelefone(o.adminNumero),
    eventos,
    promo: { tetoDiario: n(p.tetoDiario, 1, 1000, 150), intervaloMin: min, intervaloMax: Math.max(min, n(p.intervaloMax, 5, 600, 20)) },
  };
}

export async function lerConfig(): Promise<ConfigWhatsApp> {
  try {
    const { data } = await createAdminClient().from('settings').select('value').eq('key', 'whatsapp').maybeSingle();
    return normalizarConfig((data as any)?.value);
  } catch {
    return CONFIG_PADRAO;
  }
}

export async function salvarConfig(c: ConfigWhatsApp) {
  return createAdminClient().from('settings').upsert({ key: 'whatsapp', value: c, updated_at: new Date().toISOString() });
}

// A chave é guardada CRIPTOGRAFADA (AES-256-GCM). A senha de criptografia é derivada de uma variável
// que só existe no servidor (SUPABASE_SERVICE_ROLE_KEY), então quem ler a tabela settings não vê a chave.
// Se essa variável mudar um dia, a chave salva deixa de abrir: basta digitar de novo no admin.
const PREFIXO = 'enc:v1:';
function segredo() {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return base ? crypto.createHash('sha256').update('comprei-barato:whatsapp:' + base).digest() : null;
}
export function cifrar(texto: string): string {
  const k = segredo();
  if (!k) throw new Error('sem segredo do servidor');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return PREFIXO + Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64');
}
export function decifrar(valor: string): string {
  if (!valor.startsWith(PREFIXO)) return valor; // valor antigo, salvo sem criptografia
  const k = segredo();
  if (!k) return '';
  try {
    const b = Buffer.from(valor.slice(PREFIXO.length), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export async function lerChave(): Promise<string> {
  try {
    const { data } = await createAdminClient().from('settings').select('value').eq('key', 'whatsapp_api_key').maybeSingle();
    const v = (data as any)?.value;
    return typeof v === 'string' && v ? decifrar(v) : '';
  } catch {
    return '';
  }
}

export async function salvarChave(chave: string) {
  return createAdminClient().from('settings').upsert({ key: 'whatsapp_api_key', value: cifrar(chave.trim().slice(0, 300)), updated_at: new Date().toISOString() });
}

/** Só o final da chave, para mostrar na tela. */
export const mascararChave = (k: string) => (k ? '••••••••' + k.slice(-4) : '');
