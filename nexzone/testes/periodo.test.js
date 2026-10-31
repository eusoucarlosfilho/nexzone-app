const assert = require('assert');
const P = require('./.build/periodo.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const agora = Date.parse('2026-10-31T13:05:00-03:00');
const br = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 16).replace('T', ' ');

t('hoje e ontem no horário de Brasília', () => {
  const h = P.intervalo('hoje', {}, agora); assert.strictEqual(br(h.ini), '2026-10-31 00:00'); assert.strictEqual(br(h.fim), '2026-11-01 00:00');
  const o = P.intervalo('ontem', {}, agora); assert.strictEqual(br(o.ini), '2026-10-30 00:00');
  // 22h de Brasília ainda é "hoje" (já é dia seguinte em UTC)
  const noite = Date.parse('2026-10-31T22:30:00-03:00');
  assert.strictEqual(br(P.intervalo('hoje', {}, noite).ini), '2026-10-31 00:00');
  assert.ok(P.dentro('2026-11-01T01:30:00Z', P.intervalo('hoje', {}, noite)));
});
t('7 e 30 dias contam hoje', () => {
  assert.strictEqual(br(P.intervalo('7d', {}, agora).ini), '2026-10-25 00:00');
  assert.strictEqual(br(P.intervalo('30d', {}, agora).ini), '2026-10-02 00:00');
});
t('meses', () => {
  const m = P.intervalo('mes', {}, agora); assert.strictEqual(br(m.ini), '2026-10-01 00:00'); assert.strictEqual(br(m.fim), '2026-11-01 00:00');
  const mp = P.intervalo('mes_passado', {}, agora); assert.strictEqual(br(mp.ini), '2026-09-01 00:00'); assert.strictEqual(br(mp.fim), '2026-10-01 00:00');
  const jan = P.intervalo('mes_passado', {}, Date.parse('2027-01-10T12:00:00-03:00')); assert.strictEqual(br(jan.ini), '2026-12-01 00:00');
  const dez = P.intervalo('mes_escolhido', { mes: '2026-12' }); assert.strictEqual(br(dez.fim), '2027-01-01 00:00');
});
t('dia e período escolhidos', () => {
  const d = P.intervalo('dia', { dia: '2026-10-30' }); assert.ok(P.dentro('2026-10-30T23:59:00-03:00', d) && !P.dentro('2026-10-31T00:00:00-03:00', d));
  const p = P.intervalo('periodo', { de: '2026-10-01', ate: '2026-10-15' }); assert.ok(P.dentro('2026-10-15T23:00:00-03:00', p) && !P.dentro('2026-10-16T00:00:00-03:00', p));
  const inv = P.intervalo('periodo', { de: '2026-10-15', ate: '2026-10-01' }); assert.ok(P.dentro('2026-10-10T12:00:00-03:00', inv));
  assert.strictEqual(P.intervalo('dia', { dia: '' }), null);
  const so = P.intervalo('periodo', { de: '2026-10-20' }); assert.ok(P.dentro('2027-05-01T00:00:00Z', so) && !P.dentro('2026-10-19T12:00:00-03:00', so));
  assert.ok(P.dentro('2020-01-01T00:00:00Z', P.intervalo('tudo')));
});
console.log(`período: ${ok} testes ok`);
