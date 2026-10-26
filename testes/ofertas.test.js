const assert = require('assert');
const url = require('./.build/ofertas/url.js');
const val = require('./.build/ofertas/validar.js');
const csv = require('./.build/ofertas/csv.js');
const mix = require('./.build/ofertas/mix.js');
const tipos = require('./.build/ofertas/tipos.js');
let ok = 0, fail = 0;
const t = (n, f) => { try { f(); ok++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };

// ---- URL (redirecionamento) ----
const v = (u, p) => url.validarUrlExterna(u, p);
t('aceita https Hotmart com parâmetros de afiliado', () => { const r = v('https://go.hotmart.com/X123?ap=abc&src=cb#topo', 'hotmart'); assert.ok(r.ok); assert.strictEqual(r.url, 'https://go.hotmart.com/X123?ap=abc&src=cb'); });
t('aceita pay.kiwify.com.br', () => assert.ok(v('https://pay.kiwify.com.br/abc', 'kiwify').ok));
t('recusa http', () => assert.ok(!v('http://pay.hotmart.com/x', 'hotmart').ok));
t('recusa javascript:', () => assert.ok(!v('javascript:alert(1)', null).ok));
t('recusa data:', () => assert.ok(!v('data:text/html,<b>x</b>', null).ok));
t('recusa file:', () => assert.ok(!v('file:///etc/passwd', null).ok));
t('recusa malformada', () => assert.ok(!v('https//sem-dois-pontos', null).ok));
t('recusa IP literal', () => { assert.ok(!v('https://127.0.0.1/x', 'direto').ok); assert.ok(!v('https://10.0.0.5/', 'direto').ok); assert.ok(!v('https://[::1]/', 'direto').ok); });
t('recusa IP numérico/hex', () => { assert.ok(!v('https://2130706433/', 'direto').ok); assert.ok(!v('https://0x7f000001/', 'direto').ok); });
t('recusa localhost e .internal', () => { assert.ok(!v('https://localhost/', 'direto').ok); assert.ok(!v('https://api.internal/', 'direto').ok); });
t('recusa usuário/senha', () => assert.ok(!v('https://user:pw@pay.hotmart.com/x', 'hotmart').ok));
t('recusa porta não padrão', () => assert.ok(!v('https://pay.hotmart.com:8443/x', 'hotmart').ok));
t('recusa domínio falso parecido', () => { assert.ok(!v('https://hotmart.com.golpe.io/x', 'hotmart').ok); assert.ok(!v('https://fakehotmart.com/x', 'hotmart').ok); });
t('recusa domínio de outra plataforma', () => assert.ok(!v('https://pay.kiwify.com.br/x', 'hotmart').ok));
t('parceiro direto aceita domínio público', () => assert.ok(v('https://loja.exemplo.com.br/produto', 'direto').ok));
t('recusa espaço/controle', () => assert.ok(!v('https://pay.hotmart.com/a b', 'hotmart').ok));
t('recusa > 2048', () => assert.ok(!v('https://pay.hotmart.com/' + 'a'.repeat(2100), 'hotmart').ok));
t('chave de duplicidade ignora parâmetros e www', () => assert.strictEqual(url.chaveDuplicidade('https://www.pay.hotmart.com/X1/?ap=1'), url.chaveDuplicidade('https://pay.hotmart.com/X1?ap=2')));

// ---- link de saída ----
t('saída usa afiliado quando válido', () => assert.strictEqual(val.linkDeSaida({ affiliate_url: 'https://go.hotmart.com/A?ap=1', external_product_url: 'https://pay.hotmart.com/P', external_platform: 'hotmart' }), 'https://go.hotmart.com/A?ap=1'));
t('saída cai no link do produto se afiliado inválido', () => assert.strictEqual(val.linkDeSaida({ affiliate_url: 'https://evil.com/x', external_product_url: 'https://pay.hotmart.com/P', external_platform: 'hotmart' }), 'https://pay.hotmart.com/P'));
t('saída nula se nenhum link válido', () => assert.strictEqual(val.linkDeSaida({ affiliate_url: null, external_product_url: 'javascript:1', external_platform: 'hotmart' }), null));

// ---- validação de oferta ----
const base = { title: 'Curso de Excel', category: 'Cursos & Ebooks', external_platform: 'hotmart', external_product_url: 'https://pay.hotmart.com/X1' };
t('oferta mínima válida vira rascunho', () => { const r = val.validarOferta(base); assert.ok(r.ok); assert.strictEqual(r.dados.status, 'rascunho'); assert.strictEqual(r.dados.slug, 'curso-de-excel'); });
t('categoria por slug é normalizada', () => { const r = val.validarOferta({ ...base, category: 'cursos-ebooks' }); assert.ok(r.ok); assert.strictEqual(r.dados.category, 'Cursos & Ebooks'); });
t('categoria inexistente', () => assert.ok(!val.validarOferta({ ...base, category: 'Armas' }).ok));
t('preço brasileiro', () => { assert.strictEqual(val.lerPreco('1.297,90'), 1297.9); assert.strictEqual(val.lerPreco('97'), 97); assert.strictEqual(val.lerPreco('R$ 47,00'), 47); assert.strictEqual(val.lerPreco(''), null); assert.strictEqual(val.lerPreco('abc'), 'invalido'); assert.strictEqual(val.lerPreco('-5'), 'invalido'); });
t('tags limpas e limitadas', () => { const r = val.validarOferta({ ...base, tags: 'Excel, planilha; excel|  ' }); assert.deepStrictEqual(r.dados.tags, ['excel', 'planilha']); });
t('slug sem acento', () => assert.strictEqual(tipos.gerarSlug('Ação & Reação: Guia!'), 'acao-reacao-guia'));

// ---- CSV ----
const cab = 'nome,categoria,plataforma,url_produto,url_afiliado,preco_referencia,moeda,produtor,descricao\n';
t('CSV válido com aspas, vírgula e quebra de linha', () => {
  const p = csv.validarCsv(cab + '"Curso, avançado",Cursos & Ebooks,hotmart,https://pay.hotmart.com/A1,,"97,00",BRL,Ana,"linha 1\nlinha 2"\n');
  assert.strictEqual(p.validas, 1); assert.strictEqual(p.linhas[0].dados.title, 'Curso, avançado'); assert.strictEqual(p.linhas[0].dados.description, 'linha 1\nlinha 2'); assert.strictEqual(p.linhas[0].dados.price_reference, 97);
});
t('CSV com ponto e vírgula', () => { const p = csv.validarCsv('nome;categoria;plataforma;url_produto\nX;Design;kiwify;https://pay.kiwify.com.br/z\n'); assert.strictEqual(p.validas, 1); });
t('CSV: erro por linha', () => { const p = csv.validarCsv(cab + 'A,Design,hotmart,http://pay.hotmart.com/a\nB,Design,hotmart,https://pay.hotmart.com/b\n'); assert.strictEqual(p.validas, 1); assert.strictEqual(p.comErro, 1); assert.strictEqual(p.linhas[0].linha, 2); });
t('CSV: duplicada no arquivo', () => { const p = csv.validarCsv(cab + 'A,Design,hotmart,https://pay.hotmart.com/a\nA2,Design,hotmart,https://pay.hotmart.com/a?x=1\n'); assert.strictEqual(p.duplicadas, 1); });
t('CSV: duplicada no cadastro', () => { const p = csv.validarCsv(cab + 'A,Design,hotmart,https://pay.hotmart.com/a\n', { slugs: ['a'] }); assert.strictEqual(p.duplicadas, 1); assert.strictEqual(p.linhas[0].duplicada, 'ja_cadastrada'); });
t('CSV: coluna obrigatória ausente', () => assert.ok(/url_compra/.test(csv.validarCsv('nome,categoria,plataforma\nA,Design,hotmart\n').erroGeral)));
t('CSV: limite de linhas', () => { const linhas = Array.from({ length: 501 }, (_, i) => `P${i},Design,hotmart,https://pay.hotmart.com/p${i}`).join('\n'); assert.ok(/500/.test(csv.validarCsv(cab.split(',').slice(0, 4).join(',') + '\n' + linhas).erroGeral)); });
t('CSV: limite de 1 MB', () => assert.ok(/1 MB/.test(csv.validarCsv('x'.repeat(1024 * 1024 + 10)).erroGeral)));
t('CSV: sempre rascunho mesmo com status no arquivo', () => { const p = csv.validarCsv('nome,categoria,plataforma,url_produto,status\nA,Design,hotmart,https://pay.hotmart.com/a,ativo\n'); assert.strictEqual(p.linhas[0].dados.status, 'rascunho'); });
t('SQL gerado escapa aspas', () => { const p = csv.validarCsv(cab + "\"D'Avila; drop table x\",Design,hotmart,https://pay.hotmart.com/a\n"); const s = csv.gerarSqlImportacao([p.linhas[0].dados], false); assert.ok(s.includes("'D''Avila; drop table x'")); assert.ok(s.includes("'rascunho'")); assert.ok(s.includes('NÃO EXECUTAR')); });

// ---- mistura nativos x parceiros ----
const cfg = mix.MIX_PADRAO; // 30%, máx 1 seguido, 12 sem nativos
const N = (n) => Array.from({ length: n }, (_, i) => 'n' + i), P = (n) => Array.from({ length: n }, (_, i) => 'p' + i);
t('sem nativos: até maxSemNativos', () => assert.strictEqual(mix.intercalar([], P(20), cfg).length, 12));
t('teto de 30%', () => { const r = mix.intercalar(N(7), P(10), cfg); assert.strictEqual(r.filter((x) => x.tipo === 'parceiro').length, 3); });
t('nativos mantêm ordem e vêm primeiro', () => { const r = mix.intercalar(N(7), P(10), cfg); assert.strictEqual(r[0].tipo, 'nativo'); assert.deepStrictEqual(r.filter((x) => x.tipo === 'nativo').map((x) => x.item), N(7)); });
t('nunca dois parceiros seguidos com nativos disponíveis', () => { const r = mix.intercalar(N(20), P(10), cfg); for (let i = 1; i < r.length; i++) assert.ok(!(r[i].tipo === 'parceiro' && r[i - 1].tipo === 'parceiro')); });
t('respeita vagas da página', () => assert.strictEqual(mix.intercalar(N(20), P(10), cfg, 2).filter((x) => x.tipo === 'parceiro').length, 2));
t('desligado: só nativos', () => assert.strictEqual(mix.intercalar(N(3), P(3), { ...cfg, ativo: false }).length, 3));
t('normalizarMix limita valores', () => { const m = mix.normalizarMix({ maxPct: 500, maxSeguidos: 0, homeQtd: -3, ativo: 'x' }); assert.strictEqual(m.maxPct, 100); assert.strictEqual(m.maxSeguidos, 1); assert.strictEqual(m.homeQtd, 0); assert.strictEqual(m.ativo, false); });
t('precisaVerificar após 30 dias', () => { assert.ok(tipos.precisaVerificar(null)); assert.ok(tipos.precisaVerificar(new Date(Date.now() - 31 * 864e5).toISOString())); assert.ok(!tipos.precisaVerificar(new Date().toISOString())); });


// ---- produtos externos (marketplaces) ----
const pux = require('./.build/ofertas/puxarDados.js');
t('aceita Mercado Livre, Shopee, Amazon, Magalu, AliExpress', () => {
  assert.ok(v('https://produto.mercadolivre.com.br/MLB-123-x', 'mercadolivre').ok);
  assert.ok(v('https://shopee.com.br/produto-i.1.2', 'shopee').ok);
  assert.ok(v('https://www.amazon.com.br/dp/B0X', 'amazon').ok);
  assert.ok(v('https://amzn.to/3abc', 'amazon').ok);
  assert.ok(v('https://www.magazineluiza.com.br/p/123', 'magalu').ok);
  assert.ok(v('https://pt.aliexpress.com/item/1.html', 'aliexpress').ok);
});
t('recusa domínio de outro marketplace na plataforma errada', () => assert.ok(!v('https://shopee.com.br/x', 'mercadolivre').ok));
t('"Outro site" aceita qualquer https público', () => assert.ok(v('https://lojaqualquer.com.br/p/1', 'outra').ok));
t('recusa encurtadores genéricos (bit.ly, tinyurl…) em qualquer plataforma', () => {
  assert.ok(!v('https://bit.ly/abc', 'outra').ok); assert.ok(!v('https://tinyurl.com/x', 'direto').ok); assert.ok(!v('https://t.co/x', 'outra').ok);
});
t('nomes de plataforma escritos à mão', () => {
  assert.strictEqual(tipos.normalizarPlataforma('Mercado Livre'), 'mercadolivre'); assert.strictEqual(tipos.normalizarPlataforma('Outro site'), 'outra');
  assert.strictEqual(tipos.normalizarPlataforma('MAGAZINE LUIZA'), 'magalu'); assert.strictEqual(tipos.normalizarPlataforma('xyz'), null);
});
t('preço "de" válido mostra desconto', () => { const r = val.validarOferta({ ...base, price_reference: '79,90', price_from: '129,90' }); assert.ok(r.ok); assert.strictEqual(r.dados.price_from, 129.9); assert.strictEqual(tipos.descontoPct(79.9, 129.9), 38); });
t('preço "de" menor ou igual é recusado', () => assert.ok(!val.validarOferta({ ...base, price_reference: '100', price_from: '90' }).ok));
t('preço "de" sem preço atual é recusado', () => assert.ok(!val.validarOferta({ ...base, price_from: '90' }).ok));
t('CSV novo: url_compra, preco, preco_de e plataforma por extenso', () => {
  const p = csv.validarCsv('nome,categoria,plataforma,url_compra,preco,preco_de\nFone,Música & Áudio,Mercado Livre,https://produto.mercadolivre.com.br/MLB-1,"79,90","129,90"\n');
  assert.strictEqual(p.validas, 1); assert.strictEqual(p.linhas[0].dados.external_platform, 'mercadolivre'); assert.strictEqual(p.linhas[0].dados.price_from, 129.9);
});
t('CSV antigo (url_produto) continua aceito', () => assert.strictEqual(csv.validarCsv(cab + 'A,Design,hotmart,https://pay.hotmart.com/a\n').validas, 1));
t('SQL gerado inclui price_from', () => { const p = csv.validarCsv('nome,categoria,plataforma,url_compra,preco,preco_de\nA,Design,shopee,https://shopee.com.br/a,"10","20"\n'); assert.ok(csv.gerarSqlImportacao([p.linhas[0].dados], false).includes('20.00')); });
t('chaves por plataforma e origem', () => {
  const m = mix.normalizarMix({ plataformasDesligadas: ['shopee', 'Shopee!', 7], mostrarOrigem: true });
  assert.deepStrictEqual(m.plataformasDesligadas, ['shopee']); assert.ok(m.mostrarOrigem);
  assert.ok(!mix.plataformaVisivel('shopee', m)); assert.ok(mix.plataformaVisivel('amazon', m));
  assert.ok(!mix.plataformaVisivel('amazon', { ...m, ativo: false }));
  assert.strictEqual(mix.MIX_PADRAO.mostrarOrigem, false);
});
t('puxar dados: Open Graph', () => {
  const d = pux.extrairDados('<html><head><meta property="og:title" content="Fone Bluetooth &amp; Case"><meta property="og:image" content="https://http2.mlstatic.com/a.jpg"><meta property="product:price:amount" content="79.9"><meta property="product:price:currency" content="BRL"></head></html>');
  assert.strictEqual(d.title, 'Fone Bluetooth & Case'); assert.strictEqual(d.image_url, 'https://http2.mlstatic.com/a.jpg'); assert.strictEqual(d.price_reference, '79,90'); assert.strictEqual(d.currency, 'BRL');
});
t('puxar dados: JSON-LD Product', () => {
  const d = pux.extrairDados('<title>x</title><script type="application/ld+json">{"@type":"Product","name":"Mouse","image":["https://img.exemplo.com/m.png"],"offers":{"price":"59.00","priceCurrency":"BRL"}}</script>');
  assert.strictEqual(d.image_url, 'https://img.exemplo.com/m.png'); assert.strictEqual(d.price_reference, '59,00');
});
t('puxar dados: ignora imagem não https', () => assert.strictEqual(pux.extrairDados('<meta property="og:image" content="http://x.com/a.jpg">').image_url, null));
t('puxar dados: bloqueia IP interno', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.ok(pux.ipPrivado(ip), ip);
  assert.ok(!pux.ipPrivado('8.8.8.8'));
});
console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
