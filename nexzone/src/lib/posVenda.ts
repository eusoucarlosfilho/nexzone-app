// Pós-venda (SQL 19): oferta logo depois da compra e recuperação de carrinho — regras puras.

export type OfertaEtapa = {
  ativo: boolean; product_id: string | null; preco: number | null; titulo: string; texto: string; botao: string;
};
export type PosVenda = {
  upsell: OfertaEtapa & { minutos: number };
  downsell: OfertaEtapa;
  recuperacao: { ativa: boolean; cupom: string | null };
};

export const POS_VENDA_PADRAO: PosVenda = {
  upsell: { ativo: false, product_id: null, preco: null, titulo: '', texto: '', botao: '', minutos: 15 },
  downsell: { ativo: false, product_id: null, preco: null, titulo: '', texto: '', botao: '' },
  recuperacao: { ativa: true, cupom: null },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const txt = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const preco = (v: unknown) => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : null; };

/** Linha do banco → configuração */
export function lerPosVenda(r: any): PosVenda {
  if (!r) return JSON.parse(JSON.stringify(POS_VENDA_PADRAO));
  return {
    upsell: { ativo: r.upsell_ativo === true, product_id: r.upsell_product_id ?? null, preco: r.upsell_preco != null ? Number(r.upsell_preco) : null,
      titulo: r.upsell_titulo || '', texto: r.upsell_texto || '', botao: r.upsell_botao || '', minutos: Number.isInteger(r.upsell_minutos) ? r.upsell_minutos : 15 },
    downsell: { ativo: r.downsell_ativo === true, product_id: r.downsell_product_id ?? null, preco: r.downsell_preco != null ? Number(r.downsell_preco) : null,
      titulo: r.downsell_titulo || '', texto: r.downsell_texto || '', botao: '' },
    recuperacao: { ativa: r.recuperacao_ativa !== false, cupom: r.recuperacao_cupom || null },
  };
}

/** Confere o que o produtor enviou. produtosDaLoja = ids de produtos ATIVOS da mesma loja (fora o próprio). */
export function validarPosVenda(b: any, produtoId: string, produtosDaLoja: Set<string>): { ok: true; linha: Record<string, any> } | { ok: false; erro: string } {
  const up = b?.upsell || {}, down = b?.downsell || {}, rec = b?.recuperacao || {};
  const linha: Record<string, any> = {
    product_id: produtoId,
    upsell_ativo: up.ativo === true,
    upsell_product_id: UUID.test(String(up.product_id || '')) ? String(up.product_id).toLowerCase() : null,
    upsell_preco: preco(up.preco),
    upsell_titulo: txt(up.titulo, 120) || null,
    upsell_texto: txt(up.texto, 2000) || null,
    upsell_botao: txt(up.botao, 60) || null,
    upsell_minutos: Math.min(120, Math.max(0, Math.floor(Number(up.minutos ?? 15)) || 0)),
    downsell_ativo: down.ativo === true,
    downsell_product_id: UUID.test(String(down.product_id || '')) ? String(down.product_id).toLowerCase() : null,
    downsell_preco: preco(down.preco),
    downsell_titulo: txt(down.titulo, 120) || null,
    downsell_texto: txt(down.texto, 2000) || null,
    recuperacao_ativa: rec.ativa !== false,
    recuperacao_cupom: txt(rec.cupom, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || null,
  };
  if (linha.recuperacao_cupom && linha.recuperacao_cupom.length < 2) linha.recuperacao_cupom = null;
  for (const [etapa, nome] of [['upsell', 'oferta'], ['downsell', 'segunda oferta']] as const) {
    if (!linha[`${etapa}_ativo`]) continue;
    const pid = linha[`${etapa}_product_id`];
    if (!pid) return { ok: false, erro: `Escolha o produto da ${nome}.` };
    if (pid === produtoId.toLowerCase()) return { ok: false, erro: `A ${nome} precisa ser outro produto.` };
    if (!produtosDaLoja.has(pid)) return { ok: false, erro: `O produto da ${nome} precisa ser seu e estar ativo.` };
    if (!linha[`${etapa}_preco`]) return { ok: false, erro: `Informe o preço da ${nome} (mínimo R$ 1,00).` };
  }
  if (linha.downsell_ativo && !linha.upsell_ativo) return { ok: false, erro: 'A segunda oferta só aparece quando a primeira está ligada.' };
  return { ok: true, linha };
}

/** Qual etapa mostrar agora: upsell → (recusou) downsell → nada */
export function etapaAtual(cfg: PosVenda, respostas: { etapa: string; resposta: string }[]): 'upsell' | 'downsell' | null {
  const r = new Map(respostas.map((x) => [x.etapa, x.resposta]));
  if (!cfg.upsell.ativo || !cfg.upsell.product_id || !cfg.upsell.preco) return null;
  if (!r.has('upsell')) return 'upsell';
  if (r.get('upsell') === 'recusou' && cfg.downsell.ativo && cfg.downsell.product_id && cfg.downsell.preco && !r.has('downsell')) return 'downsell';
  return null;
}

/** A oferta vale por X minutos depois do pagamento (0 = sem prazo). Depois some — o cronômetro é verdadeiro. */
export function ofertaNoPrazo(pagoEm: string | null, minutos: number, agora = Date.now()): boolean {
  if (!minutos) return true;
  if (!pagoEm) return false;
  return agora - new Date(pagoEm).getTime() <= minutos * 60000;
}
export function expiraEm(pagoEm: string | null, minutos: number): string | null {
  if (!minutos || !pagoEm) return null;
  return new Date(new Date(pagoEm).getTime() + minutos * 60000).toISOString();
}

// ---------- carrinho abandonado ----------
export const ETAPAS_CARRINHO = [
  { etapa: '1h' as const, coluna: 'lembrete_1h', de: 180, ate: 60 },          // identificou-se entre 3 h e 1 h atrás
  { etapa: '24h' as const, coluna: 'lembrete_24h', de: 26 * 60, ate: 23 * 60 },
];

/** Minutos até o 1º lembrete (settings.recuperacao_minutos, SQL 24). Fora da faixa → 5. */
export function minutosRecuperacao(v: unknown): number {
  const n = Math.round(Number(String(v ?? '').replace(/"/g, '')));
  return Number.isFinite(n) && n >= 3 && n <= 120 ? n : 5;
}

/** Etapas do carrinho com o 1º lembrete no tempo escolhido (janela de 3 h para não perder ninguém). */
export const etapasCarrinho = (min: number) => [
  { ...ETAPAS_CARRINHO[0], de: Math.max(180, min + 120), ate: min },
  ETAPAS_CARRINHO[1],
];

/** Link de volta ao checkout com e-mail e cupom de recuperação */
export function linkRecuperacao(site: string, productId: string, email: string, cupom: string | null): string {
  const u = new URL(`/checkout/${productId}`, site);
  u.searchParams.set('email', email);
  if (cupom) u.searchParams.set('cupom', cupom);
  u.searchParams.set('utm_source', 'recuperacao');
  u.searchParams.set('utm_medium', 'email');
  return u.toString();
}
