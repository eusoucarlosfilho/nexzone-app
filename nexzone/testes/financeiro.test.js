const assert = require('assert');
const F = require('./.build/financeiro.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const cfg = F.CONFIG_FIN_PADRAO;
const ped = (o) => ({ status: 'entregue', total: 100, taxa: 5, valor_vendedor: 95, forma_pagamento: 'pix', taxa_comprador_pix: 0.5, taxa_comprador_cartao: 0, created_at: '2026-10-10T12:00:00Z', entregue_em: '2026-10-10T12:00:00Z', ...o });
const custo = (o) => ({ id: 1, descricao: 'x', categoria: 'infraestrutura', valor: 100, tipo: 'avulso', data: '2026-10-05', fim: null, pago_por: null, observacao: null, ...o });

t('receita é só a parte da plataforma (não o total vendido)', () => {
  const f = F.financeiroDoPedido(ped({}), cfg);
  assert.strictEqual(f.comissao, 5); assert.strictEqual(f.taxaComprador, 0.5); assert.strictEqual(f.gmv, 100); assert.strictEqual(f.repasse, 95); assert.strictEqual(f.gateway, 0.5);
});
t('cartão: tarifa sobre o valor cobrado (total + taxa do comprador)', () => {
  const f = F.financeiroDoPedido(ped({ forma_pagamento: 'cartao', taxa_comprador_cartao: 6.48 }), cfg);
  assert.strictEqual(f.taxaComprador, 6.48); assert.strictEqual(f.gateway, Math.round(((106.48 * 0.0399) + 0.39) * 100) / 100);
});
t('reembolsado: receita zera, a tarifa fica', () => {
  const f = F.financeiroDoPedido(ped({ status: 'reembolsado' }), cfg);
  assert.strictEqual(f.comissao + f.taxaComprador + f.gmv, 0); assert.strictEqual(f.gateway, 0.5);
});
t('recorrência: avulso, mensal com fim e anual', () => {
  assert.strictEqual(F.valorNoMes(custo({}), '2026-10'), 100);
  assert.strictEqual(F.valorNoMes(custo({}), '2026-11'), 0);
  const m = custo({ tipo: 'mensal', data: '2026-08-15', fim: '2026-10-20' });
  assert.deepStrictEqual(['2026-07', '2026-08', '2026-10', '2026-11'].map((x) => F.valorNoMes(m, x)), [0, 100, 100, 0]);
  const a = custo({ tipo: 'anual', data: '2025-10-01', valor: 120 });
  assert.deepStrictEqual(['2025-10', '2026-09', '2026-10'].map((x) => F.valorNoMes(a, x)), [120, 0, 120]);
});
t('mês completo: receita, custos, imposto estimado, resultado, terceiros', () => {
  const r = F.montarFinanceiro({
    pedidos: [ped({}), ped({ status: 'pendente' }), ped({ created_at: '2026-09-01T00:00:00Z', entregue_em: '2026-09-01T00:00:00Z' })],
    saques: [{ status: 'pago', valor: 50, taxa_saque: 0.99, created_at: '2026-10-01', pago_em: '2026-10-02T00:00:00Z' }, { status: 'pendente', valor: 10, taxa_saque: 0, created_at: '2026-10-03', pago_em: null }],
    destaques: [{ status: 'pago', valor: 9.9, created_at: '2026-10-04', pago_em: '2026-10-04T00:00:00Z' }],
    custos: [custo({ tipo: 'mensal', data: '2026-01-01', valor: 20, categoria: 'infraestrutura' })], cfg: { ...cfg, custoPixSaida: 0.3 }, meses: ['2026-09', '2026-10'],
  });
  const o = r.meses[1];
  assert.strictEqual(o.receita.total, 5 + 0.5 + 0.99 + 9.9);
  assert.strictEqual(o.gatewayAuto, 0.5 + 0.3 + 0.5);
  assert.strictEqual(o.custosLancados, 20);
  assert.strictEqual(o.imposto.estimado, Math.round(16.39 * 0.06 * 100) / 100); assert.ok(!o.imposto.real);
  assert.strictEqual(o.resultado, Math.round((16.39 - (1.3 + 20 + o.imposto.estimado)) * 100) / 100);
  assert.strictEqual(o.gmv, 100); assert.strictEqual(o.pagoVendedores, 50); assert.strictEqual(o.pedidos, 1);
  assert.strictEqual(r.meses[0].pedidos, 1);
});
t('DAS lançado substitui a estimativa', () => {
  const r = F.montarFinanceiro({ pedidos: [ped({})], saques: [], destaques: [], custos: [custo({ categoria: 'impostos', valor: 1.23 })], cfg, meses: ['2026-10'] });
  assert.ok(r.meses[0].imposto.real); assert.strictEqual(r.meses[0].imposto.usado, 1.23); assert.strictEqual(r.meses[0].custosLancados, 0);
});
t('custo fixo mensal e gasto total', () => {
  const cs = [custo({ tipo: 'mensal', data: '2026-08-01', valor: 50 }), custo({ tipo: 'anual', data: '2026-01-10', valor: 120 }), custo({ valor: 30, data: '2026-09-09' }), custo({ tipo: 'mensal', data: '2026-01-01', fim: '2026-02-28', valor: 10 })];
  assert.strictEqual(F.custoFixoMensal(cs, '2026-10'), 60);
  assert.strictEqual(F.totalGasto(cs, '2026-10'), 50 * 3 + 120 + 30 + 20);
});
t('validação de custo', () => {
  assert.ok(F.validarCusto({ descricao: 'Vercel', categoria: 'infraestrutura', valor: '1.234,56', tipo: 'mensal', data: '2026-10-01' }).ok);
  assert.strictEqual(F.validarCusto({ descricao: 'Vercel', categoria: 'infraestrutura', valor: '1.234,56', tipo: 'mensal', data: '2026-10-01' }).custo.valor, 1234.56);
  assert.strictEqual(F.validarCusto({ descricao: 'x', categoria: 'infraestrutura', valor: 29.9, tipo: 'avulso', data: '2026-10-01' }).ok, false);
  assert.strictEqual(F.validarCusto({ descricao: 'Domínio', categoria: 'infraestrutura', valor: 29.9, tipo: 'avulso', data: '2026-10-01' }).custo.valor, 29.9);
  assert.strictEqual(F.validarCusto({ descricao: 'Domínio', categoria: 'xx', valor: 1, tipo: 'avulso', data: '2026-10-01' }).ok, false);
  assert.strictEqual(F.validarCusto({ descricao: 'Domínio', categoria: 'outros', valor: 0, tipo: 'avulso', data: '2026-10-01' }).ok, false);
  assert.strictEqual(F.validarCusto({ descricao: 'Domínio', categoria: 'outros', valor: 5, tipo: 'mensal', data: '2026-10-01', fim: '2026-09-01' }).ok, false);
  assert.strictEqual(F.validarCusto({ descricao: 'Avulso', categoria: 'outros', valor: 5, tipo: 'avulso', data: '2026-10-01', fim: '2026-12-01' }).custo.fim, null);
});
t('ajustes fora da faixa voltam ao padrão', () => {
  const c = F.lerConfigFin({ fin_custo_pix_entrada: '"0.8"', fin_aliquota_das: 90, fin_custo_cartao_pct: true });
  assert.strictEqual(c.custoPixEntrada, 0.8); assert.strictEqual(c.aliquotaDas, 6); assert.strictEqual(c.custoCartaoPct, 3.99);
});
t('planilha da contadora separa receita de dinheiro de terceiros', () => {
  const r = F.montarFinanceiro({ pedidos: [ped({})], saques: [], destaques: [], custos: [], cfg, meses: ['2026-10'] });
  const csv = F.csvMes(r.meses[0], []);
  assert.ok(csv.includes('"Comissões dos vendedores";"";"5,00"')); assert.ok(csv.includes('não é receita')); assert.ok(csv.includes('DAS estimado'));
});
t('meses e rótulo', () => {
  assert.deepStrictEqual(F.ultimosMeses(3, new Date('2026-01-15T12:00:00Z')), ['2025-11', '2025-12', '2026-01']);
  assert.strictEqual(F.rotuloCategoria('infraestrutura'), 'Infraestrutura');
});

t('auditoria: pedido certo (5% + taxa do Pix) passa sem alerta grave', () => {
  const a = F.auditarPedido({ ...ped({}), id: 'a', pct_vendedor: 5 }, cfg);
  assert.deepStrictEqual(a.alertas, []); assert.strictEqual(a.grave, false); assert.strictEqual(a.liquido, 5);
});
t('auditoria: divisão que não fecha é grave', () => {
  const a = F.auditarPedido({ ...ped({ valor_vendedor: 96 }), id: 'a', pct_vendedor: 5 }, cfg);
  assert.ok(a.alertas.includes('divisao')); assert.ok(a.grave);
});
t('auditoria: cobrou do vendedor acima do plano é grave', () => {
  const a = F.auditarPedido({ ...ped({ taxa: 8, valor_vendedor: 92 }), id: 'a', pct_vendedor: 5 }, cfg);
  assert.ok(a.alertas.includes('acima_do_plano')); assert.ok(a.grave);
});
t('auditoria: Fundador 0% + 1ª compra grátis = prejuízo (tarifa do Pix sem receita)', () => {
  const a = F.auditarPedido({ ...ped({ total: 6, taxa: 0, valor_vendedor: 6, taxa_comprador_pix: 0 }), id: 'a', pct_vendedor: 0 }, cfg);
  assert.ok(a.alertas.includes('prejuizo')); assert.ok(a.alertas.includes('sem_taxa_comprador')); assert.strictEqual(a.liquido, -0.5);
});
t('auditoria: pedido antigo sem % gravado é só aviso', () => {
  const a = F.auditarPedido({ ...ped({ total: 10, taxa: 0.3, valor_vendedor: 9.7, forma_pagamento: null, taxa_comprador_pix: null }), id: 'a', pct_vendedor: null }, cfg);
  assert.ok(a.alertas.includes('modelo_antigo')); assert.ok(a.alertas.includes('prejuizo'));
});
t('auditoria em lote: soma e põe os graves primeiro', () => {
  const r = F.auditarPedidos([{ ...ped({}), id: 'ok', pct_vendedor: 5 }, { ...ped({ taxa: 8, valor_vendedor: 92 }), id: 'ruim', pct_vendedor: 5 }, { ...ped({ status: 'pendente' }), id: 'x', pct_vendedor: 5 }], cfg);
  assert.strictEqual(r.pedidos, 2); assert.strictEqual(r.graves, 1); assert.strictEqual(r.linhas[0].id, 'ruim'); assert.strictEqual(r.totais.comissao, 13); assert.strictEqual(r.totais.liquido, 13);
});
t('saque Pix agora custa R$ 0,50 por padrão', () => assert.strictEqual(cfg.custoPixSaida, 0.5));
console.log(`financeiro: ${ok} testes ok`);
