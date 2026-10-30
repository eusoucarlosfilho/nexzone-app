// ============================================================
// Financeiro da plataforma (puro, testado em testes/financeiro.test.js).
// Regra de ouro: RECEITA da empresa = o que é dela (comissão, taxa do comprador, saques extras, destaques).
// O dinheiro do vendedor é de TERCEIROS: aparece como "vendido" e "em custódia", nunca como faturamento.
// ============================================================

export const CATEGORIAS = [
  { id: 'infraestrutura', rotulo: 'Infraestrutura (servidor, banco, domínio)' },
  { id: 'ferramentas', rotulo: 'Ferramentas e assinaturas' },
  { id: 'marketing', rotulo: 'Marketing e anúncios' },
  { id: 'contabilidade', rotulo: 'Contabilidade e jurídico' },
  { id: 'impostos', rotulo: 'Impostos (DAS e taxas)' },
  { id: 'pessoal', rotulo: 'Pró-labore e pessoas' },
  { id: 'gateway', rotulo: 'Tarifas bancárias e gateway (avulsas)' },
  { id: 'outros', rotulo: 'Outros' },
] as const;
export type Categoria = typeof CATEGORIAS[number]['id'];
export const rotuloCategoria = (c: string) => CATEGORIAS.find((x) => x.id === c)?.rotulo.split(' (')[0] ?? 'Outros';

export type TipoCusto = 'avulso' | 'mensal' | 'anual';
export type Custo = { id: number; descricao: string; categoria: Categoria; valor: number; tipo: TipoCusto; data: string; fim: string | null; pago_por: string | null; observacao: string | null; comprovante_nome?: string | null; tem_comprovante?: boolean };

export type ConfigFin = { custoPixMpPct?: number; custoPixPct: number; custoPixEntrada: number; custoPixSaida: number; custoCartaoPct: number; custoCartaoFixo: number; aliquotaDas: number };
export const CONFIG_FIN_PADRAO: ConfigFin = { custoPixMpPct: 0.99, custoPixPct: 0, custoPixEntrada: 0.5, custoPixSaida: 0.5, custoCartaoPct: 3.99, custoCartaoFixo: 0.39, aliquotaDas: 6 };

