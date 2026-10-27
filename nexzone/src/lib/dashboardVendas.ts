// ============================================================
// Dashboard do admin — cálculos (puro, sem rede). Usado pelo painel e pelos testes.
// Datas no fuso de quem abre o painel (o admin está no Brasil).
// Data da venda = quando o pagamento foi confirmado (entregue_em); sem ela, a data do pedido.
// ============================================================

/** Pedido "enxuto" que o servidor manda para o painel */
export type VendaDash = {
  i: string;          // id
  s: string;          // status
  v: number;          // total pago pelo cliente
  t: number;          // taxa (receita da plataforma)
  r: number;          // valor do vendedor
  c: string;          // criado em
  p: string | null;   // pago/entregue em
  l: string;          // loja (store_id)
  d: string;          // produto (product_id)
  u: string;          // comprador
  f: 'pix' | 'cartao' | null; // forma de pagamento (SQL 17); null = não identificado
};
export type ExtraDash = { valor: number; em: string; status: string };

export type Periodo = { de: Date; ate: Date };   // [de, ate)
export type Agrupamento = 'dia' | 'semana' | 'mes';
export type Filtro = { loja: string; forma: 'todas' | 'pix' | 'cartao' };

export const PRESETS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
  { id: '90d', rotulo: '90 dias' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mes_passado', rotulo: 'Mês passado' },
  { id: 'ano', rotulo: 'Este ano' },
  { id: '12m', rotulo: '12 meses' },
  { id: 'tudo', rotulo: 'Tudo' },
] as const;
export type PresetId = typeof PRESETS[number]['id'];

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const inicioDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const pago = (s: string) => s === 'pago' || s === 'entregue';
export const dataVenda = (v: VendaDash) => new Date(v.p || v.c);

/** Período de um atalho. "30 dias" = hoje + 29 dias para trás (30 dias corridos). */
export function periodoDoPreset(id: PresetId, agora: Date, primeiraData?: Date): Periodo {
  const hoje = inicioDoDia(agora);
  const amanha = somarDias(hoje, 1);
  switch (id) {
    case 'hoje': return { de: hoje, ate: amanha };
    case '7d': return { de: somarDias(hoje, -6), ate: amanha };
    case '30d': return { de: somarDias(hoje, -29), ate: amanha };
    case '90d': return { de: somarDias(hoje, -89), ate: amanha };
    case 'mes': return { de: inicioDoMes(hoje), ate: amanha };
    case 'mes_passado': return { de: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), ate: inicioDoMes(hoje) };
    case 'ano': return { de: new Date(hoje.getFullYear(), 0, 1), ate: amanha };
    case '12m': return { de: new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1), ate: amanha };
    case 'tudo': return { de: primeiraData ? inicioDoDia(primeiraData) : somarDias(hoje, -29), ate: amanha };
  }
}

/** Um mês inteiro: "2026-09" */
export function periodoDoMes(chave: string): Periodo | null {
  const m = /^(\d{4})-(\d{2})$/.exec(chave);
  if (!m) return null;
  const a = Number(m[1]), mm = Number(m[2]) - 1;
  if (mm < 0 || mm > 11) return null;
  return { de: new Date(a, mm, 1), ate: new Date(a, mm + 1, 1) };
}

/** Datas digitadas (yyyy-mm-dd), "até" inclusivo */
export function periodoPersonalizado(de: string, ate: string): Periodo | null {
  const p = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const a = p(de), b = p(ate);
  if (!a || !b || b < a) return null;
  return { de: a, ate: somarDias(b, 1) };
}

/** Período anterior do mesmo tamanho (para comparar). Mês inteiro compara com o mês anterior inteiro. */
export function periodoAnterior(p: Periodo): Periodo {
  const mesInteiro = p.de.getDate() === 1 && p.ate.getDate() === 1 && p.de.getHours() === 0
    && (p.ate.getFullYear() * 12 + p.ate.getMonth()) - (p.de.getFullYear() * 12 + p.de.getMonth()) === 1;
  if (mesInteiro) return { de: new Date(p.de.getFullYear(), p.de.getMonth() - 1, 1), ate: p.de };
  const dias = Math.round((inicioDoDia(p.ate).getTime() - inicioDoDia(p.de).getTime()) / 86400000);
  return { de: somarDias(p.de, -dias), ate: p.de };
}

