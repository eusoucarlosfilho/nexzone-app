// Dashboard do admin (períodos, Pix x cartão, rankings, mês a mês) e regras da central de notificações.
const assert = require('assert');
const D = require('./.build/dashboardVendas.js');
const N = require('./.build/notificacoesCentral.js');
let ok = 0;
const t = (nome, fn) => { fn(); ok++; };

const agora = new Date(2026, 9, 27, 15, 0); // 27/10/2026 15h (horário local)
const dt = (a, m, d, h = 12) => new Date(a, m - 1, d, h).toISOString();
const V = (o) => ({ i: o.i || Math.random().toString(16).slice(2), s: 'entregue', v: 100, t: 3, r: 97, c: o.c, p: o.p ?? o.c, l: 'L1', d: 'P1', u: 'U1', f: 'pix', ...o });

t('30 dias = hoje e os 29 anteriores', () => {
  const p = D.periodoDoPreset('30d', agora);
  assert.strictEqual(p.de.getTime(), new Date(2026, 8, 28).getTime());
  assert.strictEqual(p.ate.getTime(), new Date(2026, 9, 28).getTime());
  assert.strictEqual(D.diasDoPeriodo(p), 30);
});
t('mês passado e comparação com o mês anterior inteiro', () => {
  const p = D.periodoDoPreset('mes_passado', agora);
  assert.strictEqual(p.de.getTime(), new Date(2026, 8, 1).getTime());
  assert.strictEqual(p.ate.getTime(), new Date(2026, 9, 1).getTime());
  const a = D.periodoAnterior(p);
  assert.strictEqual(a.de.getTime(), new Date(2026, 7, 1).getTime());
  assert.strictEqual(a.ate.getTime(), new Date(2026, 8, 1).getTime());
});
t('anterior de 30 dias = 30 dias antes', () => {
  const a = D.periodoAnterior(D.periodoDoPreset('30d', agora));
  assert.strictEqual(D.diasDoPeriodo(a), 30);
  assert.strictEqual(a.ate.getTime(), new Date(2026, 8, 28).getTime());
});
t('mês escolhido e datas livres', () => {
  const m = D.periodoDoMes('2026-02');
  assert.strictEqual(m.ate.getTime(), new Date(2026, 2, 1).getTime());
  assert.strictEqual(D.periodoDoMes('2026-13'), null);
  const l = D.periodoPersonalizado('2026-10-01', '2026-10-10');
  assert.strictEqual(D.diasDoPeriodo(l), 10);
  assert.strictEqual(D.periodoPersonalizado('2026-10-10', '2026-10-01'), null);
});

const vendas = [
  V({ i: 'a', c: dt(2026, 10, 20), f: 'pix', v: 100, t: 3, r: 97 }),
  V({ i: 'b', c: dt(2026, 10, 21), f: 'cartao', v: 250, t: 7.5, r: 242.5, l: 'L2', d: 'P2', u: 'U2' }),
  V({ i: 'c', c: dt(2026, 10, 22), f: null, v: 50, t: 1.5, r: 48.5 }),
  V({ i: 'd', c: dt(2026, 10, 23), s: 'pendente', p: null, v: 80 }),
  V({ i: 'e', c: dt(2026, 9, 10), f: 'pix', v: 40, t: 1.2, r: 38.8 }),          // período anterior
  V({ i: 'f', c: dt(2026, 10, 24), s: 'reembolsado', v: 30 }),
  V({ i: 'g', c: dt(2026, 9, 26), p: dt(2026, 10, 2), f: 'pix', v: 10, t: 0.3, r: 9.7, u: 'U3' }), // pedido criado antes, pago dentro
];
const P30 = D.periodoDoPreset('30d', agora);
const todos = { loja: 'todas', forma: 'todas' };

