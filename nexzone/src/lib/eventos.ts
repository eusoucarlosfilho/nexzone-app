// Dicionário de eventos de audiência (V3). Puro: usado no navegador, no servidor e nos testes.
//
// Regras de privacidade:
// - Nenhum evento carrega nome, e-mail, telefone, senha, CPF ou texto digitado em campos pessoais.
// - Só propriedades listadas aqui são aceitas; o resto é descartado no servidor.
// - Valores de texto são curtos e passam por limpeza (sem e-mail, sem sequências longas de números).
// - Termo de busca: guardado normalizado e curto, e descartado se parecer dado pessoal.

export const EVENTOS = {
  cadastro_aberto: { props: ['tipo'] },
  cadastro_iniciado: { props: ['tipo'] },
  cadastro_etapa: { props: ['tipo', 'etapa'] },
  cadastro_erro: { props: ['tipo', 'codigo'] },
  cadastro_concluido: { props: ['tipo', 'metodo', 'confirmacao'] },
  produto_clique: { props: ['origem', 'tipo', 'categoria'] },
  compra_clique: { props: ['tipo', 'categoria'] },
  busca: { props: ['termo', 'resultados', 'categoria'] },
  vendedor_cta: { props: ['origem'] },
} as const;

export type NomeEvento = keyof typeof EVENTOS;
export type PropsEvento = Record<string, string | number | boolean>;

export const NOMES_EVENTOS = Object.keys(EVENTOS) as NomeEvento[];

// Valores fechados para algumas propriedades (o resto é texto curto limpo ou número).
const ENUMS: Record<string, readonly string[]> = {
  tipo: ['comprador', 'vendedor', 'nativo', 'externo'],
  etapa: ['dados', 'senha', 'localizacao', 'enviado'],
  codigo: ['senha_fraca', 'email_existente', 'email_invalido', 'campos_vazios', 'muitas_tentativas', 'outro'],
  metodo: ['email', 'google'],
  confirmacao: ['imediata', 'por_email'],
  origem: ['home', 'busca', 'categoria', 'catalogo', 'relacionados', 'loja', 'login', 'nav', 'outro'],
};

const EMAIL = /[^\s@]+@[^\s@]+/;
const MUITOS_DIGITOS = /\d{6,}/;

/** Limpa um texto livre curto. Retorna null se parecer dado pessoal. */
export function limparTexto(v: unknown, max = 40): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return null;
  if (EMAIL.test(s) || MUITOS_DIGITOS.test(s.replace(/[\s.\-/()]/g, ''))) return null;
  return s.slice(0, max);
}

export function eventoValido(nome: unknown): nome is NomeEvento {
  return typeof nome === 'string' && Object.prototype.hasOwnProperty.call(EVENTOS, nome);
}

/** Mantém só as propriedades permitidas para o evento, com valores seguros. */
export function limparProps(nome: NomeEvento, props: unknown): PropsEvento {
  const out: PropsEvento = {};
  if (!props || typeof props !== 'object') return out;
  const permitidas = EVENTOS[nome].props as readonly string[];
  for (const k of permitidas) {
    const v = (props as any)[k];
    if (v === undefined || v === null) continue;
    if (ENUMS[k]) {
      if (typeof v === 'string' && ENUMS[k].includes(v)) out[k] = v;
      continue;
    }
    if (k === 'resultados') {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = Math.min(Math.floor(n), 10000);
      continue;
    }
    const t = limparTexto(v, k === 'termo' ? 40 : 60);
    if (t) out[k] = t;
  }
  return out;
}

// ---------- UTM / origem do tráfego ----------

export const CHAVES_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
export type Utm = Partial<Record<(typeof CHAVES_UTM)[number], string>>;

/** Lê só as 4 chaves UTM de uma query string, limpas. Nunca guarda a URL inteira. */
export function utmDe(search: string): Utm {
  const out: Utm = {};
  let sp: URLSearchParams;
  try { sp = new URLSearchParams(search); } catch { return out; }
  for (const k of CHAVES_UTM) {
    const t = limparTexto(sp.get(k), 80);
    if (t) out[k] = t;
  }
  return out;
}

/** Canal a partir de UTM e do domínio de referência (sem a URL completa). */
export function canalDe(utm: Utm, refHost: string | null): string {
  const med = (utm.utm_medium || '').toLowerCase();
  const src = (utm.utm_source || '').toLowerCase();
  if (/cpc|ppc|paid|pago|ads?$|anuncio/.test(med)) return 'Pago';
  if (/email|e-mail|newsletter/.test(med) || /email|newsletter/.test(src)) return 'E-mail';
  if (/social|stories|reels|bio/.test(med)) return 'Social';
  if (/whats|wpp|zap/.test(src + med)) return 'WhatsApp';
  if (/afil|parceir|affiliate/.test(med)) return 'Parcerias';
  const h = (refHost || '').toLowerCase();
  if (src && !h) return 'Campanha';
  if (!h) return 'Direto';
  if (/(^|\.)google\.|bing\.com$|duckduckgo|yahoo\.|ecosia/.test(h)) return 'Busca orgânica';
  if (/facebook|instagram|tiktok|twitter|^t\.co$|x\.com$|youtube|linkedin|pinterest|threads/.test(h)) return 'Social';
  if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp';
  if (/mail\.|outlook|gmail/.test(h)) return 'E-mail';
  return 'Referência';
}

/** Só o domínio da página de origem (sem caminho nem parâmetros). */
export function hostDe(ref: unknown): string | null {
  if (typeof ref !== 'string' || !ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase();
    return h ? h.slice(0, 80) : null;
  } catch { return null; }
}

// ---------- classificação de páginas (para funil e painel ao vivo) ----------

export type AreaPagina = 'produto' | 'oferta' | 'cadastro' | 'checkout' | 'vendedor' | 'comprador' | 'busca' | 'categoria' | 'home' | 'outra';

export function areaDe(path: string | null | undefined): AreaPagina {
  const p = (path || '/').split('?')[0];
  if (p === '/') return 'home';
  if (p.startsWith('/produto/')) return 'produto';
  if (p.startsWith('/oferta/')) return 'oferta';
  if (p === '/login' || p.startsWith('/seja-vendedor') || p.startsWith('/esqueci-senha') || p.startsWith('/redefinir-senha')) return 'cadastro';
  if (p.startsWith('/checkout/')) return 'checkout';
  if (p.startsWith('/vender')) return 'vendedor';
  if (p.startsWith('/minhas-compras') || p.startsWith('/pedido/') || p.startsWith('/conta') || p.startsWith('/favoritos') || p.startsWith('/cb-points')) return 'comprador';
  if (p.startsWith('/busca')) return 'busca';
  if (p.startsWith('/produtos') || p.startsWith('/categoria/')) return 'categoria';
  return 'outra';
}

/** Id do produto em /produto/<uuid>. */
export function produtoIdDe(path: string): string | null {
  const m = /^\/produto\/([0-9a-f-]{36})/i.exec(path || '');
  return m ? m[1].toLowerCase() : null;
}
