// Auxiliares do endpoint /api/track (servidor). Puros onde possível, para teste.
import { createAdminClient } from '@/lib/supabase/server';

// ---------- limite de requisições (memória da instância; melhor esforço) ----------
// Em ambiente serverless cada instância tem a própria memória: isto barra rajadas e loops,
// não é uma proteção absoluta. A proteção de custo real vem da retenção e dos índices (SQL V3).
type Balde = { n: number; ate: number };
const baldes = new Map<string, Balde>();

export function permitido(chave: string, limite: number, janelaMs: number, agora = Date.now()): boolean {
  const b = baldes.get(chave);
  if (!b || b.ate <= agora) {
    baldes.set(chave, { n: 1, ate: agora + janelaMs });
    if (baldes.size > 20000) limparBaldes(agora);
    return true;
  }
  b.n++;
  return b.n <= limite;
}

function limparBaldes(agora: number) {
  baldes.forEach((b, k) => { if (b.ate <= agora) baldes.delete(k); });
}

// ---------- deduplicação de eventos (mesmo evento, mesma sessão, 2 s) ----------
const vistos = new Map<string, number>();
export function duplicado(chave: string, agora = Date.now(), janelaMs = 2000): boolean {
  const t = vistos.get(chave);
  vistos.set(chave, agora);
  if (vistos.size > 20000) vistos.forEach((v, k) => { if (v < agora - janelaMs) vistos.delete(k); });
  return t !== undefined && agora - t < janelaMs;
}

// ---------- chave "eventos de funil ativos" (settings.analytics_funil) ----------
// Padrão DESLIGADO: os eventos de funil só são gravados depois que o admin ativa,
// após a revisão de privacidade (ver V3_PENDENCIAS.md). Cache de 60 s.
let cacheFunil: { v: boolean; ate: number } | null = null;
export async function funilAtivo(): Promise<boolean> {
  const agora = Date.now();
  if (cacheFunil && cacheFunil.ate > agora) return cacheFunil.v;
  let v = false;
  try {
    const { data } = await createAdminClient().from('settings').select('value').eq('key', 'analytics_funil').maybeSingle();
    v = (data as any)?.value === true;
  } catch { v = false; }
  cacheFunil = { v, ate: agora + 60_000 };
  return v;
}
export function esquecerCacheFunil() { cacheFunil = null; }

/** Caminho seguro para gravar: sem query/hash, sem áreas internas, até 200 caracteres. */
export function caminhoSeguro(p: unknown): string | null {
  if (typeof p !== 'string' || !p.startsWith('/') || p.length > 300) return null;
  const s = p.split('#')[0].split('?')[0];
  if (/^\/(admin|api|_next)(\/|$)/.test(s)) return null;
  // Páginas pessoais: guarda só o tipo de página, nunca o identificador do pedido/chamado/conversa.
  const n = s
    .replace(/^\/pedido\/[^/]+/, '/pedido/:id')
    .replace(/^\/suporte\/(?!meus-chamados)[^/]+/, '/suporte/:protocolo')
    .replace(/^\/vender\/conversas\/[^/]+/, '/vender/conversas/:id')
    .replace(/^\/destaque\/[^/]+/, '/destaque/:id')
    .replace(/^\/redefinir-senha.*/, '/redefinir-senha');
  return n.slice(0, 200);
}

export function dispositivoDe(ua: string): 'mobile' | 'desktop' | 'tablet' {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export const BOT = /bot\b|bot\/|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|headlesschrome|phantomjs|lighthouse|pagespeed|pingdom|uptimerobot|curl\/|wget|python-|axios|node-fetch|go-http|java\/|okhttp|vercel-screenshot|preview|scrapy|httpclient/i;
