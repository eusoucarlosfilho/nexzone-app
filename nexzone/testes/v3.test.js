// Testes V3 (sem banco e sem rede): eventos/privacidade, períodos, usuários, audiência e crescimento.
const assert = require('assert');
const ev = require('./.build/eventos.js');
const br = require('./.build/brasil.js');
const tp = require('./.build/admin/tempo.js');
const us = require('./.build/admin/usuarios.js');
const au = require('./.build/admin/audiencia-v3.js');

let ok = 0, fail = 0;
function t(nome, fn) { try { fn(); ok++; console.log('OK  ', nome); } catch (e) { fail++; console.log('FAIL', nome, '-', e.message); } }

// ---------- eventos e privacidade ----------
t('evento fora da lista é recusado', () => { assert.strictEqual(ev.eventoValido('cadastro_iniciado'), true); assert.strictEqual(ev.eventoValido('senha_digitada'), false); assert.strictEqual(ev.eventoValido('__proto__'), false); });
t('props: só chaves permitidas e enums válidos', () => {
  const p = ev.limparProps('cadastro_erro', { tipo: 'vendedor', codigo: 'senha_fraca', email: 'a@b.com', senha: '123' });
  assert.deepStrictEqual(p, { tipo: 'vendedor', codigo: 'senha_fraca' });
  assert.deepStrictEqual(ev.limparProps('cadastro_erro', { tipo: 'hacker', codigo: 'x' }), {});
});
t('busca: termo com e-mail ou CPF é descartado', () => {
  assert.deepStrictEqual(ev.limparProps('busca', { termo: 'fulano@gmail.com', resultados: 3 }), { resultados: 3 });
  assert.deepStrictEqual(ev.limparProps('busca', { termo: '123.456.789-09' }), {});
  assert.deepStrictEqual(ev.limparProps('busca', { termo: '  Planilha   Financeira ' }), { termo: 'planilha financeira' });
});
t('busca: termo longo é cortado em 40', () => assert.strictEqual(ev.limparProps('busca', { termo: 'a'.repeat(100) }).termo.length, 40));
t('resultados: número limitado', () => { assert.strictEqual(ev.limparProps('busca', { resultados: -1 }).resultados, undefined); assert.strictEqual(ev.limparProps('busca', { resultados: 99999 }).resultados, 10000); });
t('UTM: só as 4 chaves, limpas', () => {
  const u = ev.utmDe('?utm_source=Instagram&utm_medium=cpc&utm_campaign=Black%20Friday&utm_term=x&email=a@b.com&utm_content=fulano@x.com');
  assert.deepStrictEqual(u, { utm_source: 'instagram', utm_medium: 'cpc', utm_campaign: 'black friday' });
});
t('canal', () => {
  assert.strictEqual(ev.canalDe({ utm_medium: 'cpc' }, null), 'Pago');
  assert.strictEqual(ev.canalDe({}, 'google.com.br'), 'Busca orgânica');
  assert.strictEqual(ev.canalDe({}, 'l.instagram.com'), 'Social');
  assert.strictEqual(ev.canalDe({}, null), 'Direto');
  assert.strictEqual(ev.canalDe({ utm_source: 'parceiro' }, null), 'Campanha');
  assert.strictEqual(ev.canalDe({}, 'wa.me'), 'WhatsApp');
});
t('hostDe: só o domínio', () => { assert.strictEqual(ev.hostDe('https://www.facebook.com/x?fbclid=123'), 'facebook.com'); assert.strictEqual(ev.hostDe('lixo'), null); });
t('areaDe', () => {
  assert.strictEqual(ev.areaDe('/'), 'home'); assert.strictEqual(ev.areaDe('/produto/x'), 'produto'); assert.strictEqual(ev.areaDe('/login'), 'cadastro');
  assert.strictEqual(ev.areaDe('/checkout/abc'), 'checkout'); assert.strictEqual(ev.areaDe('/vender/produtos'), 'vendedor'); assert.strictEqual(ev.areaDe('/minhas-compras'), 'comprador');
  assert.strictEqual(ev.areaDe('/oferta/abc'), 'oferta'); assert.strictEqual(ev.areaDe('/categoria/design'), 'categoria');
});

// ---------- localização declarada ----------
t('UF e cidade', () => {
  assert.strictEqual(br.ufValida('sp'), 'SP'); assert.strictEqual(br.ufValida('XX'), null);
  assert.strictEqual(br.cidadeValida('São Paulo'), 'São Paulo'); assert.strictEqual(br.cidadeValida('Rua X 123'), null);
  assert.strictEqual(br.cidadeValida('a@b.com'), null); assert.strictEqual(br.cidadeValida("Pau-d'Arco"), "Pau-d'Arco");
  assert.strictEqual(br.UFS.length, 27);
});

