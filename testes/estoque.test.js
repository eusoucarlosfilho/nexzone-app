// Estoque e contadores (src/lib/estoque.ts)
const assert = require('assert');
const e = require('./.build/estoque.js');
let ok = 0, fail = 0; const t = (n, f) => { try { f(); ok++; console.log('OK  ', n); } catch (x) { fail++; console.log('FAIL', n, '-', x.message); } };
t('em branco = não controla (null)', () => { assert.deepStrictEqual(e.lerEstoque(''), { ok: true, valor: null }); assert.deepStrictEqual(e.lerEstoque(null), { ok: true, valor: null }); });
t('número inteiro aceito', () => assert.deepStrictEqual(e.lerEstoque(' 25 '), { ok: true, valor: 25 }));
t('zero aceito (esgotado)', () => assert.deepStrictEqual(e.lerEstoque('0'), { ok: true, valor: 0 }));
t('negativo, decimal e texto recusados', () => { for (const v of ['-1', '2.5', '1e3', 'abc', '10 un']) assert.strictEqual(e.lerEstoque(v).ok, false, v); });
t('acima do máximo recusado', () => assert.strictEqual(e.lerEstoque('1000001').ok, false));
t('sem estoque: nada aparece ao comprador', () => { assert.strictEqual(e.avisoEstoque(null), null); assert.strictEqual(e.avisoEstoque(undefined), null); });
t('0 = Esgotado', () => assert.deepStrictEqual(e.avisoEstoque(0), { texto: 'Esgotado', nivel: 'esgotado' }));
t('1 = última unidade', () => assert.strictEqual(e.avisoEstoque(1).texto, 'Última unidade disponível'));
t('até 10 = "Restam só N"', () => { assert.strictEqual(e.avisoEstoque(7).texto, 'Restam só 7 unidades'); assert.strictEqual(e.avisoEstoque(10).nivel, 'pouco'); });
t('acima de 10 = disponíveis', () => { const a = e.avisoEstoque(1500); assert.strictEqual(a.nivel, 'ok'); assert.ok(a.texto.startsWith('1.500')); });
(async () => {
  const semColuna = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'column products.estoque does not exist' } }) }) }) };
  const r = await e.extrasDe(semColuna, ['a']);
  t('extrasDe: erro de coluna → {}', () => assert.deepStrictEqual(r, {}));
  const comColuna = { from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'a', estoque: '3', pausado_sem_estoque: null, ocultar_contadores: true }], error: null }) }) }) };
  const r2 = await e.extrasDe(comColuna, ['a']);
  t('extrasDe: normaliza tipos', () => assert.deepStrictEqual(r2.a, { estoque: 3, pausado_sem_estoque: false, ocultar_contadores: true }));
  t('extrasDe: lista vazia não consulta', async () => assert.deepStrictEqual(await e.extrasDe(null, []), {}));
  console.log(`\n${ok} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
})();
