const assert = require('assert');
const R = require('./.build/recuperacaoVenda.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
t('mensagem com primeiro nome, loja, produto e link', () => {
  const m = R.mensagemRecuperacao({ nome: 'Ana Paula Souza', produto: 'Conta FF', loja: 'Loja X', link: 'https://x/checkout/1' });
  assert.ok(m.startsWith('Oi, Ana! Aqui é da Loja X, do Comprei Barato.')); assert.ok(m.includes('"Conta FF"')); assert.ok(m.includes('https://x/checkout/1'));
});
t('mensagem sem nome e sem loja', () => assert.ok(R.mensagemRecuperacao({ produto: 'P', link: 'L' }).startsWith('Oi! Aqui é do Comprei Barato.')));
t('wa.me só com número brasileiro válido', () => {
  assert.ok(R.linkWhatsapp('5563999998888', 'oi tudo bem?').startsWith('https://wa.me/5563999998888?text=oi%20tudo%20bem%3F'));
  assert.strictEqual(R.linkWhatsapp('63999998888', 'x'), null); assert.strictEqual(R.linkWhatsapp(null, 'x'), null); assert.strictEqual(R.linkWhatsapp('55abc', 'x'), null);
});
t('há quanto tempo', () => { const a = Date.parse('2026-10-29T12:00:00Z'); assert.strictEqual(R.haQuanto('2026-10-29T11:35:00Z', a), 'há 25 min'); assert.strictEqual(R.haQuanto('2026-10-29T09:00:00Z', a), 'há 3 h'); assert.strictEqual(R.haQuanto('2026-10-26T12:00:00Z', a), 'há 3 dias'); });
t('telefone legível', () => { assert.strictEqual(R.foneLegivel('5563999998888'), '(63) 99999-8888'); assert.strictEqual(R.foneLegivel('556332221111'), '(63) 3222-1111'); });
console.log(`recuperação de pedido: ${ok} testes ok`);
