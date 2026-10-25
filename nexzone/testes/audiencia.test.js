const a = require('./.build/audiencia.js');
const assert = require('assert');
let ok = 0, fail = 0;
function t(nome, fn) { try { fn(); ok++; console.log('OK  ', nome); } catch (e) { fail++; console.log('FAIL', nome, '-', e.message); } }
const agora = new Date('2026-10-24T15:30:00Z'); // 12:30 em SP (UTC-3)
t('inicioDoDia(0) = 03:00Z', () => assert.strictEqual(a.inicioDoDia(0, agora).toISOString(), '2026-10-24T03:00:00.000Z'));
t('hoje: anterior tem mesma duração', () => { const i = a.intervalos('hoje', agora); assert.strictEqual(i.atual.fim - i.atual.inicio, i.anterior.fim - i.anterior.inicio); assert.strictEqual(i.anterior.inicio.toISOString(), '2026-10-23T03:00:00.000Z'); });
t('ontem: dia cheio', () => { const i = a.intervalos('ontem', agora); assert.strictEqual(i.atual.inicio.toISOString(), '2026-10-23T03:00:00.000Z'); assert.strictEqual(i.atual.fim.toISOString(), '2026-10-24T03:00:00.000Z'); });
t('7d: começa 6 dias atrás; anterior termina no início', () => { const i = a.intervalos('7d', agora); assert.strictEqual(i.atual.inicio.toISOString(), '2026-10-18T03:00:00.000Z'); assert.strictEqual(i.anterior.fim.getTime(), i.atual.inicio.getTime()); assert.strictEqual(i.anterior.inicio.toISOString(), '2026-10-11T03:00:00.000Z'); });
t('30d: anterior com 30 dias', () => { const i = a.intervalos('30d', agora); assert.strictEqual((i.anterior.fim - i.anterior.inicio) / 86400000, 30); });
t('baldes hoje: 00h..12h', () => { const b = a.baldes('hoje', a.intervalos('hoje', agora).atual, agora); assert.strictEqual(b.length, 13); assert.strictEqual(b[12].rotulo, '12h'); });
t('baldes ontem: 24 horas', () => assert.strictEqual(a.baldes('ontem', a.intervalos('ontem', agora).atual, agora).length, 24));
t('baldes 7d: 7 dias, último 24/10', () => { const b = a.baldes('7d', a.intervalos('7d', agora).atual, agora); assert.strictEqual(b.length, 7); assert.strictEqual(b[6].rotulo, '24/10'); });
t('baldes 30d: 30 dias', () => assert.strictEqual(a.baldes('30d', a.intervalos('30d', agora).atual, agora).length, 30));
t('periodoValido rejeita valor estranho', () => { assert.strictEqual(a.periodoValido('90d'), '7d'); assert.strictEqual(a.periodoValido("x' or 1=1"), '7d'); assert.strictEqual(a.periodoValido('hoje'), 'hoje'); });
t('caminhosDoVendedor', () => assert.deepStrictEqual(a.caminhosDoVendedor('minha', ['p1']), ['/loja/minha', '/produto/p1', '/checkout/p1']));
t('classificar', () => { assert.deepStrictEqual(a.classificar('/produto/abc'), { tipo: 'produto', produtoId: 'abc' }); assert.deepStrictEqual(a.classificar('/checkout/abc/'), { tipo: 'checkout', produtoId: 'abc' }); assert.deepStrictEqual(a.classificar('/loja/x'), { tipo: 'loja', produtoId: null }); assert.strictEqual(a.classificar('/admin'), null); });
t('canal', () => { assert.strictEqual(a.canal(null), 'Direto'); assert.strictEqual(a.canal('https://l.instagram.com/x'), 'Instagram'); assert.strictEqual(a.canal('https://www.google.com.br/'), 'Google'); assert.strictEqual(a.canal('https://wa.me/55'), 'WhatsApp'); assert.strictEqual(a.canal('https://comprei.com/a', 'comprei.com'), 'Direto'); assert.strictEqual(a.canal('lixo'), 'Direto'); assert.strictEqual(a.canal('https://blog.exemplo.com'), 'Outros sites'); });
t('mascarar', () => { assert.strictEqual(a.mascarar(0), 0); assert.strictEqual(a.mascarar(1), null); assert.strictEqual(a.mascarar(2), null); assert.strictEqual(a.mascarar(3), 3); });
t('variacao', () => { assert.strictEqual(a.variacao(15, 10), 50); assert.strictEqual(a.variacao(3, 2), null); assert.strictEqual(a.variacao(20, 0), null); });
t('oportunidades: sem checkout / boa taxa / tendência / canal', () => {
  const o = a.oportunidades({ produtos: [
    { id: '1', titulo: 'A', visualizacoes: 40, checkout: 0, destaque: false, ativo: true },
    { id: '2', titulo: 'B', visualizacoes: 30, checkout: 9, destaque: false, ativo: true },
    { id: '3', titulo: 'C', visualizacoes: 50, checkout: 0, destaque: false, ativo: false },
  ], viewsAtual: 120, viewsAnterior: 60, canais: [{ canal: 'Instagram', sessoes: 30 }, { canal: 'Direto', sessoes: 10 }], sessoes: 40, rotuloAnterior: 'x' });
  assert.strictEqual(o.length, 4);
  assert.ok(o[0].titulo.includes('"A"'));
  assert.ok(o[1].titulo.includes('"B"'));
  assert.ok(o[2].titulo.includes('subiram 100%'));
  assert.ok(o[3].titulo.startsWith('Instagram'));
});
t('oportunidades: amostra pequena não gera nada', () => assert.strictEqual(a.oportunidades({ produtos: [{ id: '1', titulo: 'A', visualizacoes: 5, checkout: 0, destaque: false, ativo: true }], viewsAtual: 5, viewsAnterior: 1, canais: [{ canal: 'Direto', sessoes: 4 }], sessoes: 4, rotuloAnterior: 'x' }).length, 0));
console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
