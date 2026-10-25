// Validação de URLs de ofertas parceiras (destino da compra e imagem).
// Só regras locais: NÃO faz requisição ao destino (sem risco de SSRF).
import type { Plataforma } from './tipos';

export const MAX_URL = 2048;

/** Domínios aceitos por plataforma (o host precisa ser igual ou subdomínio). */
export const DOMINIOS_PLATAFORMA: Record<Plataforma, string[] | null> = {
  hotmart: ['hotmart.com', 'hotm.art'],
  kiwify: ['kiwify.com.br', 'kiwify.com', 'kiwify.app'],
  monetizze: ['monetizze.com.br'],
  eduzz: ['eduzz.com', 'nutror.com'],
  braip: ['braip.com'],
  direto: null, // parceiro direto: qualquer domínio público com HTTPS
  outra: null,
};

export type ResultadoUrl = { ok: true; url: string; host: string } | { ok: false; erro: string };

function hostBloqueado(host: string) {
  if (!host || host.length > 253) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  if (/^\[.*\]$/.test(host) || host.includes(':')) return true;     // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;            // IPv4 literal
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) return true; // IP em formato numérico
  if (!host.includes('.')) return true;
  const tld = host.split('.').pop() || '';
  if (!/^[a-z]{2,24}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return true;
  return false;
}

function dominioPermitido(host: string, dominios: string[] | null) {
  if (!dominios) return true;
  return dominios.some((d) => host === d || host.endsWith('.' + d));
}

/**
 * Valida uma URL externa. Exige HTTPS, host público (sem IP, localhost ou rede interna),
 * sem usuário/senha embutidos e porta padrão. Com plataforma, exige o domínio oficial dela.
 * Preserva caminho e parâmetros (ex.: códigos de afiliado); remove só o fragmento (#...).
 */
export function validarUrlExterna(bruta: unknown, plataforma?: Plataforma | null): ResultadoUrl {
  if (typeof bruta !== 'string') return { ok: false, erro: 'Link ausente.' };
  const s = bruta.trim();
  if (!s) return { ok: false, erro: 'Link ausente.' };
  if (s.length > MAX_URL) return { ok: false, erro: 'Link muito longo.' };
  if (/[\u0000-\u001f\u007f\s]/.test(s)) return { ok: false, erro: 'Link com caracteres inválidos.' };
  let u: URL;
  try { u = new URL(s); } catch { return { ok: false, erro: 'Link malformado.' }; }
  if (u.protocol !== 'https:') return { ok: false, erro: 'O link precisa começar com https://.' };
  if (u.username || u.password) return { ok: false, erro: 'Link com usuário ou senha não é permitido.' };
  if (u.port && u.port !== '443') return { ok: false, erro: 'Porta não permitida.' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (hostBloqueado(host)) return { ok: false, erro: 'Endereço não permitido.' };
  if (plataforma && !dominioPermitido(host, DOMINIOS_PLATAFORMA[plataforma] ?? null)) {
    const lista = (DOMINIOS_PLATAFORMA[plataforma] || []).join(', ');
    return { ok: false, erro: `O link não é do domínio oficial da plataforma (${lista}).` };
  }
  u.hash = '';
  return { ok: true, url: u.toString(), host };
}

/** Imagem: mesmas regras de segurança, qualquer domínio público. */
export function validarUrlImagem(bruta: unknown): ResultadoUrl {
  const r = validarUrlExterna(bruta, null);
  if (!r.ok) return r;
  return r;
}

/** Chave para detectar duplicidade: host + caminho, sem parâmetros e sem barra final. */
export function chaveDuplicidade(url: string) {
  try {
    const u = new URL(url);
    return (u.hostname.toLowerCase().replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch { return url.toLowerCase(); }
}
