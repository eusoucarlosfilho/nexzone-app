// Audiência do vendedor: definições, períodos, canais e regras de oportunidades.
// Funções puras (sem banco), usadas pela rota /api/seller/audience e testáveis isoladamente.
//
// Limitações conhecidas (mostradas na tela):
// - Os números vêm do rastreador anônimo do site (/api/track), que não tem limite de envio:
//   por isso tudo é "estimado".
// - O rastreador grava só o caminho da página (sem parâmetros), então não há UTM:
//   a origem vem do referrer da sessão.
// - Pedidos e pagamentos NÃO entram no funil: o status do pedido ainda não é confiável
//   para indicar venda confirmada (K2).

export const TZ = 'America/Sao_Paulo';
export const JANELA_AO_VIVO_MS = 5 * 60 * 1000;
export const MIN_AMOSTRA = 3; // contagens por produto/canal abaixo disso aparecem como "menos de 3"
export const MAX_PRODUTOS = 300; // produtos considerados por loja
export const MAX_PAGEVIEWS = 20000; // teto de linhas lidas por período
export const MAX_SESSOES = 5000; // teto de sessões consultadas para visitantes e origem
export const CHUNK_CAMINHOS = 100;

export type Periodo = 'hoje' | 'ontem' | '7d' | '30d';
export const PERIODOS: Periodo[] = ['hoje', 'ontem', '7d', '30d'];
export const ROTULO_PERIODO: Record<Periodo, string> = { hoje: 'Hoje', ontem: 'Ontem', '7d': '7 dias', '30d': '30 dias' };
export const ROTULO_ANTERIOR: Record<Periodo, string> = {
  hoje: 'mesmo horário de ontem', ontem: 'anteontem', '7d': '7 dias anteriores', '30d': '30 dias anteriores',
};

export function periodoValido(v: unknown): Periodo {
  return PERIODOS.includes(v as Periodo) ? (v as Periodo) : '7d';
}

