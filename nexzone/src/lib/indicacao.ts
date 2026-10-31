// ============================================================
// Programa de indicação de compradores. PURO: testado em testes/indicacao.test.js.
//  • link: compreibarato.com.br/?ref=CODIGO (8 caracteres, sem 0/O/1/I para não confundir);
//  • o vínculo nasce no cadastro (conta nova, código válido, não é a própria pessoa);
//  • recompensa = CB Points, só na 1ª compra PAGA do indicado e só depois do prazo de liberação;
//  • reembolso antes do prazo cancela; depois do prazo, os pontos são estornados;
//  • tudo idempotente: 1 indicação por pessoa indicada (unique) e mudança de estado condicional.
// O programa nasce DESLIGADO e com 0 pontos: quem define valor, mínimo, prazo e limites é o admin.
//
// Proteção de margem (o custo nunca passa do que a venda rendeu, e o mês tem teto):
//  1. recompensa = MENOR entre os pontos fixos e X% da comissão da plataforma NAQUELE pedido (como o cashback);
//     comissão que não cobre nem 1 ponto = indicação não elegível (nunca paga para vender);
//  2. orçamento mensal em R$: liberação que estoura o mês fica pendente para o 1º dia do mês seguinte;
//  3. o ponto não vira dinheiro: só desconto, e o desconto numa compra nunca passa da comissão dela.
// ============================================================
export type CfgIndicacao = {
  ativo: boolean;
  pontos: number;            // pontos por indicação convertida (0 = não paga nada)
  minimo: number;            // valor mínimo da 1ª compra (R$)
  prazoDias: number;         // dias depois da compra para liberar (cobre a garantia/reembolso)
  inicio: string | null;     // validade da campanha
  fim: string | null;
  limitePorUsuario: number;  // recompensas liberadas/pendentes por indicador (0 = sem limite)
  produtos: 'todos' | 'lista';
  produtosIds: string[];
  contaNovaHoras: number;    // só vincula contas criadas há até X horas
  alertaCadastrosDia: number;// mais que isso em 24 h pelo mesmo código vira alerta para o admin
  tetoComissaoPct: number;   // recompensa nunca passa desta % da comissão da plataforma no pedido do amigo
  orcamentoMensal: number;   // R$ por mês em pontos liberados (0 = programa não libera nada)
};
export const CHAVE_INDICACAO = 'indicacao_cfg';
export const INDICACAO_PADRAO: CfgIndicacao = {
  ativo: false, pontos: 0, minimo: 0, prazoDias: 7, inicio: null, fim: null, limitePorUsuario: 20,
  produtos: 'todos', produtosIds: [], contaNovaHoras: 72, alertaCadastrosDia: 10,
  tetoComissaoPct: 30, orcamentoMensal: 300,
};
export type StatusIndicacao = 'cadastrado' | 'pendente' | 'liberada' | 'bloqueada' | 'cancelada' | 'estornada';
export const ROTULO_STATUS: Record<StatusIndicacao, string> = {
  cadastrado: 'Cadastrou, ainda sem compra', pendente: 'Comprou: pontos em liberação', liberada: 'Pontos liberados',
  bloqueada: 'Em análise', cancelada: 'Não elegível', estornada: 'Compra reembolsada',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODIGO = /^[A-Z2-9]{8}$/;

const int = (v: unknown, min: number, max: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const data = (v: unknown) => { if (typeof v !== 'string' || !v) return null; const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

export function normalizarCfgIndicacao(v: any): CfgIndicacao {
  const o = v && typeof v === 'object' ? v : (() => { try { return JSON.parse(String(v || '')); } catch { return {}; } })() || {};
  const P = INDICACAO_PADRAO;
  const ids = Array.isArray(o.produtosIds) ? Array.from(new Set(o.produtosIds.map((x: any) => String(x).toLowerCase()).filter((x: string) => UUID.test(x)))).slice(0, 200) as string[] : [];
  return {
    ativo: o.ativo === true,
    pontos: int(o.pontos, 0, 100000, P.pontos),
    minimo: Math.min(100000, Math.max(0, Math.round(Number(o.minimo) * 100) / 100 || 0)),
    prazoDias: int(o.prazoDias, 0, 90, P.prazoDias),
    inicio: data(o.inicio), fim: data(o.fim),
    limitePorUsuario: int(o.limitePorUsuario, 0, 10000, P.limitePorUsuario),
    produtos: o.produtos === 'lista' ? 'lista' : 'todos',
    produtosIds: ids,
    contaNovaHoras: int(o.contaNovaHoras, 1, 720, P.contaNovaHoras),
    alertaCadastrosDia: int(o.alertaCadastrosDia, 1, 1000, P.alertaCadastrosDia),
    tetoComissaoPct: int(o.tetoComissaoPct, 0, 100, P.tetoComissaoPct),
    orcamentoMensal: (() => { const n = Math.round(Number(o.orcamentoMensal ?? P.orcamentoMensal) * 100) / 100; return Number.isFinite(n) ? Math.min(1000000, Math.max(0, n)) : P.orcamentoMensal; })(),
  };
}

/** Programa valendo agora (ligado, com pontos e dentro da validade). */
export function programaNoAr(c: CfgIndicacao, agora = Date.now()): boolean {
  if (!c.ativo || !(c.pontos > 0) || !(c.tetoComissaoPct > 0) || !(c.orcamentoMensal > 0)) return false;
  if (c.inicio && Date.parse(c.inicio) > agora) return false;
  if (c.fim && Date.parse(c.fim) <= agora) return false;
  return true;
}

/** Código novo: 8 caracteres do alfabeto sem 0/O/1/I e nunca 3 dígitos seguidos (o rastreador descarta sequências numéricas). */
export function gerarCodigo(rand: () => number = Math.random): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < 8; i++) c += ALFABETO[Math.floor(rand() * ALFABETO.length) % ALFABETO.length];
    if (!/\d{3}/.test(c) && /[A-Z]/.test(c)) return c;
  }
}