t('resumo: receita líquida = receita − tarifas do gateway', () => {
  const vs = [V({ i: 'x1', c: dt(2026, 10, 20), f: 'pix', v: 100, t: 5.5, r: 95, g: 0.5 }), V({ i: 'x2', c: dt(2026, 10, 21), f: 'pix', v: 6, t: 0.3, r: 5.7, g: 0.5 })];
  const r = D.resumir(vs, P30, todos);
  assert.strictEqual(r.receita, 5.8); assert.strictEqual(r.custoGateway, 1); assert.strictEqual(r.liquido, 4.8);
});
t('resumo: faturamento, receita, Pix x cartão, não identificado', () => {
  const r = D.resumir(vendas, P30, todos);
  assert.strictEqual(r.vendas, 4);
  assert.strictEqual(r.faturamento, 410);
  assert.strictEqual(r.receita, 12.3);
  assert.deepStrictEqual(r.pix, { valor: 110, qtd: 2 });
  assert.deepStrictEqual(r.cartao, { valor: 250, qtd: 1 });
  assert.deepStrictEqual(r.semForma, { valor: 50, qtd: 1 });
  assert.strictEqual(r.ticket, 102.5);
  assert.deepStrictEqual(r.pendentes, { valor: 80, qtd: 1 });
  assert.deepStrictEqual(r.reembolsos, { valor: 30, qtd: 1 });
});
t('conversão usa só pedidos criados no período', () => {
  const r = D.resumir(vendas, P30, todos);
  // criados no período: a,b,c,d,f (g foi criado antes) → 5; pagos entre eles: a,b,c → 3
  assert.strictEqual(r.pedidosCriados, 5);
  assert.strictEqual(Math.round(r.conversao * 100), 60);
});
t('compradores novos = primeira compra dentro do período', () => {
  const r = D.resumir(vendas, P30, todos);
  assert.strictEqual(r.compradores, 3);          // U1, U2, U3
  assert.strictEqual(r.compradoresNovos, 2);     // U1 já tinha comprado em setembro
});
t('filtro por loja e por forma', () => {
  assert.strictEqual(D.resumir(vendas, P30, { loja: 'L2', forma: 'todas' }).faturamento, 250);
  assert.strictEqual(D.resumir(vendas, P30, { loja: 'todas', forma: 'pix' }).faturamento, 110);
  assert.strictEqual(D.resumir(vendas, P30, { loja: 'todas', forma: 'cartao' }).vendas, 1);
});
t('variação', () => {
  assert.strictEqual(D.variacao(150, 100), 50);
  assert.strictEqual(D.variacao(0, 0), 0);
  assert.strictEqual(D.variacao(10, 0), null);
});
t('série diária soma certo e cobre o período', () => {
  const s = D.serie(vendas, P30, 'dia', todos);
  assert.strictEqual(s.length, 30);
  assert.strictEqual(s.reduce((n, b) => n + b.total, 0), 410);
  const d21 = s.find((b) => b.rotulo === '21/10');
  assert.strictEqual(d21.cartao, 250);
});
t('série mensal e semanal', () => {
  const p = D.periodoDoPreset('12m', agora);
  const m = D.serie(vendas, p, 'mes', todos);
  assert.strictEqual(m.length, 12);
  assert.strictEqual(m[m.length - 1].total, 410);
  assert.strictEqual(m[m.length - 2].total, 40);
  const w = D.serie(vendas, P30, 'semana', todos);
  assert.strictEqual(w.reduce((n, b) => n + b.total, 0), 410);
  assert.strictEqual(new Date(w[0].chave).getDay(), 1); // semana começa na segunda
});
t('agrupamento automático', () => {
  assert.strictEqual(D.agrupamentoAutomatico(P30), 'dia');
  assert.strictEqual(D.agrupamentoAutomatico(D.periodoDoPreset('90d', agora)), 'semana');
  assert.strictEqual(D.agrupamentoAutomatico(D.periodoDoPreset('12m', agora)), 'mes');
});
t('mês a mês: mais recente primeiro, com variação', () => {
  const m = D.mesAMes(vendas, agora, todos, 3);
  assert.strictEqual(m[0].chave, '2026-10');
  assert.strictEqual(m[0].faturamento, 410);
  assert.strictEqual(m[0].pix, 110); assert.strictEqual(m[0].cartao, 250); assert.strictEqual(m[0].outro, 50);
  assert.strictEqual(m[1].faturamento, 40);
  assert.strictEqual(Math.round(m[0].variacao), 925);
});
t('ranking de lojas e produtos', () => {
  const r = D.ranking(vendas, P30, todos, 'l');
  assert.strictEqual(r[0].id, 'L2'); assert.strictEqual(r[0].faturamento, 250);
  assert.strictEqual(r[1].vendas, 3);
  assert.ok(Math.abs(r.reduce((n, x) => n + x.parte, 0) - 1) < 1e-9);
});
t('quando vende', () => {
  const q = D.quandoVende(vendas, P30, todos);
  assert.strictEqual(q.semana.length, 7); assert.strictEqual(q.semana[0].rotulo, 'Seg');
  assert.strictEqual(q.horas[12].vendas, 4);
});
t('extras e contagens', () => {
  const ex = [{ valor: 20, status: 'pago', em: dt(2026, 10, 5) }, { valor: 20, status: 'pendente', em: dt(2026, 10, 5) }, { valor: 9, status: 'pago', em: dt(2026, 8, 5) }];
  assert.deepStrictEqual(D.somaExtras(ex, P30, 'pago'), { valor: 20, qtd: 1 });
  assert.strictEqual(D.contarNoPeriodo([dt(2026, 10, 1), dt(2025, 1, 1)], P30), 1);
});
t('meses disponíveis desde o primeiro pedido', () => {
  const m = D.mesesDisponiveis(vendas, agora);
  assert.strictEqual(m[0].chave, '2026-10'); assert.strictEqual(m[m.length - 1].chave, '2026-09');
  assert.strictEqual(m[0].rotulo, 'Outubro de 2026');
});
t('CSV com ; e vírgula decimal, sem pedidos não pagos', () => {
  const c = D.csvVendas(vendas, P30, todos, { lojas: { L1: 'Loja "Um"; teste', L2: 'Dois' }, produtos: { P1: 'Ebook', P2: 'Curso' } });
  const l = c.replace('﻿', '').split('\r\n');
  assert.strictEqual(l.length, 5);
  assert.ok(l[0].startsWith('Data do pagamento;Pedido;Loja'));
  assert.ok(c.includes('"Loja ""Um""; teste"'));
  assert.ok(c.includes(';Cartão;250,00;7,50;242,50'));
  assert.ok(c.includes('Não identificado'));
});