// ---------- períodos ----------
const agora = new Date('2026-10-25T15:00:00Z'); // 12:00 em SP
t('intervalo hoje / ontem / 7d', () => {
  assert.strictEqual(tp.intervalo('hoje', null, null, agora).de.toISOString(), '2026-10-25T03:00:00.000Z');
  const o = tp.intervalo('ontem', null, null, agora); assert.strictEqual(o.de.toISOString(), '2026-10-24T03:00:00.000Z'); assert.strictEqual(o.ate.toISOString(), '2026-10-25T03:00:00.000Z');
  const s = tp.intervalo('7d', null, null, agora); assert.strictEqual(s.de.toISOString(), '2026-10-19T03:00:00.000Z'); assert.strictEqual(s.anteriorAte.getTime(), s.de.getTime());
});
t('intervalo personalizado e teto de 366 dias', () => {
  const c = tp.intervalo('custom', '2026-10-01', '2026-10-10', agora);
  assert.strictEqual(c.de.toISOString(), '2026-10-01T03:00:00.000Z'); assert.strictEqual(c.ate.toISOString(), '2026-10-11T03:00:00.000Z');
  const g = tp.intervalo('custom', '2020-01-01', '2026-10-10', agora); assert.ok((g.ate - g.de) / 86400000 <= 366);
  assert.strictEqual(tp.periodoValido("1' or '1"), '30d');
});
t('variação sem base anterior = null', () => { assert.strictEqual(tp.variacao(10, 0), null); assert.strictEqual(tp.variacao(15, 10), 50); });

