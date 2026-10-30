// ============================================================
// Modelo de taxas do marketplace (aprovado por Carlos e César em 28/10/2026). Funções puras.
//   • Vendedor: plano por anúncio — Básico 5% · Destaque 8% · Topo 11% (mais visibilidade = taxa maior)
//   • Comprador: TAXA DE SERVIÇO no checkout = custo do meio de pagamento + margem da plataforma
//       Pix:    tarifa da MisticPay (% + R$) + nossa margem (% + R$)
//       Cartão: tarifa da Stripe (3,99% + R$ 0,39) + nossa margem (% + R$)
//     A vitrine e a página do produto mostram o PREÇO DO VENDEDOR; a taxa só entra no checkout.
//     A tarifa do gateway incide sobre o valor COBRADO (pedido + taxa), então a conta é feita "por dentro".
//   • Liberação do saldo por tipo de anúncio e meio de pagamento (contas 7 dias, demais 3, cartão 14)
//   • Saque: 1 grátis por semana; os extras custam R$ 0,99
// Todos os números vêm de settings (o admin muda sem código); estes são os padrões.
// ============================================================

export type Plano = 'basico' | 'destaque' | 'topo';
export type TipoAnuncio = 'conta' | 'item' | 'moeda' | 'giftcard' | 'servico' | 'digital';
export type Metodo = 'pix' | 'cartao';

export type ConfigTaxas = {
  planoBasico: number; planoDestaque: number; planoTopo: number;   // % do vendedor
  planosPagosAtivos: boolean;                                       // lançamento: todos no Básico até o admin ligar
  topoVagas: number;                                                // vagas de Topo por categoria
  gwPixPct: number; gwPixFixo: number;                             // tarifa da MisticPay no Pix (% + R$)
  gwCartaoPct: number; gwCartaoFixo: number;                       // tarifa da Stripe no cartão (% + R$)
  margemPixPct: number; margemPixFixo: number;                     // nossa margem no Pix (% do pedido + R$)
  margemCartaoPct: number; margemCartaoFixo: number;               // nossa margem no cartão (% do pedido + R$)
  liberaContaDias: number; liberaPadraoDias: number; liberaCartaoDias: number;
  saqueExtraTaxa: number;                                           // R$ por saque além do grátis da semana
  saqueGratisMin: number;                                           // o saque grátis da semana só vale a partir deste valor (R$)
  // Roteamento do Pix (estudo de taxas, 30/10): pedidos pequenos pelo Mercado Pago (% sem mínimo), grandes pela MisticPay (fixo)
  pixMpAte: number;                                                 // R$; 0 = desligado (tudo pela MisticPay)
  gwPixMpPct: number; gwPixMpFixo: number;                          // tarifa do Mercado Pago no Pix
  pixMpDisponivel: boolean;                                         // o token do Mercado Pago existe no servidor (não é setting)
};

export const TAXAS_PADRAO: ConfigTaxas = {
  planoBasico: 5, planoDestaque: 8, planoTopo: 11,
  planosPagosAtivos: false, topoVagas: 3,
  gwPixPct: 0, gwPixFixo: 0.5, gwCartaoPct: 3.99, gwCartaoFixo: 0.39,
  margemPixPct: 2, margemPixFixo: 0, margemCartaoPct: 2, margemCartaoFixo: 0.1,
  liberaContaDias: 7, liberaPadraoDias: 3, liberaCartaoDias: 14,
  saqueExtraTaxa: 0.99, saqueGratisMin: 50,
  pixMpAte: 0, gwPixMpPct: 0.99, gwPixMpFixo: 0, pixMpDisponivel: false,
};

/** Chaves da tabela settings que o modelo de taxas lê (o servidor busca TODAS estas). */
export const CHAVES_TAXAS = ['plano_basico_pct', 'plano_destaque_pct', 'plano_topo_pct', 'planos_pagos_ativos', 'topo_vagas_categoria',
  'fin_custo_pix_pct', 'fin_custo_pix_entrada', 'fin_custo_cartao_pct', 'fin_custo_cartao_fixo',
  'margem_pix_pct', 'margem_pix_fixo', 'margem_cartao_pct', 'margem_cartao_fixo',
  'liberacao_conta_dias', 'liberacao_padrao_dias', 'liberacao_cartao_dias', 'saque_extra_taxa', 'saque_gratis_min',
  'pix_mp_ate', 'gw_pix_mp_pct', 'gw_pix_mp_fixo'];