// ---------- notificações ----------
t('link interno seguro', () => {
  assert.strictEqual(N.linkInterno('/produtos?cat=ebooks'), '/produtos?cat=ebooks');
  assert.strictEqual(N.linkInterno('//evil.com'), null);
  assert.strictEqual(N.linkInterno('https://evil.com'), null);
  assert.strictEqual(N.linkInterno('javascript:alert(1)'), null);
  assert.strictEqual(N.linkInterno('/a b'), null);
  assert.strictEqual(N.linkInterno(''), null);
});
t('tempo relativo', () => {
  const base = new Date(2026, 9, 27, 15, 0).getTime();
  assert.strictEqual(N.quandoFoi(new Date(base - 30000).toISOString(), base), 'agora');
  assert.strictEqual(N.quandoFoi(new Date(base - 5 * 60000).toISOString(), base), 'há 5 min');
  assert.strictEqual(N.quandoFoi(new Date(base - 3 * 3600000).toISOString(), base), 'há 3 h');
  assert.strictEqual(N.quandoFoi(new Date(base - 30 * 3600000).toISOString(), base), 'ontem');
});
t('todo tipo tem ícone e filtros cobrem os tipos', () => {
  const tipos = ['venda', 'compra', 'pagamento', 'reembolso', 'mensagem', 'pergunta', 'resposta', 'saque', 'anuncio', 'aviso', 'advertencia', 'novidade'];
  tipos.forEach((x) => assert.ok(N.ICONE_TIPO[x], x));
  const cobertos = new Set(N.FILTROS.flatMap((f) => f.tipos || []));
  tipos.forEach((x) => assert.ok(cobertos.has(x), 'filtro sem ' + x));
});
t('tabela ausente é reconhecida', () => {
  assert.ok(N.semTabela({ code: '42P01', message: 'relation "public.notificacoes" does not exist' }));
  assert.ok(N.semTabela({ code: 'PGRST205', message: "Could not find the table 'public.notificacoes' in the schema cache" }));
  assert.ok(!N.semTabela({ code: '23505', message: 'duplicate key' }));
});
console.log(`dashboard + notificações: ${ok} testes ok`);
