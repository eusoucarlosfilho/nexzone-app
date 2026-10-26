// Moderação de anúncios (src/lib/moderacao.ts)
const assert = require('assert');
const m = require('./.build/moderacao.js');
let ok = 0, fail = 0; const t = (n, fn) => { try { fn(); ok++; console.log('OK  ', n); } catch (x) { fail++; console.log('FAIL', n, '-', x.message); } };
t('ação inválida recusada', () => assert.strictEqual(m.validarModeracao({ acao: 'apagar' }).ok, false));
t('correção sem item nem texto recusada', () => assert.strictEqual(m.validarModeracao({ acao: 'correcao', itens: [] }).ok, false));
t('correção com item válido passa; item desconhecido some', () => { const r = m.validarModeracao({ acao: 'correcao', itens: ['foto', 'hack', 'foto'] }); assert.deepStrictEqual(r.pedido.itens, ['foto']); });
t('pausar exige motivo', () => { assert.strictEqual(m.validarModeracao({ acao: 'pausar' }).ok, false); assert.strictEqual(m.validarModeracao({ acao: 'pausar', texto: 'denúncia' }).ok, true); });
t('reativar não precisa de motivo e limpa itens', () => assert.deepStrictEqual(m.validarModeracao({ acao: 'reativar', itens: ['foto'] }).pedido.itens, []));
t('texto limitado', () => assert.strictEqual(m.validarModeracao({ acao: 'cancelar', texto: 'x'.repeat(5000) }).pedido.texto.length, m.TEXTO_MAX));
t('efeitos: status e estado', () => {
  assert.deepStrictEqual(m.efeitoModeracao('correcao'), { status: 'reprovado', moderacao: 'correcao' });
  assert.deepStrictEqual(m.efeitoModeracao('pausar'), { status: 'pausado', moderacao: 'pausado_admin' });
  assert.deepStrictEqual(m.efeitoModeracao('cancelar'), { status: 'reprovado', moderacao: 'cancelado' });
  assert.deepStrictEqual(m.efeitoModeracao('reativar'), { status: 'ativo', moderacao: null });
});
t('aviso de correção lista o que corrigir e a observação', () => {
  const a = m.avisoParaVendedor('correcao', 'Guia X', ['foto', 'entrega'], 'Link 404');
  assert.ok(a.assunto.includes('Guia X')); assert.ok(a.corpo.includes('Foto ruim')); assert.ok(a.corpo.includes('Link 404'));
});
t('aviso de cancelamento menciona pedidos antigos', () => assert.ok(m.avisoParaVendedor('cancelar', 'Y', [], 'fraude').corpo.includes('pedidos já feitos')));
console.log(`\n${ok} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
