const assert = require('assert');
const P = require('./.build/push.js');
let ok = 0;
const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
t('carga: venda ganha emoji, link interno e tag do grupo', () => {
  const c = P.cargaDoPush({ id: 7, tipo: 'venda', titulo: 'Nova venda: Conta FF', texto: 'R$ 49,90 via Pix', link: '/vender/vendas', grupo: 'venda-1' });
  assert.deepStrictEqual(c, { titulo: '💰 Nova venda: Conta FF', texto: 'R$ 49,90 via Pix', url: '/vender/vendas', tag: 'venda-1' });
});
t('carga: link externo vira /notificacoes', () => {
  assert.strictEqual(P.cargaDoPush({ titulo: 'x', link: 'https://golpe.com' }).url, '/notificacoes');
  assert.strictEqual(P.cargaDoPush({ titulo: 'x', link: '//golpe.com' }).url, '/notificacoes');
  assert.strictEqual(P.cargaDoPush({ titulo: 'x', link: '/produtos?q=ff' }).url, '/produtos?q=ff');
});
t('carga: corta título e texto e usa padrão', () => {
  const c = P.cargaDoPush({ id: 3, tipo: 'xyz', titulo: 'a'.repeat(200), texto: null });
  assert.ok(c.titulo.length <= 80); assert.ok(c.titulo.startsWith('🔔')); assert.strictEqual(c.texto, 'Toque para ver no Comprei Barato.'); assert.strictEqual(c.tag, 'n-3');
});
const ok1 = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'B'.repeat(87), auth: 'a1b2c3d4e5f6g7h8i9j0kk' } };
t('inscrição válida', () => assert.ok(P.validarInscricao(ok1).ok));
t('inscrição: recusa http, endpoint lixo e chaves estranhas', () => {
  assert.strictEqual(P.validarInscricao({ ...ok1, endpoint: 'http://fcm.googleapis.com/x' }).ok, false);
  assert.strictEqual(P.validarInscricao({ ...ok1, endpoint: 'javascript:alert(1)' }).ok, false);
  assert.strictEqual(P.validarInscricao({ ...ok1, keys: { p256dh: '<script>', auth: 'x' } }).ok, false);
  assert.strictEqual(P.validarInscricao(null).ok, false);
});
console.log(`push no celular: ${ok} testes ok`);