export const diasDoPeriodo = (p: Periodo) => Math.max(1, Math.round((inicioDoDia(p.ate).getTime() - inicioDoDia(p.de).getTime()) / 86400000));
export function agrupamentoAutomatico(p: Periodo): Agrupamento {
  const d = diasDoPeriodo(p);
  return d <= 45 ? 'dia' : d <= 190 ? 'semana' : 'mes';
}

const dentro = (d: Date, p: Periodo) => d >= p.de && d < p.ate;
export const passaFiltro = (v: VendaDash, f: Filtro) =>
  (!f.loja || f.loja === 'todas' || v.l === f.loja) && (f.forma === 'todas' || v.f === f.forma);

export type Resumo = {
  faturamento: number; receita: number; repasse: number; vendas: number; ticket: number;
  pix: { valor: number; qtd: number }; cartao: { valor: number; qtd: number }; semForma: { valor: number; qtd: number };
  pedidosCriados: number; conversao: number;          // pagos ÷ pedidos criados no período
  pendentes: { valor: number; qtd: number };           // pedidos do período ainda aguardando pagamento
  reembolsos: { valor: number; qtd: number };
  compradores: number; compradoresNovos: number;
};

export function resumir(vendas: VendaDash[], p: Periodo, f: Filtro): Resumo {
  const r: Resumo = {
    faturamento: 0, receita: 0, repasse: 0, vendas: 0, ticket: 0,
    pix: { valor: 0, qtd: 0 }, cartao: { valor: 0, qtd: 0 }, semForma: { valor: 0, qtd: 0 },
    pedidosCriados: 0, conversao: 0, pendentes: { valor: 0, qtd: 0 }, reembolsos: { valor: 0, qtd: 0 },
    compradores: 0, compradoresNovos: 0,
  };
  const quem = new Set<string>();
  const primeiraCompra = new Map<string, number>();
  for (const v of vendas) {
    if (!passaFiltro(v, { ...f, forma: 'todas' })) continue;
    if (pago(v.s) || v.s === 'reembolsado') {
      const t = dataVenda(v).getTime();
      if (pago(v.s) && (!primeiraCompra.has(v.u) || t < primeiraCompra.get(v.u)!)) primeiraCompra.set(v.u, t);
    }
    if (!passaFiltro(v, f)) continue;
    if (dentro(new Date(v.c), p)) {
      r.pedidosCriados++;
      if (v.s === 'pendente') { r.pendentes.qtd++; r.pendentes.valor += v.v; }
    }
    if (v.s === 'reembolsado' && dentro(dataVenda(v), p)) { r.reembolsos.qtd++; r.reembolsos.valor += v.v; }
    if (!pago(v.s) || !dentro(dataVenda(v), p)) continue;
    r.vendas++; r.faturamento += v.v; r.receita += v.t; r.repasse += v.r;
    const alvo = v.f === 'pix' ? r.pix : v.f === 'cartao' ? r.cartao : r.semForma;
    alvo.qtd++; alvo.valor += v.v;
    quem.add(v.u);
  }
  r.ticket = r.vendas ? r.faturamento / r.vendas : 0;
  // conversão só conta pedidos CRIADOS e pagos no período (não mistura com pagamentos de pedidos antigos)
  const pagosDosCriados = vendas.filter((v) => passaFiltro(v, f) && dentro(new Date(v.c), p) && pago(v.s)).length;
  r.conversao = r.pedidosCriados ? pagosDosCriados / r.pedidosCriados : 0;
  r.compradores = quem.size;
  quem.forEach((u) => { const t = primeiraCompra.get(u); if (t !== undefined && t >= p.de.getTime() && t < p.ate.getTime()) r.compradoresNovos++; });
  for (const k of ['faturamento', 'receita', 'repasse', 'ticket'] as const) r[k] = Math.round(r[k] * 100) / 100;
  return r;
}

/** Variação em % (null quando não dá para comparar) */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return atual ? null : 0;
  return ((atual - anterior) / anterior) * 100;
}

