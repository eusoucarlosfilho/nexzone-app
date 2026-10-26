// Alterações do anúncio na Fila de Aprovação (src/lib/edicoes.ts)
const assert = require('assert');
const e = require('./.build/edicoes.js');
let ok = 0, fail = 0; const t = (n, f) => { try { f(); ok++; console.log('OK  ', n); } catch (x) { fail++; console.log('FAIL', n, '-', x.message); } };
const ed = (alteracoes, created_at = '2026-10-26T10:00:00Z', tipo = 'edicao') => ({ alteracoes, created_at, tipo });

t('preço: antes → depois em reais', () => {
  const r = e.resumirAlteracoes([ed({ preco: { antes: 12.9, depois: 9.9 } })]);
  assert.deepStrictEqual(r.itens[0], { campo: 'preco', rotulo: 'Preço', tipo: 'valor', antes: 'R$ 12,90', depois: 'R$ 9,90' });
});
t('título e categoria em texto', () => {
  const r = e.resumirAlteracoes([ed({ titulo: { antes: 'Guia A', depois: 'Guia B' }, categoria: { antes: 'Design', depois: 'Cursos' } })]);
  assert.deepStrictEqual(r.itens.map((i) => i.campo), ['titulo', 'categoria']);
});
t('várias edições: antes da 1ª e depois da última', () => {
  const r = e.resumirAlteracoes([
    ed({ titulo: { antes: 'A', depois: 'B' } }, '2026-10-26T10:00:00Z'),
    ed({ titulo: { antes: 'B', depois: 'C' } }, '2026-10-26T11:00:00Z'),
  ]);
  assert.strictEqual(r.itens[0].antes, 'A'); assert.strictEqual(r.itens[0].depois, 'C'); assert.strictEqual(r.edicoes, 2);
});
t('editou e desfez: nenhuma alteração final', () => {
  const r = e.resumirAlteracoes([ed({ titulo: { antes: 'A', depois: 'B' } }, '1'), ed({ titulo: { antes: 'B', depois: 'A' } }, '2')]);
  assert.strictEqual(r.itens.length, 0); assert.strictEqual(r.edicoes, 2);
});
t('fotos: adicionada, removida e capa trocada', () => {
  const r = e.resumirAlteracoes([ed({ imagens: { antes: ['a.jpg', 'b.jpg'], depois: ['c.jpg', 'a.jpg'] } })]);
  const i = r.itens[0];
  assert.deepStrictEqual([i.adicionadas, i.removidas, i.capaTrocada, i.capaAntes, i.capaDepois], [['c.jpg'], ['b.jpg'], true, 'a.jpg', 'c.jpg']);
});
t('fotos: só a ordem mudou (sem trocar a capa)', () => {
  const r = e.resumirAlteracoes([ed({ imagens: { antes: ['a', 'b', 'c'], depois: ['a', 'c', 'b'] } })]);
  assert.strictEqual(r.itens[0].ordemMudou, true);
});
t('capa_url some quando as fotos já aparecem', () => {
  const r = e.resumirAlteracoes([ed({ imagens: { antes: ['a'], depois: ['b'] }, capa_url: { antes: 'a', depois: 'b' } })]);
  assert.deepStrictEqual(r.itens.map((i) => i.campo), ['imagens']);
});
t('arquivo: nome antes → depois num item só', () => {
  const r = e.resumirAlteracoes([ed({ arquivo_path: { antes: 'u/1.pdf', depois: 'u/2.pdf' }, arquivo_nome: { antes: 'v1.pdf', depois: 'v2.pdf' } })]);
  assert.deepStrictEqual(r.itens.map((i) => [i.campo, i.antes, i.depois]), [['arquivo', 'v1.pdf', 'v2.pdf']]);
});
t('arquivo trocado com o mesmo nome é sinalizado', () => {
  const r = e.resumirAlteracoes([ed({ arquivo_path: { antes: 'u/1.pdf', depois: 'u/2.pdf' } })]);
  assert.ok(String(r.itens[0].depois).includes('substituído'));
});
t('conteúdo de entrega vai como sensível (escondido até clicar)', () => {
  const r = e.resumirAlteracoes([ed({ conteudo_entrega: { antes: 'link1', depois: 'link2' } })]);
  assert.strictEqual(r.itens[0].tipo, 'sensivel');
});
t('descrição: diferença por linhas', () => {
  const r = e.resumirAlteracoes([ed({ descricao: { antes: 'a\nb\nc', depois: 'a\nB\nc\nd' } })]);
  assert.deepStrictEqual(r.itens[0].linhas, [{ op: '=', t: 'a' }, { op: '-', t: 'b' }, { op: '+', t: 'B' }, { op: '=', t: 'c' }, { op: '+', t: 'd' }]);
});
t('garantia e tipo de entrega legíveis', () => {
  const r = e.resumirAlteracoes([ed({ garantia_dias: { antes: 7, depois: 30 }, tipo_entrega: { antes: 'arquivo', depois: 'link' } })]);
  const m = Object.fromEntries(r.itens.map((i) => [i.campo, i.antes + ' → ' + i.depois]));
  assert.strictEqual(m.garantia_dias, '7 dias → 30 dias'); assert.strictEqual(m.tipo_entrega, 'Arquivo para download → Link de acesso');
});
t('reativação sem mudanças', () => {
  const r = e.resumirAlteracoes([ed({}, '1', 'reativacao')]);
  assert.deepStrictEqual([r.reativacao, r.edicoes, r.itens.length], [true, 0, 0]);
});
t('sem registros = produto novo', () => { const r = e.resumirAlteracoes([]); assert.deepStrictEqual([r.edicoes, r.reativacao, r.itens.length], [0, false, 0]); });
t('preço 9.9 vs "9.90" não conta como mudança', () => assert.strictEqual(e.resumirAlteracoes([ed({ preco: { antes: 9.9, depois: '9.90' } })]).itens.length, 0));
console.log(`\n${ok} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