const num = (v: unknown, def: number, min: number, max: number) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return def;
  const n = Number(String(v).replace(/"/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};
export function lerConfigFin(m: Record<string, unknown>): ConfigFin {
  const P = CONFIG_FIN_PADRAO;
  return {
    custoPixMpPct: num(m.gw_pix_mp_pct, P.custoPixMpPct!, 0, 30),
    custoPixPct: num(m.fin_custo_pix_pct, P.custoPixPct, 0, 30),
    custoPixEntrada: num(m.fin_custo_pix_entrada, P.custoPixEntrada, 0, 50),
    custoPixSaida: num(m.fin_custo_pix_saida, P.custoPixSaida, 0, 50),
    custoCartaoPct: num(m.fin_custo_cartao_pct, P.custoCartaoPct, 0, 30),
    custoCartaoFixo: num(m.fin_custo_cartao_fixo, P.custoCartaoFixo, 0, 50),
    aliquotaDas: num(m.fin_aliquota_das, P.aliquotaDas, 0, 40),
  };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const mesDe = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 7) : '');

/** Lista de meses "AAAA-MM" do mais antigo ao atual. */
export function ultimosMeses(qtd: number, hoje = new Date()): string[] {
  const out: string[] = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Quanto um custo pesa num mês: avulso no mês da data; mensal todo mês entre início e fim; anual no mês de aniversário. */
export function valorNoMes(c: Pick<Custo, 'valor' | 'tipo' | 'data' | 'fim'>, mes: string): number {
  const inicio = mesDe(c.data);
  if (!inicio || mes < inicio) return 0;
  if (c.fim && mes > mesDe(c.fim)) return 0;
  if (c.tipo === 'avulso') return mes === inicio ? Number(c.valor) : 0;
  if (c.tipo === 'mensal') return Number(c.valor);
  return mes.slice(5) === inicio.slice(5) ? Number(c.valor) : 0; // anual
}

export type PedidoFin = { status: string; total: number; taxa: number; valor_vendedor: number; forma_pagamento: string | null; taxa_comprador_pix: number | null; taxa_comprador_cartao: number | null; created_at: string; entregue_em: string | null; gateway_ref?: string | null };
export type SaqueFin = { status: string; valor: number; taxa_saque: number | null; created_at: string; pago_em: string | null };
export type DestaqueFin = { status: string; valor: number; created_at: string; pago_em: string | null };

/** Receita da plataforma e custo do gateway de UM pedido. Reembolsado: receita zera, a tarifa de entrada fica. */
export function financeiroDoPedido(o: PedidoFin, cfg: ConfigFin) {
  const cartao = o.forma_pagamento === 'cartao';
  const taxaComprador = cartao ? Number(o.taxa_comprador_cartao || 0) : Number(o.taxa_comprador_pix || 0);
  const cobrado = Number(o.total) + taxaComprador;
  const gateway = cartao ? cobrado * cfg.custoCartaoPct / 100 + cfg.custoCartaoFixo : String(o.gateway_ref || '').startsWith('mp:') ? cobrado * (cfg.custoPixMpPct ?? 0.99) / 100 // Pix pelo Mercado Pago (% sem mínimo)
    : cobrado * (cfg.custoPixPct || 0) / 100 + cfg.custoPixEntrada;
  const reemb = o.status === 'reembolsado';
  return {
    comissao: reemb ? 0 : Number(o.taxa || 0),
    taxaComprador: reemb ? 0 : taxaComprador,
    gmv: reemb ? 0 : Number(o.total),
    repasse: reemb ? 0 : Number(o.valor_vendedor || 0),
    gateway: r2(gateway),
  };
}

export type MesFin = {
  mes: string;
  receita: { comissao: number; taxaComprador: number; saques: number; destaques: number; total: number };
  gatewayAuto: number; custosLancados: number; porCategoria: Record<string, number>;
  imposto: { estimado: number; lancado: number; usado: number; real: boolean };
  custoTotal: number; resultado: number; gmv: number; repasse: number; pagoVendedores: number; pedidos: number;
};

export function montarFinanceiro(p: { pedidos: PedidoFin[]; saques: SaqueFin[]; destaques: DestaqueFin[]; custos: Custo[]; cfg: ConfigFin; meses: string[] }) {
  const base = (): MesFin => ({ mes: '', receita: { comissao: 0, taxaComprador: 0, saques: 0, destaques: 0, total: 0 }, gatewayAuto: 0, custosLancados: 0, porCategoria: {}, imposto: { estimado: 0, lancado: 0, usado: 0, real: false }, custoTotal: 0, resultado: 0, gmv: 0, repasse: 0, pagoVendedores: 0, pedidos: 0 });
  const mapa = new Map<string, MesFin>(p.meses.map((m) => [m, { ...base(), mes: m }]));

  for (const o of p.pedidos) {
    if (!['pago', 'entregue', 'reembolsado'].includes(o.status)) continue;
    const m = mapa.get(mesDe(o.entregue_em || o.created_at)); if (!m) continue;
    const f = financeiroDoPedido(o, p.cfg);
    m.receita.comissao += f.comissao; m.receita.taxaComprador += f.taxaComprador; m.gatewayAuto += f.gateway;
    m.gmv += f.gmv; m.repasse += f.repasse; if (o.status !== 'reembolsado') m.pedidos++;
  }
  for (const s of p.saques) {
    if (s.status !== 'pago') continue;
    const m = mapa.get(mesDe(s.pago_em || s.created_at)); if (!m) continue;
    m.receita.saques += Number(s.taxa_saque || 0); m.gatewayAuto += p.cfg.custoPixSaida; m.pagoVendedores += Number(s.valor || 0);
  }
  for (const d of p.destaques) {
    if (d.status !== 'pago') continue;
    const m = mapa.get(mesDe(d.pago_em || d.created_at)); if (!m) continue;
    m.receita.destaques += Number(d.valor || 0); m.gatewayAuto += p.cfg.custoPixEntrada;
  }
  mapa.forEach((m) => {
    for (const c of p.custos) {
      const v = valorNoMes(c, m.mes); if (!v) continue;
      if (c.categoria === 'impostos') m.imposto.lancado += v;
      else { m.custosLancados += v; m.porCategoria[c.categoria] = (m.porCategoria[c.categoria] || 0) + v; }
    }
    m.receita.total = r2(m.receita.comissao + m.receita.taxaComprador + m.receita.saques + m.receita.destaques);
    m.imposto.estimado = r2(m.receita.total * p.cfg.aliquotaDas / 100);
    m.imposto.real = m.imposto.lancado > 0;
    m.imposto.usado = r2(m.imposto.real ? m.imposto.lancado : m.imposto.estimado); // DAS lançado substitui a estimativa
    for (const k of ['comissao', 'taxaComprador', 'saques', 'destaques'] as const) m.receita[k] = r2(m.receita[k]);
    m.gatewayAuto = r2(m.gatewayAuto); m.custosLancados = r2(m.custosLancados); m.imposto.lancado = r2(m.imposto.lancado);
    m.gmv = r2(m.gmv); m.repasse = r2(m.repasse); m.pagoVendedores = r2(m.pagoVendedores);
    m.custoTotal = r2(m.gatewayAuto + m.custosLancados + m.imposto.usado);
    m.resultado = r2(m.receita.total - m.custoTotal);
  });
  const meses = p.meses.map((m) => mapa.get(m)!);
  return { meses, acumulado: acumular(meses) };
}

function acumular(meses: MesFin[]) {
  const s = (f: (m: MesFin) => number) => r2(meses.reduce((a, m) => a + f(m), 0));
  return { receita: s((m) => m.receita.total), custos: s((m) => m.custoTotal), resultado: s((m) => m.resultado), gmv: s((m) => m.gmv), lancados: s((m) => m.custosLancados + m.imposto.lancado) };
}

/** Custo fixo mensal de hoje: recorrentes ativos (anual dividido por 12). */
export function custoFixoMensal(custos: Custo[], mes: string): number {
  return r2(custos.reduce((a, c) => {
    if (c.tipo === 'avulso') return a;
    if (mesDe(c.data) > mes || (c.fim && mesDe(c.fim) < mes)) return a;
    return a + (c.tipo === 'mensal' ? Number(c.valor) : Number(c.valor) / 12);
  }, 0));
}

/** Total já gasto desde o início (custos lançados até o mês atual, sem estimativas). */
export function totalGasto(custos: Custo[], ateMes: string): number {
  let total = 0;
  for (const c of custos) {
    const ini = mesDe(c.data);
    if (!ini || ini > ateMes) continue;
    if (c.tipo === 'avulso') { total += Number(c.valor); continue; }
    const fim = c.fim && mesDe(c.fim) < ateMes ? mesDe(c.fim) : ateMes;
    const [ay, am] = ini.split('-').map(Number); const [by, bm] = fim.split('-').map(Number);
    const meses = (by - ay) * 12 + (bm - am) + 1;
    if (meses <= 0) continue;
    total += c.tipo === 'mensal' ? meses * Number(c.valor) : Math.ceil(meses / 12) * Number(c.valor);
  }
  return r2(total);
}

/** "1.234,56", "29,90", "29.90" ou número. */
export function valorDigitado(x: unknown): number {
  if (typeof x === 'number') return x;
  const s = String(x ?? '').replace(/[R$\s]/g, '').trim();
  if (!s) return NaN;
  return s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
}

/** Valida um custo digitado no admin. */
export function validarCusto(b: any): { ok: true; custo: Omit<Custo, 'id'> } | { ok: false; erro: string } {
  const descricao = String(b?.descricao ?? '').replace(/[<>]/g, '').trim().slice(0, 120);
  if (descricao.length < 2) return { ok: false, erro: 'Descreva o custo (ex.: Vercel, Contadora).' };
  const categoria = String(b?.categoria ?? '') as Categoria;
  if (!CATEGORIAS.some((c) => c.id === categoria)) return { ok: false, erro: 'Escolha a categoria.' };
  const valorNum = Math.round(valorDigitado(b?.valor) * 100) / 100;
  if (!Number.isFinite(valorNum) || valorNum <= 0 || valorNum >= 10000000) return { ok: false, erro: 'Valor inválido.' };
  const tipo = String(b?.tipo ?? 'avulso') as TipoCusto;
  if (!['avulso', 'mensal', 'anual'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' };
  const data = String(b?.data ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || isNaN(Date.parse(data))) return { ok: false, erro: 'Data inválida.' };
  const fim = b?.fim ? String(b.fim) : null;
  if (fim && (!/^\d{4}-\d{2}-\d{2}$/.test(fim) || fim < data)) return { ok: false, erro: 'O fim precisa ser depois do início.' };
  const pago_por = String(b?.pago_por ?? '').replace(/[<>]/g, '').trim().slice(0, 40) || null;
  const observacao = String(b?.observacao ?? '').replace(/[<>]/g, '').trim().slice(0, 300) || null;
  return { ok: true, custo: { descricao, categoria, valor: valorNum, tipo, data, fim: tipo === 'avulso' ? null : fim, pago_por, observacao } };
}

/** Planilha para a contadora (CSV com ; e vírgula decimal). */
export function csvMes(m: MesFin, custos: Custo[]): string {
  const v = (n: number) => n.toFixed(2).replace('.', ',');
  const linhas: string[][] = [
    ['Tipo', 'Descrição', 'Categoria', 'Valor (R$)', 'Observação'],
    ['Receita', 'Comissões dos vendedores', '', v(m.receita.comissao), 'Somente a parte da plataforma'],
    ['Receita', 'Taxa de serviço do comprador', '', v(m.receita.taxaComprador), ''],
    ['Receita', 'Saques extras', '', v(m.receita.saques), ''],
    ['Receita', 'Planos Destaque/Topo', '', v(m.receita.destaques), ''],
    ['Custo', 'Tarifas de pagamento (automático)', 'Gateway', v(m.gatewayAuto), 'Estimado pelas tarifas configuradas'],
    ...custos.filter((c) => valorNoMes(c, m.mes) > 0).map((c) => ['Custo', c.descricao, rotuloCategoria(c.categoria), v(valorNoMes(c, m.mes)), [c.tipo !== 'avulso' ? c.tipo : '', c.pago_por ? `pago por ${c.pago_por}` : '', c.observacao || ''].filter(Boolean).join(' · ')]),
    ...(m.imposto.real ? [] : [['Imposto', 'DAS estimado', 'Impostos', v(m.imposto.estimado), 'Estimativa; substitua lançando o DAS real']]),
    ['Terceiros', 'Total vendido pelos lojistas (não é receita)', '', v(m.gmv), 'Valores de terceiros em trânsito'],
    ['Terceiros', 'Parte dos vendedores (a repassar)', '', v(m.repasse), ''],
    ['Terceiros', 'Saques pagos aos vendedores', '', v(m.pagoVendedores), ''],
    ['Resultado', 'Receita − custos − imposto', '', v(m.resultado), ''],
  ];
  return linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

// ---------- Conferência das taxas, pedido a pedido (auditoria) ----------
export type PedidoAuditoria = PedidoFin & { id: string; pct_vendedor: number | null; titulo?: string | null; loja?: string | null };
export type Alerta = 'divisao' | 'acima_do_plano' | 'abaixo_do_plano' | 'prejuizo' | 'sem_taxa_comprador' | 'modelo_antigo';
export const ROTULO_ALERTA: Record<Alerta, string> = {
  divisao: 'Taxa + vendedor não fecha com o total',
  acima_do_plano: 'Plataforma cobrou do vendedor MAIS que o % do plano',
  abaixo_do_plano: 'Plataforma ficou com MENOS que o % do plano (pontos ou ajuste)',
  prejuizo: 'Pedido deu prejuízo (tarifa do gateway maior que o que ficou)',
  sem_taxa_comprador: 'Comprador não pagou taxa de serviço (1ª compra grátis ou pedido antigo)',
  modelo_antigo: 'Pedido do modelo antigo (antes dos planos): sem % do plano gravado',
};
const GRAVES: Alerta[] = ['divisao', 'acima_do_plano', 'prejuizo'];

/** Confere UM pedido pago: divisão, % do plano, taxa do comprador e se sobrou dinheiro depois do gateway. */
export function auditarPedido(o: PedidoAuditoria, cfg: ConfigFin) {
  const total = Number(o.total) || 0, taxa = Number(o.taxa) || 0, vend = Number(o.valor_vendedor) || 0;
  const f = financeiroDoPedido({ ...o, forma_pagamento: o.forma_pagamento ?? 'pix' }, cfg);
  const cartao = o.forma_pagamento === 'cartao';
  const taxaComprador = cartao ? Number(o.taxa_comprador_cartao || 0) : Number(o.taxa_comprador_pix || 0);
  const liquido = r2(taxa + taxaComprador - f.gateway);
  const alertas: Alerta[] = [];
  if (Math.abs(taxa + vend - total) > 0.011) alertas.push('divisao');
  if (o.pct_vendedor === null || o.pct_vendedor === undefined) alertas.push('modelo_antigo');
  else {
    const esperada = r2(total * Number(o.pct_vendedor) / 100);
    if (taxa > esperada + 0.011) alertas.push('acima_do_plano');
    else if (taxa < esperada - 0.011) alertas.push('abaixo_do_plano');
  }
  if (!(taxaComprador > 0)) alertas.push('sem_taxa_comprador');
  if (liquido < -0.005) alertas.push('prejuizo');
  return {
    id: o.id, data: o.entregue_em || o.created_at, titulo: o.titulo ?? null, loja: o.loja ?? null, forma: o.forma_pagamento ?? null,
    total: r2(total), pct: o.pct_vendedor ?? null, taxa: r2(taxa), vendedor: r2(vend), taxaComprador: r2(taxaComprador),
    gateway: f.gateway, liquido, alertas, grave: alertas.some((a) => GRAVES.includes(a)),
  };
}

/** Confere todos os pedidos pagos e resume: quantos ok, quantos com alerta, totais. Graves primeiro. */
export function auditarPedidos(pedidos: PedidoAuditoria[], cfg: ConfigFin) {
  const linhas = pedidos.filter((o) => o.status === 'pago' || o.status === 'entregue').map((o) => auditarPedido(o, cfg));
  const soma = (k: 'total' | 'taxa' | 'taxaComprador' | 'gateway' | 'liquido' | 'vendedor') => r2(linhas.reduce((a, l) => a + l[k], 0));
  const porAlerta: Record<string, number> = {};
  for (const l of linhas) for (const a of l.alertas) porAlerta[a] = (porAlerta[a] || 0) + 1;
  linhas.sort((a, b) => Number(b.grave) - Number(a.grave) || (b.data > a.data ? 1 : -1));
  return {
    pedidos: linhas.length, graves: linhas.filter((l) => l.grave).length, porAlerta,
    totais: { faturamento: soma('total'), vendedores: soma('vendedor'), comissao: soma('taxa'), taxaComprador: soma('taxaComprador'), gateway: soma('gateway'), liquido: soma('liquido') },
    linhas,
  };
}