/** Pode criar o vínculo indicador → indicado (no cadastro)? */
export function podeVincular(p: { cfg: CfgIndicacao; agora?: number; indicadorId: string | null; indicadoId: string; contaCriadaEm: string; codigoBloqueado: boolean; jaTemCompraPaga: boolean; jaIndicado: boolean }):
  { ok: true } | { ok: false; motivo: string } {
  const agora = p.agora ?? Date.now();
  if (!programaNoAr(p.cfg, agora)) return { ok: false, motivo: 'programa fora do ar' };
  if (!p.indicadorId) return { ok: false, motivo: 'código inexistente' };
  if (p.codigoBloqueado) return { ok: false, motivo: 'código bloqueado' };
  if (p.indicadorId === p.indicadoId) return { ok: false, motivo: 'autoindicação' };
  if (p.jaIndicado) return { ok: false, motivo: 'já indicado' };
  if (p.jaTemCompraPaga) return { ok: false, motivo: 'já era comprador' };
  const criado = Date.parse(p.contaCriadaEm);
  if (!Number.isFinite(criado) || agora - criado > p.cfg.contaNovaHoras * 3600000) return { ok: false, motivo: 'conta antiga' };
  return { ok: true };
}

/** A 1ª compra paga converte a indicação? Retorna pontos e data de liberação, ou o motivo de não pagar. */
export function avaliarConversao(p: {
  cfg: CfgIndicacao; agora?: number;
  pedido: { total: number; product_id: string; dono_loja: string | null; comissao: number };
  pontosPorReal: number;            // quantos pontos valem R$ 1 (configuração do CB Points)
  indicadorId: string; indicadoId: string;
  comprasPagasDoIndicado: number;   // incluindo esta
  recompensasDoIndicador: number;   // pendentes + liberadas
}): { ok: true; pontos: number; liberaEm: string } | { ok: false; status: 'cancelada' | 'bloqueada'; motivo: string } {
  const agora = p.agora ?? Date.now();
  if (!programaNoAr(p.cfg, agora)) return { ok: false, status: 'cancelada', motivo: 'Programa fora do ar na data da compra.' };
  if (p.comprasPagasDoIndicado > 1) return { ok: false, status: 'cancelada', motivo: 'Não é a primeira compra.' };
  if (Number(p.pedido.total) < p.cfg.minimo) return { ok: false, status: 'cancelada', motivo: `Compra abaixo do mínimo de R$ ${p.cfg.minimo.toFixed(2).replace('.', ',')}.` };
  if (p.cfg.produtos === 'lista' && !p.cfg.produtosIds.includes(String(p.pedido.product_id).toLowerCase())) return { ok: false, status: 'cancelada', motivo: 'Produto fora da campanha.' };
  if (p.cfg.limitePorUsuario > 0 && p.recompensasDoIndicador >= p.cfg.limitePorUsuario) return { ok: false, status: 'cancelada', motivo: 'Indicador atingiu o limite de recompensas.' };
  // quem indicou é o dono da loja que vendeu: compra "de si mesmo" — vai para análise do admin
  if (p.pedido.dono_loja && p.pedido.dono_loja === p.indicadorId) return { ok: false, status: 'bloqueada', motivo: 'Compra na loja de quem indicou.' };
  const pontos = pontosDaIndicacao(p.cfg, p.pedido.comissao, p.pontosPorReal);
  if (pontos <= 0) return { ok: false, status: 'cancelada', motivo: 'A comissão da plataforma neste pedido não cobre a recompensa.' };
  return { ok: true, pontos, liberaEm: new Date(agora + p.cfg.prazoDias * 86400000).toISOString() };
}