// ---------- fuso horário ----------
const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});
function tzParts(d: Date) {
  const o: Record<string, string> = {};
  partsFmt.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24 };
}
function tzOffset(d: Date) {
  const p = tzParts(d);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return asUtc - d.getTime();
}
/** Meia-noite (no fuso de São Paulo) de N dias atrás. */
export function inicioDoDia(diasAtras: number, agora = new Date()) {
  const p = tzParts(agora);
  const guess = Date.UTC(p.y, p.m - 1, p.d - diasAtras, 0, 0, 0);
  return new Date(guess - tzOffset(new Date(guess)));
}
export const chaveDia = (d: Date) => { const p = tzParts(d); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
export const chaveHora = (d: Date) => `${chaveDia(d)}T${String(tzParts(d).h).padStart(2, '0')}`;

export type Intervalo = { inicio: Date; fim: Date };

/** Período pedido e o período anterior de mesmo tamanho. */
export function intervalos(periodo: Periodo, agora = new Date()): { atual: Intervalo; anterior: Intervalo; granularidade: 'hora' | 'dia' } {
  const d0 = inicioDoDia(0, agora);
  if (periodo === 'hoje') {
    const decorrido = agora.getTime() - d0.getTime();
    const d1 = inicioDoDia(1, agora);
    return { atual: { inicio: d0, fim: agora }, anterior: { inicio: d1, fim: new Date(d1.getTime() + decorrido) }, granularidade: 'hora' };
  }
  if (periodo === 'ontem') {
    return { atual: { inicio: inicioDoDia(1, agora), fim: d0 }, anterior: { inicio: inicioDoDia(2, agora), fim: inicioDoDia(1, agora) }, granularidade: 'hora' };
  }
  const n = periodo === '7d' ? 7 : 30;
  return {
    atual: { inicio: inicioDoDia(n - 1, agora), fim: agora },
    anterior: { inicio: inicioDoDia(2 * n - 1, agora), fim: inicioDoDia(n - 1, agora) },
    granularidade: 'dia',
  };
}

/** Rótulos da série (horas do dia ou dias do período). */
export function baldes(periodo: Periodo, iv: Intervalo, agora = new Date()) {
  const out: { chave: string; rotulo: string }[] = [];
  if (periodo === 'hoje' || periodo === 'ontem') {
    const dk = chaveDia(new Date(iv.inicio.getTime() + 12 * 3600 * 1000));
    const ultima = periodo === 'hoje' ? tzParts(agora).h : 23;
    for (let h = 0; h <= ultima; h++) out.push({ chave: `${dk}T${String(h).padStart(2, '0')}`, rotulo: `${String(h).padStart(2, '0')}h` });
    return out;
  }
  const n = periodo === '7d' ? 7 : 30;
  const vistos = new Set<string>();
  for (let i = n - 1; i >= 0; i--) {
    const k = chaveDia(new Date(inicioDoDia(i, agora).getTime() + 12 * 3600 * 1000));
    if (vistos.has(k)) continue;
    vistos.add(k);
    const [, m, dd] = k.split('-');
    out.push({ chave: k, rotulo: `${dd}/${m}` });
  }
  return out;
}

// ---------- caminhos da loja ----------
export type TipoCaminho = 'loja' | 'produto' | 'checkout';

export function caminhosDoVendedor(slug: string | null, produtoIds: string[]) {
  const lista: string[] = [];
  if (slug) lista.push(`/loja/${slug}`);
  for (const id of produtoIds) lista.push(`/produto/${id}`, `/checkout/${id}`);
  return lista;
}

/** Classifica um caminho já filtrado pelos caminhos do vendedor. */
export function classificar(path: string): { tipo: TipoCaminho; produtoId: string | null } | null {
  const p = path.split('?')[0].replace(/\/+$/, '');
  let m = /^\/produto\/([^/]+)$/.exec(p);
  if (m) return { tipo: 'produto', produtoId: m[1] };
  m = /^\/checkout\/([^/]+)$/.exec(p);
  if (m) return { tipo: 'checkout', produtoId: m[1] };
  if (/^\/loja\/[^/]+$/.test(p)) return { tipo: 'loja', produtoId: null };
  return null;
}

// ---------- canais de origem ----------
export const CANAIS = ['Instagram', 'WhatsApp', 'Facebook', 'Google', 'TikTok', 'YouTube', 'X', 'Direto', 'Outros sites'] as const;
export type Canal = typeof CANAIS[number];

export function canal(referrer: string | null | undefined, hostProprio = ''): Canal {
  if (!referrer) return 'Direto';
  let h = '';
  try { h = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'Direto'; }
  if (!h) return 'Direto';
  if (hostProprio && (h === hostProprio || h.endsWith('.' + hostProprio))) return 'Direto';
  if (/(^|\.)instagram\.com$/.test(h)) return 'Instagram';
  if (/(^|\.)whatsapp\.(com|net)$|^wa\.me$/.test(h)) return 'WhatsApp';
  if (/(^|\.)facebook\.com$|^fb\.(com|me)$|(^|\.)messenger\.com$/.test(h)) return 'Facebook';
  if (/(^|\.)google\.[a-z.]+$/.test(h)) return 'Google';
  if (/(^|\.)tiktok\.com$/.test(h)) return 'TikTok';
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return 'YouTube';
  if (/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/.test(h)) return 'X';
  return 'Outros sites';
}

// ---------- apresentação ----------
/** Contagem com máscara de amostra pequena (por produto e por canal). */
export function mascarar(n: number): number | null {
  return n > 0 && n < MIN_AMOSTRA ? null : n;
}

/** Variação percentual; null quando a base é pequena demais para comparar. */
export function variacao(atual: number, anterior: number, minimo = 10): number | null {
  if (anterior < minimo && atual < minimo) return null;
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

// ---------- oportunidades (regras explicáveis) ----------
export type LinhaProduto = { id: string; titulo: string; visualizacoes: number; checkout: number; destaque: boolean; ativo: boolean };
export type Oportunidade = { tipo: 'atencao' | 'positivo' | 'info'; titulo: string; motivo: string; acao?: { rotulo: string; href: string } };

export const REGRAS = {
  semCheckoutMinViews: 20,
  boaTaxaMinViews: 20,
  boaTaxa: 0.15,
  tendenciaMinViews: 30,
  tendenciaPct: 30,
  canalMinSessoes: 20,
  canalPct: 0.5,
};

export function oportunidades(args: {
  produtos: LinhaProduto[];
  viewsAtual: number;
  viewsAnterior: number;
  canais: { canal: string; sessoes: number }[];
  sessoes: number;
  rotuloAnterior: string;
}): Oportunidade[] {
  const out: Oportunidade[] = [];
  const R = REGRAS;

  const semCheckout = args.produtos
    .filter((p) => p.ativo && p.visualizacoes >= R.semCheckoutMinViews && p.checkout === 0)
    .sort((a, b) => b.visualizacoes - a.visualizacoes)[0];
  if (semCheckout) out.push({
    tipo: 'atencao',
    titulo: `"${semCheckout.titulo}" é visto, mas ninguém foi ao checkout`,
    motivo: `${semCheckout.visualizacoes} visualizações e nenhum acesso ao checkout no período (regra: ${R.semCheckoutMinViews}+ visualizações e 0 acessos). Revise preço, fotos e descrição.`,
    acao: { rotulo: 'Editar produto', href: '/vender/produtos' },
  });

  const boa = args.produtos
    .filter((p) => p.ativo && !p.destaque && p.visualizacoes >= R.boaTaxaMinViews && p.checkout / p.visualizacoes >= R.boaTaxa)
    .sort((a, b) => b.checkout / b.visualizacoes - a.checkout / a.visualizacoes)[0];
  if (boa) out.push({
    tipo: 'positivo',
    titulo: `"${boa.titulo}" leva muita gente ao checkout`,
    motivo: `${Math.round((boa.checkout / boa.visualizacoes) * 100)}% das visualizações viraram acesso ao checkout (${boa.checkout} de ${boa.visualizacoes}; regra: ${Math.round(R.boaTaxa * 100)}%+ com ${R.boaTaxaMinViews}+ visualizações). Pode valer destacá-lo.`,
    acao: { rotulo: 'Ver produtos', href: '/vender/produtos?status=ativo' },
  });

  const v = variacao(args.viewsAtual, args.viewsAnterior, R.tendenciaMinViews);
  if (v !== null && Math.abs(v) >= R.tendenciaPct) out.push({
    tipo: v > 0 ? 'positivo' : 'atencao',
    titulo: v > 0 ? `Visualizações subiram ${v}%` : `Visualizações caíram ${Math.abs(v)}%`,
    motivo: `${args.viewsAtual} visualizações contra ${args.viewsAnterior} (${args.rotuloAnterior}). Regra: variação de ${R.tendenciaPct}%+ com ${R.tendenciaMinViews}+ visualizações.`,
  });

  if (args.sessoes >= R.canalMinSessoes) {
    const topo = [...args.canais].sort((a, b) => b.sessoes - a.sessoes)[0];
    if (topo && topo.sessoes / args.sessoes >= R.canalPct) out.push({
      tipo: 'info',
      titulo: `${topo.canal} traz a maior parte das visitas`,
      motivo: `${Math.round((topo.sessoes / args.sessoes) * 100)}% das ${args.sessoes} visitas vieram de ${topo.canal}. Concentrar a divulgação nesse canal tende a render mais; diversificar reduz a dependência.`,
    });
  }
  return out;
}
