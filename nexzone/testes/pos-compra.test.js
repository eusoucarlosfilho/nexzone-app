const assert = require('assert');
const A = require('./.build/ajudaPedido.js');
const E = require('./.build/entregaEmail.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const base = { conteudo: null, temArquivo: false, temCurso: false, manual: false, prazoTexto: '24 horas', extras: [] };

t('ajuda: 5 opções e desistir vira arrependimento', () => {
  assert.strictEqual(A.OPCOES_AJUDA.length, 5);
  assert.strictEqual(A.motivoReembolsoDe('desistir'), 'arrependimento');
  assert.strictEqual(A.motivoReembolsoDe('nao_funciona'), 'problema_tecnico');
  assert.strictEqual(A.motivoReembolsoDe('diferente'), 'nao_era_o_esperado');
  assert.strictEqual(A.motivoReembolsoDe('duvida'), '');
  assert.strictEqual(A.motivoReembolsoDe(null), '');
});
t('motivos do reembolso existem na garantia', () => {
  const ids = ['nao_recebi', 'problema_tecnico', 'nao_era_o_esperado', 'arrependimento'];
  const G = require('./.build/garantia.js');
  ids.forEach((i) => assert.ok(G.MOTIVOS.some((m) => m.id === i), i));
});
t('e-mail: link sozinho vira link clicável', () => {
  const h = E.blocoEntregaHtml({ ...base, conteudo: 'https://drive.google.com/abc' });
  assert.ok(h.includes('href="https://drive.google.com/abc"')); assert.ok(h.includes('Seu acesso'));
});
t('e-mail: texto do vendedor é escapado (sem HTML injetado)', () => {
  const h = E.blocoEntregaHtml({ ...base, conteudo: 'Login: joao <script>alert(1)</script>\nSenha: 123 **forte**\nhttps://site.com/x' });
  assert.ok(!h.includes('<script>')); assert.ok(h.includes('&lt;script&gt;')); assert.ok(h.includes('<br>'));
  assert.ok(h.includes('href="https://site.com/x"')); assert.ok(!h.includes('**'));
});
t('e-mail: javascript: nunca vira link', () => {
  const h = E.blocoEntregaHtml({ ...base, conteudo: 'clique javascript:alert(1)' });
  assert.ok(!/href="javascript/i.test(h));
});
t('e-mail: entrega pelo vendedor mostra o prazo', () => {
  const h = E.blocoEntregaHtml({ ...base, manual: true, prazoTexto: '2 horas' });
  assert.ok(h.includes('2 horas')); assert.ok(h.includes('chat do pedido'));
});
t('e-mail: arquivo, curso e extras', () => {
  const h = E.blocoEntregaHtml({ ...base, temArquivo: true, temCurso: true, extras: ['Bônus <b>'] });
  assert.ok(h.includes('arquivo')); assert.ok(h.includes('área de membros')); assert.ok(h.includes('Bônus &lt;b&gt;'));
});
t('e-mail: sem nada cadastrado ainda aponta para o pedido', () => {
  assert.ok(E.blocoEntregaHtml(base).includes('página do pedido'));
});
console.log(`pós-compra: ${ok} testes ok`);