export type Balde = { chave: string; rotulo: string; dica: string; de: Date; pix: number; cartao: number; outro: number; total: number; vendas: number; receita: number };

/** Inícios dos baldes do gráfico (dia, semana começando na segunda, ou mês) */
export function baldes(p: Periodo, g: Agrupamento): Balde[] {
  const out: Balde[] = [];
  let d = g === 'mes' ? inicioDoMes(p.de) : g === 'semana' ? somarDias(inicioDoDia(p.de), -((p.de.getDay() + 6) % 7)) : inicioDoDia(p.de);
  let guarda = 0;
  while (d < p.ate && guarda++ < 800) {
    const prox = g === 'mes' ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : somarDias(d, g === 'semana' ? 7 : 1);
    const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
    const rotulo = g === 'mes' ? `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` : `${dd}/${mm}`;
    const fim = somarDias(prox, -1);
    const dica = g === 'mes' ? `${MESES[d.getMonth()]} de ${d.getFullYear()}`
      : g === 'semana' ? `${dd}/${mm} a ${String(fim.getDate()).padStart(2, '0')}/${String(fim.getMonth() + 1).padStart(2, '0')}`
      : `${DIAS_SEMANA[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}`;
    out.push({ chave: d.toISOString(), rotulo, dica, de: d, pix: 0, cartao: 0, outro: 0, total: 0, vendas: 0, receita: 0 });
    d = prox;
  }
  return out;
}

export function serie(vendas: VendaDash[], p: Periodo, g: Agrupamento, f: Filtro): Balde[] {
  const bs = baldes(p, g);
  if (!bs.length) return bs;
  for (const v of vendas) {
    if (!pago(v.s) || !passaFiltro(v, f)) continue;
    const d = dataVenda(v);
    if (!dentro(d, p)) continue;
    // último balde cujo início é <= d
    let lo = 0, hi = bs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (bs[m].de <= d) lo = m; else hi = m - 1; }
    const b = bs[lo];
    if (v.f === 'pix') b.pix += v.v; else if (v.f === 'cartao') b.cartao += v.v; else b.outro += v.v;
    b.total += v.v; b.vendas++; b.receita += v.t;
  }
  return bs;
}

export type LinhaMes = { chave: string; rotulo: string; vendas: number; faturamento: number; pix: number; cartao: number; outro: number; receita: number; ticket: number; variacao: number | null };

/** Mês a mês (os últimos N meses até o mês de "agora"), respeitando loja e forma */
export function mesAMes(vendas: VendaDash[], agora: Date, f: Filtro, n = 12): LinhaMes[] {
  const linhas: LinhaMes[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const de = new Date(agora.getFullYear(), agora.getMonth() - k, 1);
    linhas.push({ chave: `${de.getFullYear()}-${String(de.getMonth() + 1).padStart(2, '0')}`, rotulo: `${MESES[de.getMonth()]}/${de.getFullYear()}`,
      vendas: 0, faturamento: 0, pix: 0, cartao: 0, outro: 0, receita: 0, ticket: 0, variacao: null });
  }
  const idx = new Map(linhas.map((l, i) => [l.chave, i]));
  for (const v of vendas) {
    if (!pago(v.s) || !passaFiltro(v, f)) continue;
    const d = dataVenda(v);
    const i = idx.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    if (i === undefined) continue;
    const l = linhas[i];
    l.vendas++; l.faturamento += v.v; l.receita += v.t;
    if (v.f === 'pix') l.pix += v.v; else if (v.f === 'cartao') l.cartao += v.v; else l.outro += v.v;
  }
  linhas.forEach((l, i) => { l.ticket = l.vendas ? l.faturamento / l.vendas : 0; l.variacao = i ? variacao(l.faturamento, linhas[i - 1].faturamento) : null; });
  return linhas.reverse(); // mais recente primeiro
}