export const PLANOS: { id: Plano; nome: string; resumo: string; beneficios: string[] }[] = [
  { id: 'basico', nome: 'Básico', resumo: 'Aparece normalmente na busca e na categoria.', beneficios: ['Anúncio na vitrine e na busca', 'Ordem por reputação e vendas'] },
  { id: 'destaque', nome: 'Destaque', resumo: 'Sobe na categoria e entra no rodízio da página inicial.', beneficios: ['Acima dos anúncios Básicos', 'Rodízio na página inicial'] },
  { id: 'topo', nome: 'Topo', resumo: 'Primeiro na busca e na categoria, fixo na home e com selo.', beneficios: ['Primeiro na busca e na categoria', 'Fixo na página inicial', 'Selo "Topo" no anúncio', 'Vagas limitadas por categoria'] },
];

export const TIPOS_ANUNCIO: { id: TipoAnuncio; nome: string; dica: string; entrega: string }[] = [
  { id: 'conta', nome: 'Conta de jogo', dica: 'Entregue pelo chat do pedido. O comprador deve trocar e-mail e senha assim que receber.', entrega: 'acesso' },
  { id: 'item', nome: 'Item ou skin', dica: 'Combine a entrega no jogo pelo chat do pedido.', entrega: 'acesso' },
  { id: 'moeda', nome: 'Moedas / gold / Robux', dica: 'Informe a quantidade no título. Entrega pelo chat ou por presente no jogo.', entrega: 'acesso' },
  { id: 'giftcard', nome: 'Gift card, key ou código', dica: 'Cadastre os códigos: cada comprador recebe o dele assim que o pagamento cai.', entrega: 'chave' },
  { id: 'servico', nome: 'Serviço (boost, coach, elojob)', dica: 'Descreva prazo e como o serviço é feito. O valor fica retido até o fim da garantia.', entrega: 'acesso' },
  { id: 'digital', nome: 'Produto digital (guia, curso, software)', dica: 'Arquivo, link ou acesso liberado depois do pagamento.', entrega: 'arquivo' },
];

export const JOGOS = ['Free Fire', 'Roblox', 'Blox Fruits', 'Valorant', 'League of Legends', 'Counter-Strike 2', 'Fortnite', 'GTA V / GTA Online', 'Minecraft', 'Genshin Impact', 'Honkai: Star Rail', 'Clash Royale', 'Clash of Clans', 'Brawl Stars', 'EA FC', 'eFootball', 'Tibia', 'World of Warcraft', 'PUBG Mobile', 'Call of Duty', 'Pokémon', 'Dota 2', 'Steam', 'PlayStation', 'Xbox', 'Nintendo'] as const;