// ---------- usuários ----------
const fontes = {
  authUsers: [
    { id: 'u1', email: 'a@x.com', created_at: '2026-10-25T13:00:00Z', last_sign_in_at: '2026-10-25T14:00:00Z', user_metadata: { uf: 'SP', cidade: 'Campinas', origem: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'lancamento' } }, app_metadata: { provider: 'email' } },
    { id: 'u2', email: 'b@x.com', created_at: '2026-10-20T13:00:00Z', user_metadata: {}, app_metadata: { provider: 'google' } },
    { id: 'u3', email: 'c@x.com', created_at: '2026-09-01T13:00:00Z', user_metadata: {} },
  ],
  perfis: [
    { id: 'u1', role: 'comprador', status: 'ativo', nome: 'Ana', created_at: '2026-10-25T13:00:00Z' },
    { id: 'u2', role: 'vendedor', status: 'restrito', nome: 'Beto', created_at: '2026-10-20T13:00:00Z' },
    { id: 'u3', role: 'admin', status: 'ativo', nome: 'Cid', created_at: '2026-09-01T13:00:00Z' },
  ],
  lojas: [{ id: 's2', owner: 'u2', nome: 'Loja B', slug: 'loja-b', status: 'pendente', created_at: '2026-10-21T10:00:00Z' }],
  produtos: [
    { store_id: 's2', status: 'ativo', created_at: '2026-10-22T10:00:00Z', publicado_em: null },
    { store_id: 's2', status: 'em_revisao', created_at: '2026-10-23T10:00:00Z', publicado_em: null },
  ],
  sessoesLogadas: [{ user_id: 'u2', city: 'Recife', region: 'PE', country: 'BR', last_seen: '2026-10-24T10:00:00Z' }],
  temPublicadoEm: true,
};
const linhas = us.montarLinhas(fontes);
t('linhas: tipos, origem e marcos', () => {
  const a = linhas.find((l) => l.id === 'u1'); const b = linhas.find((l) => l.id === 'u2'); const c = linhas.find((l) => l.id === 'u3');
  assert.strictEqual(a.tipo, 'comprador'); assert.strictEqual(b.tipo, 'vendedor'); assert.strictEqual(c.tipo, 'admin');
  assert.strictEqual(a.localizacaoFonte, 'declarada'); assert.strictEqual(a.uf, 'SP'); assert.strictEqual(a.origemCanal, 'Social'); assert.strictEqual(a.origemCampanha, 'lancamento');
  assert.strictEqual(b.localizacaoFonte, 'aproximada'); assert.strictEqual(b.uf, 'PE');
  assert.strictEqual(c.uf, null, 'sem dados não inventa localização'); assert.strictEqual(c.origemCanal, null);
  assert.strictEqual(b.produtosPublicados, 1); assert.strictEqual(b.produtosTotal, 2);
  assert.strictEqual(b.vendedorAtivadoFonte, 'loja'); assert.strictEqual(b.primeiraPublicacaoAproximada, true);
  assert.strictEqual(linhas[0].id, 'u1', 'mais recente primeiro');
});
t('filtros', () => {
  assert.deepStrictEqual(us.filtrar(linhas, { tipo: 'vendedores' }).map((l) => l.id), ['u2']);
  assert.deepStrictEqual(us.filtrar(linhas, { uf: 'SP' }).map((l) => l.id), ['u1']);
  assert.deepStrictEqual(us.filtrar(linhas, { cidade: 'campinas' }).map((l) => l.id), ['u1']);
  assert.deepStrictEqual(us.filtrar(linhas, { situacao: 'restrito' }).map((l) => l.id), ['u2']);
  assert.deepStrictEqual(us.filtrar(linhas, { produtos: 'com' }).map((l) => l.id), ['u2']);
  assert.deepStrictEqual(us.filtrar(linhas, { produtos: 'sem' }).map((l) => l.id), []);
  assert.deepStrictEqual(us.filtrar(linhas, { q: 'b@x' }).map((l) => l.id), ['u2']);
  assert.deepStrictEqual(us.filtrar(linhas, { canal: 'Sem registro' }).map((l) => l.id).sort(), ['u2', 'u3']);
  const iv = tp.intervalo('hoje', null, null, agora); assert.deepStrictEqual(us.filtrar(linhas, { de: iv.de, ate: iv.ate }).map((l) => l.id), ['u1']);
});
t('paginação no servidor limita 50 por página', () => {
  const muitos = Array.from({ length: 120 }, (_, i) => i);
  const p = us.paginar(muitos, 2, 500); assert.strictEqual(p.tamanho, 50); assert.strictEqual(p.itens[0], 50); assert.strictEqual(p.paginas, 3);
  assert.strictEqual(us.paginar(muitos, 99, 20).pagina, 6); assert.strictEqual(us.paginar([], 1, 20).total, 0);
});
t('grupos pequenos ficam ocultos (mínimo 3)', () => {
  const g = us.agruparMinimo([['SP', 5], ['RJ', 2], ['PE', 1]], 3);
  assert.deepStrictEqual(g.grupos, [{ chave: 'SP', valor: 5 }]); assert.strictEqual(g.ocultos, 3);
});
t('resumo: KPIs e funil do vendedor', () => {
  const j = { hoje: tp.inicioDoDia(0, agora), d7: tp.inicioDoDia(6, agora), d14: tp.inicioDoDia(13, agora), d30: tp.inicioDoDia(29, agora), d60: tp.inicioDoDia(59, agora), agora };
  const r = us.resumir(linhas, j);
  assert.strictEqual(r.kpis.total, 3); assert.strictEqual(r.kpis.hoje, 1); assert.strictEqual(r.kpis.d7, 2);
  assert.strictEqual(r.kpis.d7Variacao, null, 'sem base anterior não inventa %');
  assert.strictEqual(r.kpis.vendedores, 1); assert.strictEqual(r.kpis.vendedoresComProduto, 1);
  assert.strictEqual(r.porUf.grupos.length, 0, 'UF com menos de 3 pessoas não aparece');
  assert.strictEqual(r.funilVendedor[0].valor, 3); assert.strictEqual(r.funilVendedor[3].valor, 1);
  assert.strictEqual(r.serie.length, 30);
});

