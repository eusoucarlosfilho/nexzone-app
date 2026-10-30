// ============================================================
// Campanhas (puro, testado em testes/campanhas.test.js):
//   • 1ª compra sem taxa de serviço (Pix; cartão opcional)
//   • Lojista Fundador: 0% de comissão por X dias ou até R$ Y vendidos, selo para sempre, destaque grátis
//   • Cashback em CB Points: % do valor da compra volta como crédito para a próxima
// ============================================================

export type CfgCampanhas = {
  primeiraCompra: boolean; primeiraCompraCartao: boolean;
  fundadorAtivo: boolean; fundadorVagas: number; fundadorDias: number; fundadorTeto: number; fundadorDestaqueDias: number;
  cashbackPct: number;
};
export const CAMPANHAS_PADRAO: CfgCampanhas = {
  primeiraCompra: true, primeiraCompraCartao: false,
  fundadorAtivo: true, fundadorVagas: 50, fundadorDias: 30, fundadorTeto: 500, fundadorDestaqueDias: 7,
  cashbackPct: 5,
};
export const CHAVES_CAMPANHAS = ['promo_primeira_compra', 'promo_primeira_compra_cartao', 'fundador_ativo', 'fundador_vagas', 'fundador_dias', 'fundador_teto', 'fundador_destaque_dias', 'cb_cashback_pct'] as const;

const bool = (v: unknown, def: boolean) => (v === true || v === 'true' || v === '"true"' ? true : v === false || v === 'false' || v === '"false"' ? false : def);
const num = (v: unknown, def: number, min: number, max: number) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return def;
  const n = Number(String(v).replace(/"/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};

export function lerCampanhas(m: Record<string, unknown>): CfgCampanhas {
  const P = CAMPANHAS_PADRAO;
  return {
    primeiraCompra: bool(m.promo_primeira_compra, P.primeiraCompra),
    primeiraCompraCartao: bool(m.promo_primeira_compra_cartao, P.primeiraCompraCartao),
    fundadorAtivo: bool(m.fundador_ativo, P.fundadorAtivo),
    fundadorVagas: Math.round(num(m.fundador_vagas, P.fundadorVagas, 1, 1000)),
    fundadorDias: Math.round(num(m.fundador_dias, P.fundadorDias, 1, 365)),
    fundadorTeto: num(m.fundador_teto, P.fundadorTeto, 0, 1000000),
    fundadorDestaqueDias: Math.round(num(m.fundador_destaque_dias, P.fundadorDestaqueDias, 0, 60)),
    cashbackPct: num(m.cb_cashback_pct, P.cashbackPct, 0, 30),
  };
}

// ---------- 1ª compra sem taxa ----------
/** A taxa de serviço que vale para este comprador nesta forma de pagamento. */
export function taxaComPromo(taxaNormal: number, forma: 'pix' | 'cartao', primeira: boolean, cfg: CfgCampanhas): number {
  if (!primeira || !cfg.primeiraCompra) return taxaNormal;
  if (forma === 'cartao' && !cfg.primeiraCompraCartao) return taxaNormal;
  return 0;
}

// ---------- Lojista Fundador ----------
export type SituacaoFundador = { fundador: boolean; numero: number | null; ativo: boolean; ate: string | null; vendido: number; restante: number; motivoFim: 'prazo' | 'teto' | 'desligado' | null };

/** 0% de comissão enquanto estiver no prazo E abaixo do teto de vendas (teto 0 = sem teto). O selo fica para sempre. */
export function situacaoFundador(s: { fundador_em: string | null; fundador_numero: number | null }, vendido: number, cfg: CfgCampanhas, agora = Date.now()): SituacaoFundador {
  if (!s.fundador_numero || !s.fundador_em) return { fundador: false, numero: null, ativo: false, ate: null, vendido: 0, restante: 0, motivoFim: null };
  const ate = new Date(new Date(s.fundador_em).getTime() + cfg.fundadorDias * 86400000).toISOString();
  const noPrazo = agora < new Date(ate).getTime();
  const abaixoDoTeto = cfg.fundadorTeto <= 0 || vendido < cfg.fundadorTeto;
  const ativo = cfg.fundadorAtivo && noPrazo && abaixoDoTeto;
  return {
    fundador: true, numero: s.fundador_numero, ativo, ate, vendido: Math.round(vendido * 100) / 100,
    restante: cfg.fundadorTeto > 0 ? Math.max(0, Math.round((cfg.fundadorTeto - vendido) * 100) / 100) : -1, // -1 = sem teto
    motivoFim: ativo ? null : !cfg.fundadorAtivo ? 'desligado' : !noPrazo ? 'prazo' : 'teto',
  };
}

/** Divisão do pedido com o benefício do Fundador: comissão zero, tudo para o vendedor. */
export function divisaoComFundador<T extends { pct: number; taxa: number; valorVendedor: number }>(normal: T, total: number, fundadorAtivo: boolean): T {
  if (!fundadorAtivo) return normal;
  return { ...normal, pct: 0, taxa: 0, valorVendedor: Math.round(total * 100) / 100 };
}

// ---------- Cashback ----------
/** Pontos de cashback: % do valor do pedido (sem a taxa de serviço), convertido pela cotação dos CB Points. */
export function pontosCashback(totalPedido: number, pct: number, pontosPorReal: number): number {
  if (!(totalPedido > 0) || !(pct > 0) || !(pontosPorReal > 0)) return 0;
  return Math.floor(totalPedido * (pct / 100) * pontosPorReal);
}
export const valorDosPontos = (pontos: number, pontosPorReal: number) => (pontosPorReal > 0 ? Math.floor((pontos / pontosPorReal) * 100) / 100 : 0);

export const brlCurto = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
