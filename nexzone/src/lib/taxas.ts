// ============================================================
// Modelo de taxas do marketplace (aprovado por Carlos e César em 28/10/2026). Funções puras.
//   • Vendedor: plano por anúncio — Básico 5% · Destaque 8% · Topo 11% (mais visibilidade = taxa maior)
//   • Comprador: taxa de serviço do meio de pagamento — Pix R$ 0,50 · cartão 5,99% + R$ 0,49
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
  compradorPix: number;                                             // R$ por pedido no Pix
  compradorCartaoPct: number; compradorCartaoFixo: number;          // % + R$ no cartão
  liberaContaDias: number; liberaPadraoDias: number; liberaCartaoDias: number;
  saqueExtraTaxa: number;                                           // R$ por saque além do grátis da semana
};

export const TAXAS_PADRAO: ConfigTaxas = {
  planoBasico: 5, planoDestaque: 8, planoTopo: 11,
  planosPagosAtivos: false, topoVagas: 3,
  compradorPix: 0.5, compradorCartaoPct: 5.99, compradorCartaoFixo: 0.49,
  liberaContaDias: 7, liberaPadraoDias: 3, liberaCartaoDias: 14,
  saqueExtraTaxa: 0.99,
};

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
  const reais = (k: string, d: number) => { const v = num(m[k], d); return v >= 0 && v <= 20 ? v : d; };
  const dias = (k: string, d: number) => { const v = Math.round(num(m[k], d)); return v >= 0 && v <= 60 ? v : d; };
  const bool = (v: any, d: boolean) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : d);
  return {
    planoBasico: pct('plano_basico_pct', P.planoBasico),
    planoDestaque: pct('plano_destaque_pct', P.planoDestaque),
    planoTopo: pct('plano_topo_pct', P.planoTopo),
    planosPagosAtivos: bool(m.planos_pagos_ativos, P.planosPagosAtivos),
    topoVagas: entre(Math.round(num(m.topo_vagas_categoria, P.topoVagas)), 1, 50),
    compradorPix: reais('taxa_comprador_pix', P.compradorPix),
    compradorCartaoPct: pct('taxa_comprador_cartao_pct', P.compradorCartaoPct),
    compradorCartaoFixo: reais('taxa_comprador_cartao_fixo', P.compradorCartaoFixo),
    liberaContaDias: dias('liberacao_conta_dias', P.liberaContaDias),
    liberaPadraoDias: dias('liberacao_padrao_dias', P.liberaPadraoDias),
    liberaCartaoDias: dias('liberacao_cartao_dias', P.liberaCartaoDias),
    saqueExtraTaxa: reais('saque_extra_taxa', P.saqueExtraTaxa),
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

/** Taxa de serviço do comprador para o meio de pagamento escolhido. */
export function taxaComprador(metodo: Metodo, total: number, cfg: ConfigTaxas): number {
  if (total <= 0) return 0;
  return metodo === 'cartao' ? r2(total * cfg.compradorCartaoPct / 100 + cfg.compradorCartaoFixo) : r2(cfg.compradorPix);
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

/** Taxa do saque: o primeiro da semana (7 dias corridos) é grátis. */
export const taxaDoSaque = (saquesNosUltimos7Dias: number, cfg: ConfigTaxas) => (saquesNosUltimos7Dias >= 1 ? r2(cfg.saqueExtraTaxa) : 0);

/** Peso do plano para ordenar a vitrine (maior primeiro). */
export const pesoDoPlano = (plano: unknown, cfg: ConfigTaxas) => { const p = planoEfetivo(plano, cfg); return p === 'topo' ? 2 : p === 'destaque' ? 1 : 0; };

export const brl = (v: number) => 'R$ ' + r2(v).toFixed(2).replace('.', ',');
export const pctTexto = (v: number) => `${String(r2(v)).replace('.', ',')}%`;