export type Ranking = { id: string; vendas: number; faturamento: number; receita: number; ticket: number; parte: number };
export function ranking(vendas: VendaDash[], p: Periodo, f: Filtro, campo: 'l' | 'd', limite = 10): Ranking[] {
  const m = new Map<string, Ranking>();
  let total = 0;
  for (const v of vendas) {
    if (!pago(v.s) || !passaFiltro(v, f) || !dentro(dataVenda(v), p)) continue;
    const k = v[campo];
    const r = m.get(k) ?? { id: k, vendas: 0, faturamento: 0, receita: 0, ticket: 0, parte: 0 };
    r.vendas++; r.faturamento += v.v; r.receita += v.t; total += v.v;
    m.set(k, r);
  }
  const lista = Array.from(m.values());
  lista.forEach((r) => { r.ticket = r.faturamento / r.vendas; r.parte = total ? r.faturamento / total : 0; });
  return lista.sort((a, b) => b.faturamento - a.faturamento || b.vendas - a.vendas).slice(0, limite);
}

/** Vendas por dia da semana e por hora (quando o cliente paga) */
export function quandoVende(vendas: VendaDash[], p: Periodo, f: Filtro) {
  const semana = DIAS_SEMANA.map((n) => ({ rotulo: n, vendas: 0, faturamento: 0 }));
  const horas = Array.from({ length: 24 }, (_, h) => ({ rotulo: `${h}h`, vendas: 0, faturamento: 0 }));
  for (const v of vendas) {
    if (!pago(v.s) || !passaFiltro(v, f)) continue;
    const d = dataVenda(v);
    if (!dentro(d, p)) continue;
    semana[d.getDay()].vendas++; semana[d.getDay()].faturamento += v.v;
    horas[d.getHours()].vendas++; horas[d.getHours()].faturamento += v.v;
  }
  return { semana: [...semana.slice(1), semana[0]], horas }; // semana começando na segunda
}

/** Soma de extras (destaques pagos, saques pagos) dentro do período */
export function somaExtras(itens: ExtraDash[], p: Periodo, status: string) {
  let valor = 0, qtd = 0;
  for (const e of itens) { if (e.status === status && dentro(new Date(e.em), p)) { valor += e.valor; qtd++; } }
  return { valor: Math.round(valor * 100) / 100, qtd };
}
export const contarNoPeriodo = (datas: string[], p: Periodo) => datas.reduce((n, d) => n + (dentro(new Date(d), p) ? 1 : 0), 0);

/** Meses com movimento, para o seletor "Escolher mês" (mais recente primeiro) */
export function mesesDisponiveis(vendas: VendaDash[], agora: Date): { chave: string; rotulo: string }[] {
  let menor = agora;
  for (const v of vendas) { const d = new Date(v.c); if (d < menor) menor = d; }
  const out: { chave: string; rotulo: string }[] = [];
  let d = inicioDoMes(agora);
  const fim = inicioDoMes(menor);
  let guarda = 0;
  while (d >= fim && guarda++ < 120) {
    out.push({ chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, rotulo: `${['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][d.getMonth()]} de ${d.getFullYear()}` });
    d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  }
  return out;
}

/** CSV (separador ";", aceito pelo Excel em português) das vendas pagas do período */
export function csvVendas(vendas: VendaDash[], p: Periodo, f: Filtro, nomes: { lojas: Record<string, string>; produtos: Record<string, string> }): string {
  const esc = (s: unknown) => { const t = String(s ?? ''); return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const num = (n: number) => n.toFixed(2).replace('.', ',');
  const linhas = [['Data do pagamento', 'Pedido', 'Loja', 'Produto', 'Pagamento', 'Valor', 'Comissão', 'Vendedor recebe'].join(';')];
  const lista = vendas.filter((v) => pago(v.s) && passaFiltro(v, f) && dentro(dataVenda(v), p)).sort((a, b) => dataVenda(a).getTime() - dataVenda(b).getTime());
  for (const v of lista) {
    const d = dataVenda(v);
    linhas.push([
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      v.i.slice(0, 8), esc(nomes.lojas[v.l] ?? '—'), esc(nomes.produtos[v.d] ?? '—'),
      v.f === 'pix' ? 'Pix' : v.f === 'cartao' ? 'Cartão' : 'Não identificado', num(v.v), num(v.t), num(v.r),
    ].join(';'));
  }
  return '﻿' + linhas.join('\r\n');
}
