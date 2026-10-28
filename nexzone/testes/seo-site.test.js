// SEO do site: títulos automáticos, dados estruturados da marca, trilha e categorias.
const assert = require('assert');
const S = require('./.build/seoSite.js');
const { CATEGORIAS } = require('./.build/categorias.js');
let ok = 0;
const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };

t('título do produto: marca no fim, categoria quando cabe, até ~80 caracteres', () => {
  const a = S.tituloDoProduto('Planilha de Controle Financeiro Pessoal', 'Negócios & Finanças');
  assert.strictEqual(a, 'Planilha de Controle Financeiro Pessoal | Negócios & Finanças | Comprei Barato');
  const b = S.tituloDoProduto('Pack com mais de 500 artes editáveis no Canva para social media de clínicas e consultórios', 'Design');
  assert.ok(b.endsWith(' | Comprei Barato') && !b.includes('Design') && b.length <= 80, b);
});
t('título: tira emoji e CAIXA ALTA', () => {
  assert.strictEqual(S.tituloDoProduto('🔥 CURSO COMPLETO DE EXCEL!!!', null), 'Curso Completo de Excel! | Comprei Barato');
  assert.strictEqual(S.tituloDoProduto('', null), 'Produto digital | Comprei Barato');
});
t('descrição: completa descrição curta com preço e entrega', () => {
  const d = S.descricaoDoProduto('Planilha simples.', 'Planilha Financeira', 19.9);
  assert.ok(d.includes('R$ 19,90') && d.length <= 155, d);
  const longa = 'Uma planilha completa para organizar receitas, despesas, metas e investimentos do mês, com gráficos automáticos e categorias prontas para você usar hoje mesmo.';
  assert.ok(!S.descricaoDoProduto(longa, 'X', 10).includes('R$'));
});
t('WebSite: nome da marca, alternativas e busca interna', () => {
  const w = S.dadosWebSite();
  assert.strictEqual(w['@type'], 'WebSite');
  assert.strictEqual(w.name, 'Comprei Barato');
  assert.ok(w.alternateName.includes('compreibarato.com.br'));
  assert.ok(w.url.endsWith('/'));
  assert.ok(w.potentialAction.target.urlTemplate.includes('/produtos?q={search_term_string}'));
});
t('Organization: logo e perfis só quando existem', () => {
  assert.strictEqual(S.dadosOrganizacao().sameAs, undefined);
  const o = S.dadosOrganizacao(['https://instagram.com/compreibarato'], 'contato@x.com');
  assert.deepStrictEqual(o.sameAs, ['https://instagram.com/compreibarato']);
  assert.ok(o.logo.url.endsWith('/logo.png'));
});
t('perfis: normaliza, força https, tira duplicados e lixo', () => {
  assert.deepStrictEqual(S.limparPerfis('instagram.com/cb\nhttp://instagram.com/cb  javascript:alert(1)'), ['https://instagram.com/cb']);
  assert.deepStrictEqual(S.limparPerfis(null), []);
});
t('trilha de navegação com URLs absolutas', () => {
  const b = S.dadosTrilha([{ nome: 'Início', url: '/' }, { nome: 'Design', url: '/categoria/design' }]);
  assert.strictEqual(b.itemListElement[1].position, 2);
  assert.ok(/^https:\/\//.test(b.itemListElement[1].item));
});
t('todas as categorias têm título, descrição ≤155 e texto próprio', () => {
  for (const c of CATEGORIAS) {
    const m = S.metaDaCategoria(c);
    assert.ok(m.titulo.includes(c.nome) && m.titulo.endsWith('| Comprei Barato'), m.titulo);
    assert.ok(m.descricao.length <= 155, c.slug);
    const tx = S.textoDaCategoria(c);
    assert.strictEqual(tx.paragrafos.length, 2);
  }
});
t('JSON seguro dentro de <script>', () => assert.ok(!S.jsonLd({ a: '</script><b>' }).includes('</script>')));
t('áreas privadas bloqueadas, vitrine liberada', () => {
  for (const x of ['/admin', '/vender', '/checkout', '/pedido', '/curso', '/produtores/obrigado']) assert.ok(S.BLOQUEADOS.includes(x));
  for (const x of ['/produto', '/categoria', '/loja', '/produtores']) assert.ok(!S.BLOQUEADOS.includes(x));
});
console.log(`SEO do site: ${ok} testes ok`);