// ---------- audiência ----------
const de = tp.inicioDoDia(6, agora); const ate = new Date(agora.getTime() + 1); const anteriorDe = tp.inicioDoDia(13, agora);
const sess = (id, vid, started, extra = {}) => ({ id, visitor_id: vid, started_at: started, last_seen: started, device: 'mobile', landing_path: '/', region: 'SP', city: 'Campinas', country: 'BR', referrer: null, user_id: null, pageviews: 1, ...extra });
const dados = {
  de, ate, anteriorDe,
  sessoes: [
    sess('s1', 'v1', '2026-10-25T14:58:00Z', { landing_path: '/produto/11111111-1111-4111-8111-111111111111', utm_campaign: 'lancamento', utm_source: 'instagram', utm_medium: 'social' }),
    sess('s2', 'v2', '2026-10-24T10:00:00Z', { landing_path: '/login', device: 'desktop' }),
    sess('s3', 'v1', '2026-10-23T10:00:00Z'),
    sess('s0', 'v9', '2026-10-15T10:00:00Z'),
  ],
  pageviews: [
    { session_id: 's1', path: '/produto/11111111-1111-4111-8111-111111111111', created_at: '2026-10-25T14:58:00Z' },
    { session_id: 's1', path: '/checkout/11111111-1111-4111-8111-111111111111', created_at: '2026-10-25T14:59:00Z' },
    { session_id: 's2', path: '/login', created_at: '2026-10-24T10:00:00Z' },
    { session_id: 's3', path: '/', created_at: '2026-10-23T10:00:00Z' },
  ],
  eventos: null, cliquesExternos: null,
  usuarios: linhas, categoriaDoProduto: { '11111111-1111-4111-8111-111111111111': 'Design' },
  temUtm: true, cortes: { sessoes: false, pageviews: false, eventos: false },
};
t('audiência sem eventos: etapas dependentes ficam indisponíveis (null), K2 sempre null', () => {
  const r = au.calcularAudiencia(dados, agora);
  assert.strictEqual(r.indicadores.sessoes, 3); assert.strictEqual(r.indicadores.visitantesUnicos, 2);
  assert.strictEqual(r.indicadores.cliquesProdutos, null); assert.strictEqual(r.indicadores.buscas, null); assert.strictEqual(r.indicadores.cadastrosIniciados, null);
  assert.strictEqual(r.indicadores.acessosCheckout, 1); assert.strictEqual(r.indicadores.visitasCadastro, 1); assert.strictEqual(r.indicadores.ativos5min, 1);
  const compra = r.funil.find((e) => e.etapa === 'Compra confirmada'); assert.strictEqual(compra.valor, null);
  assert.strictEqual(r.funil.find((e) => e.etapa === 'Demonstrou interesse').valor, null);
  assert.strictEqual(r.abandono, null);
  assert.strictEqual(r.categorias[0].chave, 'Design');
  assert.strictEqual(r.trafego.campanhas[0].chave, 'lancamento');
});
t('audiência com eventos: abandono por etapa, dispositivo e erros', () => {
  const evs = [
    { session_id: 's2', nome: 'cadastro_aberto', props: { tipo: 'vendedor' }, device: 'desktop', created_at: '2026-10-24T10:00:00Z' },
    { session_id: 's2', nome: 'cadastro_iniciado', props: { tipo: 'vendedor' }, device: 'desktop', created_at: '2026-10-24T10:00:10Z' },
    { session_id: 's2', nome: 'cadastro_erro', props: { tipo: 'vendedor', codigo: 'senha_fraca' }, device: 'desktop', created_at: '2026-10-24T10:01:00Z' },
    { session_id: 's1', nome: 'produto_clique', props: { tipo: 'nativo' }, device: 'mobile', created_at: '2026-10-25T14:58:30Z' },
  ];
  const r = au.calcularAudiencia({ ...dados, eventos: evs }, agora);
  assert.strictEqual(r.indicadores.cliquesProdutos, 1); assert.strictEqual(r.indicadores.cadastrosIniciados, 1);
  assert.strictEqual(r.funil.find((e) => e.etapa === 'Demonstrou interesse').valor, 1);
  assert.strictEqual(r.abandono.interrompidos, 1); assert.strictEqual(r.abandono.erros[0].chave, 'senha_fraca');
  assert.strictEqual(r.abandono.porTipo[0].chave, 'vendedor');
});
t('ao vivo: só contagens, janela de 5 minutos', () => {
  const r = au.calcularAoVivo(dados.sessoes.map((s) => ({ ...s, current_path: s.landing_path })), dados.categoriaDoProduto, agora);
  assert.strictEqual(r.ativos, 1); assert.strictEqual(r.emProdutos, 1); assert.strictEqual(r.categorias[0].chave, 'Design');
  assert.ok(!('sessoes' in r), 'não devolve sessões individuais');
});
t('crescimento: insights só com amostra suficiente', () => {
  const r = au.calcularCrescimento(dados, [{ store_id: 's2', quando: '2026-10-22T10:00:00Z', aproximado: true }], agora);
  assert.strictEqual(r.insights.length, 0);
  assert.strictEqual(r.atual.vendedoresQuePublicaram, 1); assert.strictEqual(r.publicacoesAproximadas, true);
  assert.strictEqual(r.atual.cliquesCompra, null);
});
t('crescimento: insight de queda de cadastros com base suficiente', () => {
  const muitos = [];
  for (let i = 0; i < 10; i++) muitos.push({ ...linhas[0], id: 'n' + i, criadoEm: '2026-10-24T10:00:00Z' });
  for (let i = 0; i < 25; i++) muitos.push({ ...linhas[0], id: 'o' + i, criadoEm: '2026-10-15T10:00:00Z' });
  const r = au.calcularCrescimento({ ...dados, usuarios: muitos }, [], agora);
  assert.ok(r.insights.some((x) => x.texto.includes('caíram')));
});

console.log(`\n${ok} passaram, ${fail} falharam`);
if (fail) process.exit(1);
