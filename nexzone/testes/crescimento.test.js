const assert = require('assert');
const C = require('./.build/crescimento.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };

t('slug do jogo', () => {
  assert.strictEqual(C.slugJogo('Free Fire'), 'free-fire');
  assert.strictEqual(C.slugJogo('  GTA V / GTA Online '), 'gta-v-gta-online');
  assert.strictEqual(C.slugJogo('Pokémon'), 'pokemon');
  assert.strictEqual(C.slugJogo('Honkai: Star Rail'), 'honkai-star-rail');
});
t('agrupar jogos: grafias diferentes viram um só, nome oficial vence', () => {
  const g = C.agruparJogos([
    { jogo: 'free fire', tipo_anuncio: 'conta', preco: 50, preco_promo: 40 },
    { jogo: 'Free Fire ', tipo_anuncio: 'moeda', preco: 10, preco_promo: null },
    { jogo: 'FREE FIRE', tipo_anuncio: 'conta', preco: 30, preco_promo: 35 },
    { jogo: 'Jogo Novo X', tipo_anuncio: 'item', preco: 5 },
    { jogo: '', preco: 1 }, { jogo: null, preco: 1 },
  ]);
  assert.strictEqual(g.length, 2);
  assert.deepStrictEqual([g[0].slug, g[0].nome, g[0].qtd], ['free-fire', 'Free Fire', 3]);
  assert.deepStrictEqual(g[0].tipos, { conta: 2, moeda: 1 });
  assert.strictEqual(g[0].menorPreco, 10);       // promo maior que o preço não vale
  assert.strictEqual(g[1].nome, 'Jogo Novo X');
  assert.ok(g[0].variantes.includes('Free Fire') && g[0].variantes.includes('free fire'));
});
t('SEO do jogo: título com o que se busca e preço real', () => {
  const s = C.seoDoJogo('Free Fire', 'contas', { qtd: 12, menorPreco: 19.9 });
  assert.ok(s.titulo.startsWith('Contas de Free Fire baratos a partir de R$ 19,90'));
  assert.ok(s.descricao.includes('12 anúncios'));
  assert.ok(s.faq.length >= 4);
  assert.ok(C.seoDoJogo('Roblox', null, { qtd: 0, menorPreco: null }).titulo.startsWith('Roblox barato'));
  assert.strictEqual(C.tipoPorSlug('gift-cards').tipo, 'giftcard'); assert.strictEqual(C.tipoPorSlug('xpto'), null);
});
t('Black Friday: datas padrão e fases', () => {
  const c = C.BF_PADRAO;
  // Black November: o mês inteiro
  assert.strictEqual(C.faseBF(c, Date.parse('2026-10-31T23:59:00-03:00')), 'antes');
  assert.strictEqual(C.faseBF(c, Date.parse('2026-11-01T00:00:00-03:00')), 'durante');
  assert.strictEqual(C.faseBF(c, Date.parse('2026-11-27T00:00:00-03:00')), 'durante');
  assert.strictEqual(C.faseBF(c, Date.parse('2026-11-30T23:59:00-03:00')), 'durante');
  assert.strictEqual(C.faseBF(c, Date.parse('2026-12-01T00:00:00-03:00')), 'depois');
});
t('Black Friday: leitura do admin com proteção', () => {
  assert.deepStrictEqual(C.lerCfgBF({}), C.BF_PADRAO);
  assert.strictEqual(C.lerCfgBF({ bf_desconto_min: 2 }).descontoMin, 10);   // abaixo de 5% não vale
  assert.strictEqual(C.lerCfgBF({ bf_desconto_min: '"15"' }).descontoMin, 15);
  assert.strictEqual(C.lerCfgBF({ bf_inicio: '2026-11-20T00:00:00-03:00', bf_fim: '2026-11-10T00:00:00-03:00' }).fim, C.BF_PADRAO.fim); // fim antes do início
});
t('Black Friday: desconto real sobre o preço de hoje', () => {
  const c = C.BF_PADRAO;
  assert.strictEqual(C.validarPrecoBF(100, 90, c).ok, true);
  assert.strictEqual(C.validarPrecoBF(100, 90.01, c).ok, false);
  assert.strictEqual(C.validarPrecoBF(9.9, 8.91, c).ok, true);
  assert.strictEqual(C.validarPrecoBF(9.9, 8.92, c).ok, false);
  assert.strictEqual(C.validarPrecoBF(100, 0.5, c).ok, false);
  assert.strictEqual(C.validarPrecoBF(100, 95, c).maximo, 90);
});
t('e-mail', () => { assert.ok(C.emailValido('a@b.com')); assert.ok(!C.emailValido('a@b')); assert.ok(!C.emailValido('a b@c.com')); });
t('oferta do dia: só desconto real e com estoque; mesma o dia todo', () => {
  const lista = [
    { id: 'a', preco: 100, preco_promo: 50, vendas: 0 },
    { id: 'b', preco: 100, preco_promo: 90, vendas: 10 },
    { id: 'c', preco: 100, preco_promo: 110 },            // "promo" maior: fora
    { id: 'd', preco: 100, preco_promo: 40, estoque: 0 }, // esgotado: fora
    { id: 'e', preco: 100, preco_promo: null },
  ];
  const x = C.escolherOferta(lista, '2026-11-01');
  assert.ok(['a', 'b'].includes(x.id));
  assert.strictEqual(C.escolherOferta(lista, '2026-11-01').id, x.id);
  const dias = new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => C.escolherOferta(lista, d).id));
  assert.ok(dias.size === 2, 'roda entre os candidatos');
  assert.strictEqual(C.escolherOferta([{ id: 'z', preco: 10, preco_promo: null }], '2026-11-01'), null);
});
t('hoje no fuso de Brasília', () => {
  assert.strictEqual(C.hojeBR(Date.parse('2026-11-02T02:00:00Z')).dia, '2026-11-01'); // 23h em Brasília
  assert.strictEqual(C.hojeBR(Date.parse('2026-11-02T03:30:00Z')).dia, '2026-11-02');
  assert.strictEqual(C.hojeBR(Date.parse('2026-11-02T12:00:00Z')).fim, Date.parse('2026-11-02T23:59:59-03:00'));
});
t('texto do canal', () => {
  const s = C.textoOfertaCanal({ titulo: 'Conta X', preco: 100, preco_promo: 60, link: 'https://x/p/1' });
  assert.ok(s.includes('De R$ 100,00 por R$ 60,00 (−40%)')); assert.ok(s.endsWith('https://x/p/1'));
  assert.ok(C.textoOfertaCanal({ titulo: 'Y', preco: 10, preco_promo: null, link: 'l' }).includes('Por R$ 10,00'));
});
t('tema black: auto liga 30 dias antes, durante vira black, depois desliga', () => {
  const cfg = { inicio: '2026-11-27T00:00:00-03:00', fim: '2026-11-30T23:59:59-03:00', descontoMin: 10 };
  const em = (s) => Date.parse(s);
  assert.deepStrictEqual(C.temaBlack('auto', cfg, em('2026-10-20T12:00:00-03:00')), { ativo: false, fase: null });
  assert.deepStrictEqual(C.temaBlack('auto', cfg, em('2026-10-30T12:00:00-03:00')), { ativo: true, fase: 'esquenta' });
  assert.deepStrictEqual(C.temaBlack('auto', cfg, em('2026-11-28T12:00:00-03:00')), { ativo: true, fase: 'black' });
  assert.deepStrictEqual(C.temaBlack('auto', cfg, em('2026-12-01T00:00:01-03:00')), { ativo: false, fase: null });
  assert.deepStrictEqual(C.temaBlack('ligado', cfg, em('2026-10-01T12:00:00-03:00')), { ativo: true, fase: 'esquenta' });
  assert.deepStrictEqual(C.temaBlack('ligado', cfg, em('2026-12-02T12:00:00-03:00')), { ativo: false, fase: null });
  assert.deepStrictEqual(C.temaBlack('desligado', cfg, em('2026-11-28T12:00:00-03:00')), { ativo: false, fase: null });
});
t('modo do tema: valores estranhos viram auto', () => {
  assert.strictEqual(C.lerModoTema('"ligado"'), 'ligado');
  assert.strictEqual(C.lerModoTema('desligado'), 'desligado');
  assert.strictEqual(C.lerModoTema(null), 'auto');
  assert.strictEqual(C.lerModoTema('xyz'), 'auto');
});
t('ordenar por desconto: só desconto real, maior primeiro', () => {
  const l = C.ordenarPorDesconto([
    { id: 'a', preco: 100, preco_promo: 90 }, { id: 'b', preco: 100, preco_promo: 50 },
    { id: 'c', preco: 100, preco_promo: null }, { id: 'd', preco: 100, preco_promo: 120 }, { id: 'e', preco: 10, preco_promo: 7 },
  ]);
  assert.deepStrictEqual(l.map((x) => x.id), ['b', 'e', 'a']);
  assert.deepStrictEqual(C.ordenarPorDesconto([{ id: 'a', preco: 100, preco_promo: 95 }], 10), []);
});
t('texto de compartilhar a Black Friday', () => {
  const s = C.textoCompartilharBF({ inicio: '2026-11-27T00:00:00-03:00', fim: '2026-11-30T23:59:59-03:00', descontoMin: 10 }, 'https://www.compreibarato.com.br/');
  assert.ok(s.includes('de 27/11 a 30/11'));
  assert.ok(s.includes('https://www.compreibarato.com.br/black-friday?utm_source=whatsapp'));
});
console.log(`crescimento: ${ok} testes ok`);
