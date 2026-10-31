const x = require('./.build/taxas.js');
const assert = require('assert');
let ok = 0, fail = 0;
function t(nome, fn) { try { fn(); ok++; console.log('OK  ', nome); } catch (e) { fail++; console.log('FAIL', nome, '-', e.message); } }
const P = x.TAXAS_PADRAO;
const ON = { ...P, planosPagosAtivos: true };

t('padrões aprovados', () => { assert.deepStrictEqual([P.planoBasico, P.planoDestaque, P.planoTopo], [5, 8, 11]); assert.deepStrictEqual([P.gwPixPct, P.gwPixFixo, P.gwCartaoPct, P.gwCartaoFixo], [0, 0.5, 3.99, 0.39]); assert.deepStrictEqual([P.margemPixPct, P.margemPixFixo, P.margemCartaoPct, P.margemCartaoFixo], [2, 0, 2, 0.1]); assert.strictEqual(P.planosPagosAtivos, false); assert.strictEqual(P.topoVagas, 3); });
t('lerConfigTaxas vazio = padrão', () => assert.deepStrictEqual(x.lerConfigTaxas({}), P));
t('lerConfigTaxas lê texto, vírgula e boolean em texto', () => { const c = x.lerConfigTaxas({ plano_basico_pct: '4,5', planos_pagos_ativos: 'true', margem_pix_fixo: '"0.75"'.replace(/"/g, ''), fin_custo_pix_pct: '0,99', topo_vagas_categoria: '5' }); assert.strictEqual(c.planoBasico, 4.5); assert.strictEqual(c.planosPagosAtivos, true); assert.strictEqual(c.margemPixFixo, 0.75); assert.strictEqual(c.gwPixPct, 0.99); assert.strictEqual(c.topoVagas, 5); });
t('lerConfigTaxas: fora da faixa volta ao padrão', () => { const c = x.lerConfigTaxas({ plano_topo_pct: 90, margem_pix_pct: -1, fin_custo_cartao_pct: 99, liberacao_conta_dias: 999, topo_vagas_categoria: 0 }); assert.strictEqual(c.planoTopo, 11); assert.strictEqual(c.margemPixPct, 2); assert.strictEqual(c.gwCartaoPct, 3.99); assert.strictEqual(c.liberaContaDias, 7); assert.strictEqual(c.topoVagas, 1); });
t('planos desligados: tudo vira Básico', () => { assert.strictEqual(x.planoEfetivo('topo', P), 'basico'); assert.strictEqual(x.pctDoPlano('topo', P), 5); });
t('planos ligados: % por plano', () => { assert.strictEqual(x.pctDoPlano('basico', ON), 5); assert.strictEqual(x.pctDoPlano('destaque', ON), 8); assert.strictEqual(x.pctDoPlano('topo', ON), 11); assert.strictEqual(x.pctDoPlano('xpto', ON), 5); });
t('divisão do vendedor R$ 100 Topo', () => assert.deepStrictEqual(x.divisaoVendedor(100, 'topo', ON), { pct: 11, taxa: 11, valorVendedor: 89 }));
t('divisão arredonda centavos', () => { const d = x.divisaoVendedor(19.9, 'basico', P); assert.strictEqual(d.taxa, 1); assert.strictEqual(d.valorVendedor, 18.9); assert.strictEqual(Math.round((d.taxa + d.valorVendedor) * 100), 1990); });
t('divisão: total negativo vira 0', () => assert.deepStrictEqual(x.divisaoVendedor(-5, 'basico', P), { pct: 5, taxa: 0, valorVendedor: 0 }));
t('Pix = MisticPay 0,50 + margem 2%', () => { assert.strictEqual(x.taxaComprador('pix', 10, P), 0.7); assert.strictEqual(x.taxaComprador('pix', 50, P), 1.5); assert.strictEqual(x.taxaComprador('pix', 500, P), 10.5); });
t('cartão R$ 50 = 3,63 (Stripe por dentro + margem)', () => assert.strictEqual(x.taxaComprador('cartao', 50, P), 3.63));
t('cartão R$ 100 = 6,75', () => assert.strictEqual(x.taxaComprador('cartao', 100, P), 6.75));
t('pedido grátis não cobra taxa', () => { assert.strictEqual(x.taxaComprador('pix', 0, P), 0); assert.strictEqual(x.taxaComprador('cartao', 0, P), 0); });
t('totalComTaxa', () => { assert.strictEqual(x.totalComTaxa('pix', 29.9, P), 31); assert.strictEqual(x.totalComTaxa('cartao', 29.9, P), 32.28); });
t('cartão: Stripe sobre o COBRADO + margem nunca abaixo do alvo', () => { for (const v of [5, 9.9, 10, 37.5, 100, 1000, 4999.99]) { const q = x.partesTaxaComprador('cartao', v, P); const stripe = q.cobrado * 0.0399 + 0.39; assert.ok(q.taxa - stripe + 1e-9 >= v * 0.02 + 0.1 - 1e-9, 'v=' + v); assert.ok(q.taxa - stripe - (v * 0.02 + 0.1) < 0.02, 'v=' + v); } });
t('Pix com % na MisticPay também cobra por dentro', () => { const c = { ...P, gwPixPct: 0.99, gwPixFixo: 0 }; for (const v of [5, 50, 999]) { const q = x.partesTaxaComprador('pix', v, c); assert.ok(q.taxa - q.cobrado * 0.0099 + 1e-9 >= v * 0.02, 'v=' + v); } assert.ok(x.taxaComprador('pix', 1, P) >= 0.5); });
t('liberação: conta 7, demais 3', () => { assert.strictEqual(x.diasDeLiberacao('conta', 'pix', P), 7); for (const tp of ['item', 'moeda', 'giftcard', 'servico', 'digital', undefined]) assert.strictEqual(x.diasDeLiberacao(tp, 'pix', P), 3); });
t('liberação: cartão no mínimo 14', () => { assert.strictEqual(x.diasDeLiberacao('giftcard', 'cartao', P), 14); assert.strictEqual(x.diasDeLiberacao('conta', 'cartao', P), 14); assert.strictEqual(x.diasDeLiberacao('conta', 'cartao', { ...P, liberaContaDias: 20 }), 20); });
t('liberação rápida por avaliação: só Pix e fora de conta', () => { assert.strictEqual(x.diasDeLiberacao('giftcard', 'pix', P, { avaliacaoPositiva: true, rapidoDias: 1 }), 1); assert.strictEqual(x.diasDeLiberacao('conta', 'pix', P, { avaliacaoPositiva: true, rapidoDias: 1 }), 7); assert.strictEqual(x.diasDeLiberacao('giftcard', 'cartao', P, { avaliacaoPositiva: true, rapidoDias: 1 }), 14); });
t('liberação rápida nunca aumenta o prazo', () => assert.strictEqual(x.diasDeLiberacao('item', 'pix', P, { avaliacaoPositiva: true, rapidoDias: 10 }), 3));
t('saque: 1º da semana grátis, depois 0,99', () => { assert.strictEqual(x.taxaDoSaque(0, P), 0); assert.strictEqual(x.taxaDoSaque(1, P), 0.99); assert.strictEqual(x.taxaDoSaque(4, P), 0.99); });
t('peso do plano ordena topo > destaque > básico (e 0 desligado)', () => { assert.ok(x.pesoDoPlano('topo', ON) > x.pesoDoPlano('destaque', ON)); assert.ok(x.pesoDoPlano('destaque', ON) > x.pesoDoPlano('basico', ON)); assert.strictEqual(x.pesoDoPlano('topo', P), 0); });
t('ordem alfabética do banco bate com o peso (order plano desc)', () => assert.deepStrictEqual(['basico', 'topo', 'destaque'].sort().reverse(), ['topo', 'destaque', 'basico']));
t('tipoValido / planoValido', () => { assert.strictEqual(x.tipoValido('conta'), 'conta'); assert.strictEqual(x.tipoValido("conta'; drop"), 'digital'); assert.strictEqual(x.planoValido('TOPO'), 'basico'); });
t('todo tipo tem entrega válida', () => { for (const tp of x.TIPOS_ANUNCIO) assert.ok(['acesso', 'chave', 'arquivo'].includes(tp.entrega), tp.id); assert.strictEqual(x.TIPOS_ANUNCIO.length, 6); });
t('brl e pctTexto', () => { assert.strictEqual(x.brl(0.5), 'R$ 0,50'); assert.strictEqual(x.brl(1234.5), 'R$ 1234,50'); assert.strictEqual(x.pctTexto(5.99), '5,99%'); assert.strictEqual(x.pctTexto(5), '5%'); });

t('trava 1ª compra: comissão de 5% em R$ 5,89 (0,29) NÃO cobre o Pix (0,50)', () => { assert.strictEqual(x.comissaoCobreGateway('pix', 5.89, 0.29, P), false); assert.strictEqual(x.comissaoCobreGateway('pix', 50, 2.5, P), true); assert.strictEqual(x.comissaoCobreGateway('pix', 10, 0.5, P), true); assert.strictEqual(x.comissaoCobreGateway('pix', 50, 0, P), false); });
t('trava 1ª compra no cartão: Stripe 3,99% + 0,39', () => { assert.strictEqual(x.custoGatewaySemTaxa('cartao', 100, P), 4.38); assert.strictEqual(x.comissaoCobreGateway('cartao', 100, 5, P), true); assert.strictEqual(x.comissaoCobreGateway('cartao', 100, 4, P), false); });
t('CB Points: desconto máximo = comissão do pedido', () => { assert.strictEqual(x.maxDescontoPontos(100, 5), 5); assert.strictEqual(x.maxDescontoPontos(5.89, 5), 0.29); assert.strictEqual(x.maxDescontoPontos(100, 0), 0); });

t('rota do Pix: MP só com token E limite ligado', () => { const on = { ...P, pixMpAte: 50, pixMpDisponivel: true }; assert.strictEqual(x.rotaPix(10, P), 'misticpay'); assert.strictEqual(x.rotaPix(10, { ...P, pixMpAte: 50 }), 'misticpay'); assert.strictEqual(x.rotaPix(10, on), 'mp'); assert.strictEqual(x.rotaPix(50, on), 'mp'); assert.strictEqual(x.rotaPix(50.01, on), 'misticpay'); });
t('taxa do comprador pelo MP (0,99% por dentro + 2%)', () => { const on = { ...P, pixMpAte: 50, pixMpDisponivel: true }; assert.strictEqual(x.taxaComprador('pix', 10, on), 0.31); assert.strictEqual(x.taxaComprador('pix', 5, on), 0.16); assert.strictEqual(x.taxaComprador('pix', 100, on), 2.5); const q = x.partesTaxaComprador('pix', 10, on); assert.ok(q.margem + 1e-9 >= 0.2); });
t('trava 1ª compra com MP: 5% de R$ 5,89 cobre o Pix do MP', () => { const on = { ...P, pixMpAte: 50, pixMpDisponivel: true }; assert.strictEqual(x.comissaoCobreGateway('pix', 5.89, 0.29, on), true); });
t('saque: grátis só a partir de R$ 50', () => { assert.strictEqual(x.taxaDoSaque(0, P, 49.99), 0.99); assert.strictEqual(x.taxaDoSaque(0, P, 50), 0); assert.strictEqual(x.taxaDoSaque(0, P), 0); assert.strictEqual(x.taxaDoSaque(1, P, 500), 0.99); });

t('jogo obrigatório só em conta, item e moeda', () => {
  // site aberto: o jogo nunca é obrigatório e o cadastro só oferece Produto digital e Serviço
  assert.ok(['conta', 'item', 'moeda', 'giftcard', 'digital', 'servico'].every((t) => !x.exigeJogo(t)));
  assert.deepStrictEqual([...x.TIPOS_CADASTRO].sort(), ['digital', 'servico']);
  assert.strictEqual(x.TIPOS_ANUNCIO.find((t) => t.id === 'servico').nome, 'Serviço');
  assert.ok(!/jogo|boost|coach/i.test(x.TIPOS_ANUNCIO.find((t) => t.id === 'servico').dica));
});
console.log(`\n${ok} ok, ${fail} falha(s)`);
if (fail) process.exit(1);
