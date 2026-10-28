const x = require('./.build/taxas.js');
const assert = require('assert');
let ok = 0, fail = 0;
function t(nome, fn) { try { fn(); ok++; console.log('OK  ', nome); } catch (e) { fail++; console.log('FAIL', nome, '-', e.message); } }
const P = x.TAXAS_PADRAO;
const ON = { ...P, planosPagosAtivos: true };

t('padrões aprovados', () => { assert.deepStrictEqual([P.planoBasico, P.planoDestaque, P.planoTopo], [5, 8, 11]); assert.strictEqual(P.compradorPix, 0.5); assert.strictEqual(P.compradorCartaoPct, 5.99); assert.strictEqual(P.compradorCartaoFixo, 0.49); assert.strictEqual(P.planosPagosAtivos, false); assert.strictEqual(P.topoVagas, 3); });
t('lerConfigTaxas vazio = padrão', () => assert.deepStrictEqual(x.lerConfigTaxas({}), P));
t('lerConfigTaxas lê texto, vírgula e boolean em texto', () => { const c = x.lerConfigTaxas({ plano_basico_pct: '4,5', planos_pagos_ativos: 'true', taxa_comprador_pix: '"0.75"'.replace(/"/g, ''), topo_vagas_categoria: '5' }); assert.strictEqual(c.planoBasico, 4.5); assert.strictEqual(c.planosPagosAtivos, true); assert.strictEqual(c.compradorPix, 0.75); assert.strictEqual(c.topoVagas, 5); });
t('lerConfigTaxas: fora da faixa volta ao padrão', () => { const c = x.lerConfigTaxas({ plano_topo_pct: 90, taxa_comprador_pix: -1, liberacao_conta_dias: 999, topo_vagas_categoria: 0 }); assert.strictEqual(c.planoTopo, 11); assert.strictEqual(c.compradorPix, 0.5); assert.strictEqual(c.liberaContaDias, 7); assert.strictEqual(c.topoVagas, 1); });
t('planos desligados: tudo vira Básico', () => { assert.strictEqual(x.planoEfetivo('topo', P), 'basico'); assert.strictEqual(x.pctDoPlano('topo', P), 5); });
t('planos ligados: % por plano', () => { assert.strictEqual(x.pctDoPlano('basico', ON), 5); assert.strictEqual(x.pctDoPlano('destaque', ON), 8); assert.strictEqual(x.pctDoPlano('topo', ON), 11); assert.strictEqual(x.pctDoPlano('xpto', ON), 5); });
t('divisão do vendedor R$ 100 Topo', () => assert.deepStrictEqual(x.divisaoVendedor(100, 'topo', ON), { pct: 11, taxa: 11, valorVendedor: 89 }));
t('divisão arredonda centavos', () => { const d = x.divisaoVendedor(19.9, 'basico', P); assert.strictEqual(d.taxa, 1); assert.strictEqual(d.valorVendedor, 18.9); assert.strictEqual(Math.round((d.taxa + d.valorVendedor) * 100), 1990); });
t('divisão: total negativo vira 0', () => assert.deepStrictEqual(x.divisaoVendedor(-5, 'basico', P), { pct: 5, taxa: 0, valorVendedor: 0 }));
t('taxa do comprador Pix fixa', () => { assert.strictEqual(x.taxaComprador('pix', 10, P), 0.5); assert.strictEqual(x.taxaComprador('pix', 500, P), 0.5); });
t('taxa do comprador cartão R$ 50 = 3,49', () => assert.strictEqual(x.taxaComprador('cartao', 50, P), 3.49));
t('taxa do comprador cartão R$ 100 = 6,48', () => assert.strictEqual(x.taxaComprador('cartao', 100, P), 6.48));
t('pedido grátis não cobra taxa', () => { assert.strictEqual(x.taxaComprador('pix', 0, P), 0); assert.strictEqual(x.taxaComprador('cartao', 0, P), 0); });
t('totalComTaxa', () => { assert.strictEqual(x.totalComTaxa('pix', 29.9, P), 30.4); assert.strictEqual(x.totalComTaxa('cartao', 29.9, P), 32.18); });
t('cartão cobre o custo Stripe (3,99% + 0,39)', () => { for (const v of [5, 10, 37.5, 100, 1000]) { const custo = v * 0.0399 + 0.39; assert.ok(x.taxaComprador('cartao', v, P) + 1e-9 >= custo, 'v=' + v); } });
t('Pix cobre o custo MisticPay de entrada (0,50)', () => assert.ok(x.taxaComprador('pix', 1, P) >= 0.5));
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

console.log(`\n${ok} ok, ${fail} falha(s)`);
if (fail) process.exit(1);
