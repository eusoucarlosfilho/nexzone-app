const assert = require('assert');
const C = require('./.build/campanhas.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const P = C.CAMPANHAS_PADRAO;

t('padrões e leitura do banco (texto ou json)', () => {
  assert.deepStrictEqual(C.lerCampanhas({}), P);
  const c = C.lerCampanhas({ promo_primeira_compra: 'false', fundador_vagas: '"20"', fundador_teto: '0', cb_cashback_pct: 99, fundador_dias: true });
  assert.strictEqual(c.primeiraCompra, false); assert.strictEqual(c.fundadorVagas, 20); assert.strictEqual(c.fundadorTeto, 0); assert.strictEqual(c.cashbackPct, 5); assert.strictEqual(c.fundadorDias, 30);
});
t('1ª compra: Pix sem taxa; cartão só se ligado; quem já comprou paga', () => {
  assert.strictEqual(C.taxaComPromo(0.5, 'pix', true, P), 0);
  assert.strictEqual(C.taxaComPromo(6.48, 'cartao', true, P), 6.48);
  assert.strictEqual(C.taxaComPromo(6.48, 'cartao', true, { ...P, primeiraCompraCartao: true }), 0);
  assert.strictEqual(C.taxaComPromo(0.5, 'pix', false, P), 0.5);
  assert.strictEqual(C.taxaComPromo(0.5, 'pix', true, { ...P, primeiraCompra: false }), 0.5);
});
t('fundador: ativo no prazo e abaixo do teto', () => {
  const agora = Date.parse('2026-10-30T12:00:00Z');
  const s = { fundador_em: '2026-10-20T12:00:00Z', fundador_numero: 3 };
  const a = C.situacaoFundador(s, 120, P, agora);
  assert.ok(a.fundador && a.ativo); assert.strictEqual(a.numero, 3); assert.strictEqual(a.restante, 380); assert.strictEqual(a.ate, '2026-11-19T12:00:00.000Z');
  const teto = C.situacaoFundador(s, 500, P, agora); assert.ok(!teto.ativo); assert.strictEqual(teto.motivoFim, 'teto'); assert.ok(teto.fundador);
  const prazo = C.situacaoFundador(s, 0, P, Date.parse('2026-12-01T00:00:00Z')); assert.strictEqual(prazo.motivoFim, 'prazo');
  const semTeto = C.situacaoFundador(s, 99999, { ...P, fundadorTeto: 0 }, agora); assert.ok(semTeto.ativo); assert.strictEqual(semTeto.restante, -1);
  assert.strictEqual(C.situacaoFundador(s, 0, { ...P, fundadorAtivo: false }, agora).motivoFim, 'desligado');
  assert.strictEqual(C.situacaoFundador({ fundador_em: null, fundador_numero: null }, 0, P).fundador, false);
});
t('fundador ativo: comissão zero, tudo para o vendedor', () => {
  const normal = { pct: 5, taxa: 1.5, valorVendedor: 28.5 };
  assert.deepStrictEqual(C.divisaoComFundador(normal, 30, true), { pct: 0, taxa: 0, valorVendedor: 30 });
  assert.deepStrictEqual(C.divisaoComFundador(normal, 30, false), normal);
});
t('cashback: 5% de R$ 30 = 150 pontos = R$ 1,50', () => {
  assert.strictEqual(C.pontosCashback(30, 5, 100), 150);
  assert.strictEqual(C.valorDosPontos(150, 100), 1.5);
  assert.strictEqual(C.pontosCashback(0, 5, 100), 0);
  assert.strictEqual(C.pontosCashback(30, 0, 100), 0);
  assert.strictEqual(C.pontosCashback(19.99, 5, 100), 99);
});
console.log(`campanhas: ${ok} testes ok`);