const num = (v: unknown, d: number) => {
  if (v === null || v === undefined || typeof v === 'boolean') return d;
  const t = typeof v === 'number' ? v : String(v).replace(/"/g, '').trim().replace(',', '.');
  if (t === '') return d; // chave ausente ou vazia NUNCA vira 0 (isso zeraria as taxas)
  const n = Number(t);
  return Number.isFinite(n) ? n : d;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Lê a configuração a partir do mapa de settings (chave → valor). Valores fora da faixa voltam ao padrão. */
export function lerConfigTaxas(m: Record<string, any> = {}): ConfigTaxas {
  const P = TAXAS_PADRAO;
  const pct = (k: string, d: number) => { const v = num(m[k], d); return v >= 0 && v <= 50 ? v : d; };
  const pctGw = (k: string, d: number) => { const v = num(m[k], d); return v >= 0 && v <= 30 ? v : d; };
  const reais = (k: string, d: number) => { const v = num(m[k], d); return v >= 0 && v <= 20 ? v : d; };
  const dias = (k: string, d: number) => { const v = Math.round(num(m[k], d)); return v >= 0 && v <= 60 ? v : d; };
  const bool = (v: any, d: boolean) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : d);
  return {
    planoBasico: pct('plano_basico_pct', P.planoBasico),
    planoDestaque: pct('plano_destaque_pct', P.planoDestaque),
    planoTopo: pct('plano_topo_pct', P.planoTopo),
    planosPagosAtivos: bool(m.planos_pagos_ativos, P.planosPagosAtivos),
    topoVagas: entre(Math.round(num(m.topo_vagas_categoria, P.topoVagas)), 1, 50),
    // tarifas do gateway: as MESMAS chaves do Financeiro (uma fonte só para o custo real)
    gwPixPct: pctGw('fin_custo_pix_pct', P.gwPixPct),
    gwPixFixo: reais('fin_custo_pix_entrada', P.gwPixFixo),
    gwCartaoPct: pctGw('fin_custo_cartao_pct', P.gwCartaoPct),
    gwCartaoFixo: reais('fin_custo_cartao_fixo', P.gwCartaoFixo),
    margemPixPct: pct('margem_pix_pct', P.margemPixPct),
    margemPixFixo: reais('margem_pix_fixo', P.margemPixFixo),
    margemCartaoPct: pct('margem_cartao_pct', P.margemCartaoPct),
    margemCartaoFixo: reais('margem_cartao_fixo', P.margemCartaoFixo),
    liberaContaDias: dias('liberacao_conta_dias', P.liberaContaDias),
    liberaPadraoDias: dias('liberacao_padrao_dias', P.liberaPadraoDias),
    liberaCartaoDias: dias('liberacao_cartao_dias', P.liberaCartaoDias),
    saqueExtraTaxa: reais('saque_extra_taxa', P.saqueExtraTaxa),
    saqueGratisMin: (() => { const v = num(m.saque_gratis_min, P.saqueGratisMin); return v >= 0 && v <= 1000 ? v : P.saqueGratisMin; })(),
    pixMpAte: (() => { const v = num(m.pix_mp_ate, P.pixMpAte); return v >= 0 && v <= 100000 ? v : P.pixMpAte; })(),
    gwPixMpPct: pctGw('gw_pix_mp_pct', P.gwPixMpPct),
    gwPixMpFixo: reais('gw_pix_mp_fixo', P.gwPixMpFixo),
    pixMpDisponivel: false,
  };
}

export const planoValido = (p: unknown): Plano => (p === 'destaque' || p === 'topo' ? p : 'basico');
export const tipoValido = (t: unknown): TipoAnuncio => (TIPOS_ANUNCIO.some((x) => x.id === t) ? (t as TipoAnuncio) : 'digital');

/** Plano que vale de fato (no lançamento, com os planos pagos desligados, todo mundo é Básico). */
export const planoEfetivo = (plano: unknown, cfg: ConfigTaxas): Plano => (cfg.planosPagosAtivos ? planoValido(plano) : 'basico');

/** % cobrado do vendedor no plano. */
export function pctDoPlano(plano: unknown, cfg: ConfigTaxas): number {
  const p = planoEfetivo(plano, cfg);
  return p === 'topo' ? cfg.planoTopo : p === 'destaque' ? cfg.planoDestaque : cfg.planoBasico;
}

/** Taxa do vendedor e quanto ele recebe, sobre o valor do pedido (sem a taxa de serviço do comprador). */
export function divisaoVendedor(total: number, plano: unknown, cfg: ConfigTaxas) {
  const pct = pctDoPlano(plano, cfg);
  const taxa = r2(Math.max(0, total) * pct / 100);
  return { pct, taxa, valorVendedor: r2(Math.max(0, total) - taxa) };
}

/**
 * Taxa de serviço do comprador = tarifa do gateway + nossa margem.
 * A tarifa do gateway é cobrada sobre o valor TOTAL cobrado (pedido + taxa), por isso:
 *   cobrado = (pedido + fixoGateway + margem) / (1 − %gateway)   →   taxa = cobrado − pedido
 * Arredonda para CIMA no centavo, para a margem nunca ficar abaixo do configurado.
 */
/** Por qual gateway o Pix deste valor sai: Mercado Pago até o limite (se ligado e com token), senão MisticPay. */
export function rotaPix(total: number, cfg: ConfigTaxas): 'mp' | 'misticpay' {
  return cfg.pixMpDisponivel && cfg.pixMpAte > 0 && total > 0 && total <= cfg.pixMpAte ? 'mp' : 'misticpay';
}
/** Tarifa do gateway (% e R$) para o método e valor, já considerando a rota do Pix. */
function tarifaGateway(metodo: Metodo, total: number, cfg: ConfigTaxas): { pct: number; fixo: number } {
  if (metodo === 'cartao') return { pct: cfg.gwCartaoPct, fixo: cfg.gwCartaoFixo };
  return rotaPix(total, cfg) === 'mp' ? { pct: cfg.gwPixMpPct, fixo: cfg.gwPixMpFixo } : { pct: cfg.gwPixPct, fixo: cfg.gwPixFixo };
}

export function partesTaxaComprador(metodo: Metodo, total: number, cfg: ConfigTaxas) {
  if (!(total > 0)) return { taxa: 0, gateway: 0, margem: 0, cobrado: 0 };
  const c = metodo === 'cartao';
  const tg = tarifaGateway(metodo, total, cfg);
  const gPct = tg.pct / 100;
  const gFix = tg.fixo;
  const margemAlvo = total * (c ? cfg.margemCartaoPct : cfg.margemPixPct) / 100 + (c ? cfg.margemCartaoFixo : cfg.margemPixFixo);
  const bruto = (total + gFix + margemAlvo) / (1 - gPct) - total;
  const taxa = Math.max(0, Math.ceil(bruto * 100 - 1e-6) / 100);
  const cobrado = r2(total + taxa);
  const gateway = r2(cobrado * gPct + gFix);
  return { taxa, gateway, margem: r2(taxa - gateway), cobrado };
}

/** Taxa de serviço do comprador para o meio de pagamento escolhido. */
export function taxaComprador(metodo: Metodo, total: number, cfg: ConfigTaxas): number {
  return partesTaxaComprador(metodo, total, cfg).taxa;
}

// ---------- Travas contra prejuízo (promoções nunca deixam o pedido no negativo) ----------
/** Custo do gateway quando o comprador NÃO paga taxa de serviço (1ª compra grátis): incide só sobre o pedido. */
export function custoGatewaySemTaxa(metodo: Metodo, total: number, cfg: ConfigTaxas): number {
  if (!(total > 0)) return 0;
  const tg = tarifaGateway(metodo, total, cfg);
  // arredonda para CIMA: a trava nunca deixa passar meio centavo de prejuízo
  return Math.ceil((total * tg.pct / 100 + tg.fixo) * 100 - 1e-6) / 100;
}
/** A comissão que fica com a plataforma neste pedido cobre o custo do gateway? Só então dá para abrir mão da taxa do comprador. */
export const comissaoCobreGateway = (metodo: Metodo, total: number, comissao: number, cfg: ConfigTaxas) =>
  r2(comissao) + 1e-9 >= custoGatewaySemTaxa(metodo, total, cfg);
/** Desconto máximo em CB Points sem prejuízo: no máximo a comissão da plataforma no pedido (quem paga os pontos é a plataforma). */
export const maxDescontoPontos = (totalBruto: number, pctVendedor: number) => Math.max(0, Math.floor(Math.max(0, totalBruto) * pctVendedor) / 100);

/** Frase curta com o exemplo da taxa num pedido (para landing, termos, ajuda). */
export function exemploTaxaServico(cfg: ConfigTaxas, valor = 50, comCartao = true) {
  const pix = taxaComprador('pix', valor, cfg), cartao = taxaComprador('cartao', valor, cfg);
  return `num pedido de ${brl(valor)}, ${brl(pix)} no Pix${comCartao ? ` ou ${brl(cartao)} no cartão` : ''}`;
}

/** Total que o comprador paga no método (pedido + taxa de serviço). */
export const totalComTaxa = (metodo: Metodo, total: number, cfg: ConfigTaxas) => r2(total + taxaComprador(metodo, total, cfg));

/**
 * Dias até o valor da venda ficar disponível para saque.
 * Contas: mais tempo (o golpe comum é recuperar a conta depois). Cartão: estorno pode chegar depois, então o maior prazo.
 * A "liberação rápida" por avaliação positiva só vale no Pix e fora de contas.
 */
export function diasDeLiberacao(tipo: unknown, metodo: unknown, cfg: ConfigTaxas, opt: { avaliacaoPositiva?: boolean; rapidoDias?: number } = {}) {
  const t = tipoValido(tipo);
  let dias = t === 'conta' ? cfg.liberaContaDias : cfg.liberaPadraoDias;
  if (metodo === 'cartao') return Math.max(dias, cfg.liberaCartaoDias);
  if (opt.avaliacaoPositiva && t !== 'conta' && opt.rapidoDias !== undefined) return Math.min(dias, opt.rapidoDias);
  return dias;
}

/**
 * Taxa do saque: o primeiro da semana (7 dias corridos) é grátis a partir de R$ saqueGratisMin
 * (abaixo disso a plataforma pagaria a tarifa do Pix de saque para mandar centavos).
 */
export const taxaDoSaque = (saquesNosUltimos7Dias: number, cfg: ConfigTaxas, valor?: number) =>
  saquesNosUltimos7Dias >= 1 || (valor !== undefined && valor < (cfg.saqueGratisMin || 0)) ? r2(cfg.saqueExtraTaxa) : 0;

/** Peso do plano para ordenar a vitrine (maior primeiro). */
export const pesoDoPlano = (plano: unknown, cfg: ConfigTaxas) => { const p = planoEfetivo(plano, cfg); return p === 'topo' ? 2 : p === 'destaque' ? 1 : 0; };

export const brl = (v: number) => 'R$ ' + r2(v).toFixed(2).replace('.', ',');
export const pctTexto = (v: number) => `${String(r2(v)).replace('.', ',')}%`;