/** Link pessoal. */
export const linkIndicacao = (site: string, codigo: string) => `${site.replace(/\/+$/, '')}/?ref=${codigo}`;

/** Mensagem pronta para o WhatsApp (sem prometer o que o programa não dá ao indicado). */
export const textoConvite = (link: string) =>
  `Tô usando o Comprei Barato para comprar produtos digitais e serviços: pagamento por Pix e o dinheiro fica protegido até a entrega. Dá uma olhada: ${link}`;

// ---------- Margem e orçamento ----------
/** Pontos da indicação: o menor entre o fixo do admin e o teto (% da comissão do pedido, em pontos). */
export function pontosDaIndicacao(c: CfgIndicacao, comissaoPedido: number, pontosPorReal: number): number {
  const com = Number(comissaoPedido), ppr = Number(pontosPorReal);
  if (!(com > 0) || !(ppr > 0) || !(c.tetoComissaoPct > 0) || !(c.pontos > 0)) return 0;
  const teto = Math.floor(com * (c.tetoComissaoPct / 100) * ppr + 1e-6);
  return Math.max(0, Math.min(c.pontos, teto));
}
/** Valor em R$ de uma quantidade de pontos. */
export const reaisDosPontos = (pontos: number, pontosPorReal: number) => (pontosPorReal > 0 ? Math.round((Number(pontos) / pontosPorReal) * 100) / 100 : 0);

const FUSO = 3 * 3600000;
/** Início do mês (Brasília) que contém `agora`, e o início do mês seguinte, em ms. */
export function mesBR(agora = Date.now()): { ini: number; prox: number } {
  const d = new Date(agora - FUSO);
  return { ini: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + FUSO, prox: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) + FUSO };
}
/** Cabe no orçamento do mês? `usadoNoMes` = R$ já liberado em pontos de indicação neste mês. */
export function cabeNoOrcamento(c: CfgIndicacao, usadoNoMes: number, pontos: number, pontosPorReal: number): boolean {
  if (!(c.orcamentoMensal > 0)) return false;
  return usadoNoMes + reaisDosPontos(pontos, pontosPorReal) <= c.orcamentoMensal + 1e-6;
}
