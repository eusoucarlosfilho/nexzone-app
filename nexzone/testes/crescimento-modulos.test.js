// Inteligência Comercial, Ofertas do dia, Divulgação do vendedor e Indicação (funções puras).
const assert = require('assert');
const bi = require('./.build/inteligencia.js');
const od = require('./.build/ofertasDia.js');
const ind = require('./.build/indicacao.js');
const ev = require('./.build/eventos.js');
const rv = require('./.build/rastreioVenda.js');
let ok = 0, fail = 0;
const t = (n, f) => { try { f(); ok++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };

const P1 = '11111111-1111-4111-8111-111111111111', P2 = '22222222-2222-4222-8222-222222222222';
const S = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const T0 = Date.parse('2026-10-20T03:00:00Z'), T1 = T0 + 7 * 86400000;
const iso = (h) => new Date(T0 + h * 3600000).toISOString();

// ---------- origem ----------
t('fonte: meta pago, google, whatsapp, direto, indicação, vendedor', () => {
  assert.strictEqual(bi.fonteDe({ utm_source: 'meta', utm_medium: 'paid' }), 'Meta Ads');
  assert.strictEqual(bi.fonteDe({ utm_source: 'facebook', utm_medium: 'cpc' }), 'Meta Ads');
  assert.strictEqual(bi.fonteDe({ utm_source: 'instagram', utm_medium: 'stories' }), 'Instagram');
  assert.strictEqual(bi.fonteDe({ referrer: 'https://l.instagram.com/' }), 'Instagram');
  assert.strictEqual(bi.fonteDe({ referrer: 'https://m.facebook.com/' }), 'Facebook');
  assert.strictEqual(bi.fonteDe({ referrer: 'https://www.google.com/' }), 'Google');
  assert.strictEqual(bi.fonteDe({ utm_source: 'google', utm_medium: 'cpc' }), 'Google Ads');
  assert.strictEqual(bi.fonteDe({ utm_source: 'whatsapp' }), 'WhatsApp');
  assert.strictEqual(bi.fonteDe({}), 'Direto');
  assert.strictEqual(bi.fonteDe(null), 'Direto');
  assert.strictEqual(bi.fonteDe({ utm_source: 'indicacao', utm_content: 'abcdefgh' }), 'Indicação');
  assert.strictEqual(bi.fonteDe({ utm_source: 'vendedor', utm_medium: 'whatsapp' }), 'Link de vendedor');
  assert.strictEqual(bi.fonteDe({ referrer: 'https://blog.qualquer.com.br/' }), 'Outras');
});

// ---------- relatório ----------
const sessoes = [
  { id: S(1), visitor_id: 'v1', started_at: iso(1), landing_path: `/produto/${P1}`, referrer: null, utm_source: 'meta', utm_medium: 'paid' },
  { id: S(2), visitor_id: 'v1', started_at: iso(30), landing_path: '/', referrer: null },
  { id: S(3), visitor_id: 'v2', started_at: iso(2), landing_path: `/produto/${P2}`, referrer: null, utm_source: 'vendedor', utm_medium: 'whatsapp', utm_content: 'loja-a' },
  { id: S(4), visitor_id: 'v3', started_at: new Date(T1 + 3600000).toISOString(), landing_path: '/', referrer: null }, // fora do período
];
const pageviews = [
  { session_id: S(1), path: `/produto/${P1}`, created_at: iso(1) },
  { session_id: S(1), path: `/checkout/${P1}`, created_at: iso(1.1) },
  { session_id: S(3), path: `/produto/${P2}`, created_at: iso(2) },
  { session_id: S(2), path: '/', created_at: iso(30) },
];
const eventos = [{ session_id: S(1), nome: 'compra_clique', props: {}, path: `/produto/${P1}`, created_at: iso(1.05) }];
const pedidos = [
  { id: 'o1', status: 'entregue', total: 50, created_at: iso(1.2), product_id: P1, store_id: 'L1', origem: { utm_source: 'meta', sid: S(1) } },
  { id: 'o2', status: 'pendente', total: 30, created_at: iso(2.5), product_id: P2, store_id: 'L2', origem: { sid: S(3) } },
  { id: 'o3', status: 'entregue', total: 20, created_at: iso(40), product_id: P2, store_id: 'L2', origem: null }, // sem sessão
  { id: 'o4', status: 'reembolsado', total: 99, created_at: iso(50), product_id: P1, store_id: 'L1', origem: null },
];
const produtos = [{ id: P1, titulo: 'Curso A', store_id: 'L1', categoria: 'cursos', status: 'ativo' }, { id: P2, titulo: 'Serviço B', store_id: 'L2', categoria: 'servicos', status: 'ativo' }];
const lojas = [{ id: 'L1', nome: 'Loja 1', slug: 'loja-1' }, { id: 'L2', nome: 'Loja A', slug: 'loja-a' }];
const r = bi.calcularInteligencia({ de: T0, ate: T1, sessoes, pageviews, eventos, pedidos, produtos, lojas });

t('visão geral: só o período, compras = pago/entregue', () => {
  assert.strictEqual(r.geral.sessoes, 3);
  assert.strictEqual(r.geral.visitantes, 2);
  assert.strictEqual(r.geral.pedidosCriados, 4);
  assert.strictEqual(r.geral.comprasAprovadas, 2);
  assert.strictEqual(r.geral.receita, 70);
  assert.strictEqual(r.geral.ticketMedio, 35);
  assert.strictEqual(r.geral.reembolsados, 1);
  assert.strictEqual(r.geral.cliquesComprar, 1);
});
t('funil em sessões, compra ligada pelo sid', () => {
  assert.deepStrictEqual(r.funil.map((x) => x.valor), [3, 2, 1, 1, 1]);
  assert.strictEqual(r.comprasSemSessao, 1);
  assert.strictEqual(r.geral.conversao, 33.3);
});
t('origem: compra ligada vai para a fonte da sessão; sem sessão usa o pedido', () => {
  const meta = r.origens.find((o) => o.fonte === 'Meta Ads');
  assert.strictEqual(meta.sessoes, 1); assert.strictEqual(meta.compras, 1); assert.strictEqual(meta.receita, 50);
  const direto = r.origens.find((o) => o.fonte === 'Direto');
  assert.strictEqual(direto.compras, 1); // o3 sem origem
});
t('ranking de produtos e vendedores', () => {
  const a = r.produtos.find((x) => x.id === P1);
  assert.strictEqual(a.views, 1); assert.strictEqual(a.checkouts, 1); assert.strictEqual(a.compras, 1); assert.strictEqual(a.cliques, 1); assert.strictEqual(a.loja, 'Loja 1');
  const l2 = r.vendedores.find((x) => x.storeId === 'L2');
  assert.strictEqual(l2.visitasLinks, 1); assert.strictEqual(l2.compras, 1);
});
t('sem eventos de funil: etapa de clique fica indisponível (não zero)', () => {
  const r2 = bi.calcularInteligencia({ de: T0, ate: T1, sessoes, pageviews, eventos: null, pedidos, produtos, lojas });
  assert.strictEqual(r2.funil[2].valor, null); assert.strictEqual(r2.geral.cliquesComprar, null);
  assert.strictEqual(r2.funil[3].deAnterior, 50); // checkout comparado com "viu produto"
});

// ---------- divulgação ----------
t('link rastreável só com UTM', () => {
  const l = bi.linkDivulgacao('https://www.compreibarato.com.br/', P1, 'Loja-A', 'whatsapp');
  assert.strictEqual(l, `https://www.compreibarato.com.br/produto/${P1}?utm_source=vendedor&utm_medium=whatsapp&utm_campaign=divulgacao&utm_content=loja-a`);
});
t('textos usam só dados reais (sem desconto inventado, nota só com 3+ avaliações)', () => {
  const links = { whatsapp: 'W', instagram: 'I', facebook: 'F', stories: 'S', outro: 'O' };
  const a = bi.textosDivulgacao({ titulo: 'Curso X', preco: 100, precoPromo: null, loja: 'Loja', nota: 5, avaliacoes: 2 }, links);
  assert.ok(!/de R\$/.test(a.whatsapp) && !/Nota/.test(a.whatsapp) && a.whatsapp.includes('R$ 100,00') && a.whatsapp.endsWith('W'));
  const b = bi.textosDivulgacao({ titulo: 'Curso X', preco: 100, precoPromo: 80, loja: 'Loja', nota: 4.8, avaliacoes: 12 }, links);
  assert.ok(b.instagram.includes('de R$ 100,00 por R$ 80,00') && b.facebook.includes('Nota 4,8 de 5 em 12 avaliações'));
  const c = bi.textosDivulgacao({ titulo: 'Curso X', preco: 100, precoPromo: 120, loja: 'Loja' }, links);
  assert.ok(!/de R\$/.test(c.whatsapp)); // promo maior que o preço não vira desconto
});
t('métricas do vendedor: só compras de produtos DELE vindas do link DELE', () => {
  const m = bi.metricasDivulgacao('loja-a', sessoes, [
    { id: 'x1', status: 'entregue', total: 30, created_at: iso(3), product_id: P2, store_id: 'L2', origem: { sid: S(3) } },
    { id: 'x2', status: 'entregue', total: 50, created_at: iso(3), product_id: P1, store_id: 'L1', origem: { sid: S(3) } }, // produto de outra loja
    { id: 'x3', status: 'pendente', total: 30, created_at: iso(3), product_id: P2, store_id: 'L2', origem: { sid: S(3) } },
  ], new Set([P2]));
  assert.strictEqual(m.cliques, 1); assert.strictEqual(m.visitantes, 1); assert.strictEqual(m.compras, 1); assert.strictEqual(m.receita, 30);
  assert.strictEqual(m.canais[0].canal, 'whatsapp'); assert.strictEqual(m.canais[0].compras, 1);
});

// ---------- ofertas do dia ----------
t('normaliza: ids válidos, sem repetição, máx entre 3 e 8, fim antes do início é ignorado', () => {
  const c = od.normalizarOfertasDia({ ativo: true, max: 20, itens: [{ id: P1 }, { id: P1 }, { id: 'x' }, { id: P2, inicio: '2026-10-21T10:00:00Z', fim: '2026-10-21T09:00:00Z' }] });
  assert.strictEqual(c.itens.length, 2); assert.strictEqual(c.max, 8); assert.strictEqual(c.itens[1].fim, null);
  assert.strictEqual(od.normalizarOfertasDia('lixo').ativo, false);
});
t('itens no ar respeitam agenda, ordem e máximo', () => {
  const c = od.normalizarOfertasDia({ ativo: true, max: 3, itens: [
    { id: P1, fim: iso(10) }, { id: P2, inicio: iso(5) },
    { id: S(7), inicio: null }, { id: S(8) }, { id: S(9) },
  ] });
  assert.deepStrictEqual(od.itensNoAr(c, T0 + 3600000).map((i) => i.id), [P1, S(7), S(8)]);
  assert.deepStrictEqual(od.itensNoAr(c, T0 + 11 * 3600000).map((i) => i.id), [P2, S(7), S(8)]);
  assert.deepStrictEqual(od.itensNoAr({ ...c, ativo: false }, T0), []);
});
t('contador só com prazo real (definido, futuro, até 7 dias)', () => {
  assert.strictEqual(od.mostrarContador(null, T0), null);
  assert.strictEqual(od.mostrarContador(iso(5), T0), T0 + 5 * 3600000);
  assert.strictEqual(od.mostrarContador(iso(-1), T0), null);
  assert.strictEqual(od.mostrarContador(iso(24 * 8), T0), null);
});
t('desconto real só com promo menor', () => { assert.strictEqual(od.descontoReal(100, 80), 20); assert.strictEqual(od.descontoReal(100, 100), null); assert.strictEqual(od.descontoReal(100, null), null); });
t('desempenho: compra conta só com clique antes, mesma sessão, até 24 h', () => {
  const evs = [
    { session_id: S(1), nome: 'oferta_dia_vista', props: {}, created_at: iso(0) },
    { session_id: S(2), nome: 'oferta_dia_vista', props: {}, created_at: iso(0) },
    { session_id: S(1), nome: 'oferta_dia_clique', props: { produto: P1, posicao: 1 }, created_at: iso(1) },
  ];
  const peds = [
    { status: 'entregue', total: 40, created_at: iso(2), product_id: P1, origem: { sid: S(1) } },
    { status: 'entregue', total: 40, created_at: iso(30), product_id: P1, origem: { sid: S(1) } }, // depois de 24 h
    { status: 'entregue', total: 40, created_at: iso(2), product_id: P1, origem: { sid: S(2) } },  // sem clique
  ];
  const d = od.desempenhoOfertas([P1, P2], evs, peds);
  assert.strictEqual(d.vistas, 2); assert.strictEqual(d.ctr, 50);
  assert.deepStrictEqual(d.linhas[0], { id: P1, cliques: 1, compras: 1, receita: 40, conversao: 100 });
  assert.strictEqual(d.linhas[1].cliques, 0);
});

// ---------- indicação ----------
const cfgOn = ind.normalizarCfgIndicacao({ ativo: true, pontos: 500, minimo: 20, prazoDias: 7, limitePorUsuario: 2 });
t('padrão: desligado e 0 pontos; ligado sem pontos não vale', () => {
  assert.strictEqual(ind.INDICACAO_PADRAO.ativo, false); assert.strictEqual(ind.INDICACAO_PADRAO.pontos, 0);
  assert.strictEqual(ind.programaNoAr(ind.normalizarCfgIndicacao({ ativo: true, pontos: 0 })), false);
  assert.strictEqual(ind.programaNoAr(cfgOn), true);
  assert.strictEqual(ind.programaNoAr({ ...cfgOn, fim: iso(-1) }, T0), false);
});
t('código: 8 caracteres, sem 0/O/1/I e sem 3 dígitos seguidos (sobrevive à limpeza do rastreador)', () => {
  let seq = 0; const r = () => ((seq++ * 7) % 32) / 32;
  for (let i = 0; i < 300; i++) { const c = ind.gerarCodigo(Math.random); assert.ok(ind.CODIGO.test(c) && !/[01OI]/.test(c) && !/\d{3}/.test(c), c); assert.ok(ev.limparTexto(c.toLowerCase(), 80) === c.toLowerCase(), c); }
  assert.ok(ind.CODIGO.test(ind.gerarCodigo(r)));
});
t('vínculo: bloqueia autoindicação, conta antiga, já comprador, código bloqueado, programa desligado', () => {
  const base = { cfg: cfgOn, agora: T0, indicadorId: 'A', indicadoId: 'B', contaCriadaEm: iso(-1), codigoBloqueado: false, jaTemCompraPaga: false, jaIndicado: false };
  assert.deepStrictEqual(ind.podeVincular(base), { ok: true });
  assert.strictEqual(ind.podeVincular({ ...base, indicadoId: 'A' }).motivo, 'autoindicação');
  assert.strictEqual(ind.podeVincular({ ...base, contaCriadaEm: iso(-100) }).motivo, 'conta antiga');
  assert.strictEqual(ind.podeVincular({ ...base, jaTemCompraPaga: true }).motivo, 'já era comprador');
  assert.strictEqual(ind.podeVincular({ ...base, codigoBloqueado: true }).motivo, 'código bloqueado');
  assert.strictEqual(ind.podeVincular({ ...base, indicadorId: null }).motivo, 'código inexistente');
  assert.strictEqual(ind.podeVincular({ ...base, cfg: { ...cfgOn, ativo: false } }).motivo, 'programa fora do ar');
});
t('conversão: 1ª compra acima do mínimo, dentro do limite; loja de quem indicou vai para análise', () => {
  // comissão R$ 50 × 30% = R$ 15 = 1500 pontos de teto → vale o fixo (500)
  const base = { cfg: cfgOn, agora: T0, pontosPorReal: 100, pedido: { total: 50, product_id: P1, dono_loja: 'X', comissao: 50 }, indicadorId: 'A', indicadoId: 'B', comprasPagasDoIndicado: 1, recompensasDoIndicador: 0 };
  const ok = ind.avaliarConversao(base);
  assert.strictEqual(ok.ok, true); assert.strictEqual(ok.pontos, 500); assert.strictEqual(ok.liberaEm, new Date(T0 + 7 * 86400000).toISOString());
  assert.strictEqual(ind.avaliarConversao({ ...base, comprasPagasDoIndicado: 2 }).status, 'cancelada');
  assert.strictEqual(ind.avaliarConversao({ ...base, pedido: { ...base.pedido, total: 10 } }).status, 'cancelada');
  assert.strictEqual(ind.avaliarConversao({ ...base, recompensasDoIndicador: 2 }).status, 'cancelada');
  assert.strictEqual(ind.avaliarConversao({ ...base, pedido: { ...base.pedido, dono_loja: 'A' } }).status, 'bloqueada');
  const lista = { ...cfgOn, produtos: 'lista', produtosIds: [P2] };
  assert.strictEqual(ind.avaliarConversao({ ...base, cfg: lista }).status, 'cancelada');
});

// ---------- eventos e origem do pedido ----------
t('eventos novos aceitam id de produto e posição', () => {
  assert.deepStrictEqual(ev.limparProps('oferta_dia_clique', { produto: P1.toUpperCase(), posicao: 2, extra: 'x' }), { produto: P1, posicao: 2 });
  assert.deepStrictEqual(ev.limparProps('oferta_dia_clique', { produto: 'nao-e-uuid', posicao: 99 }), {});
  assert.deepStrictEqual(ev.limparProps('divulgar_copia', { canal: 'whatsapp' }), { canal: 'whatsapp' });
  assert.deepStrictEqual(ev.limparProps('divulgar_copia', { canal: 'hack' }), {});
});
t('origem do pedido guarda sid/vid válidos e não conta como "origem de marketing"', () => {
  const o = rv.limparOrigem({ sid: S(1).toUpperCase(), vid: 'nao', utm_x: 'y' });
  assert.deepStrictEqual(o, { sid: S(1) });
  assert.strictEqual(rv.temOrigemMarketing(o), false);
  assert.strictEqual(rv.rotuloOrigem(o).fonte, 'Direto / sem rastreio');
  assert.strictEqual(rv.temOrigemMarketing(rv.limparOrigem({ utm_source: 'meta', sid: S(1) })), true);
});

t('margem: recompensa = menor entre o fixo e o teto da comissão; comissão pequena não paga', () => {
  assert.strictEqual(ind.pontosDaIndicacao(cfgOn, 2, 100), 60);    // comissão R$ 2 × 30% = R$ 0,60 = 60 pontos (fixo era 500)
  assert.strictEqual(ind.pontosDaIndicacao(cfgOn, 100, 100), 500); // teto 3000 > fixo 500
  assert.strictEqual(ind.pontosDaIndicacao(cfgOn, 0, 100), 0);
  assert.strictEqual(ind.pontosDaIndicacao({ ...cfgOn, tetoComissaoPct: 0 }, 100, 100), 0);
  const base = { cfg: cfgOn, agora: T0, pontosPorReal: 100, pedido: { total: 25, product_id: P1, dono_loja: null, comissao: 0.02 }, indicadorId: 'A', indicadoId: 'B', comprasPagasDoIndicado: 1, recompensasDoIndicador: 0 };
  const r = ind.avaliarConversao(base);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.status, 'cancelada');
  const r2 = ind.avaliarConversao({ ...base, pedido: { ...base.pedido, comissao: 2.5 } });
  assert.strictEqual(r2.ok, true); assert.strictEqual(r2.pontos, 75);
});
t('orçamento do mês: sem orçamento o programa não roda; liberação que estoura fica para o mês seguinte', () => {
  assert.strictEqual(ind.programaNoAr({ ...cfgOn, orcamentoMensal: 0 }), false);
  assert.strictEqual(ind.INDICACAO_PADRAO.orcamentoMensal, 300); assert.strictEqual(ind.INDICACAO_PADRAO.tetoComissaoPct, 30);
  const c = { ...cfgOn, orcamentoMensal: 10 };
  assert.strictEqual(ind.cabeNoOrcamento(c, 5, 500, 100), true);   // 5 + 5 = 10
  assert.strictEqual(ind.cabeNoOrcamento(c, 5.01, 500, 100), false);
  assert.strictEqual(ind.reaisDosPontos(750, 100), 7.5);
  const m = ind.mesBR(Date.parse('2026-10-31T23:30:00-03:00'));
  assert.strictEqual(new Date(m.ini).toISOString(), '2026-10-01T03:00:00.000Z');
  assert.strictEqual(new Date(m.prox).toISOString(), '2026-11-01T03:00:00.000Z');
});

console.log(`\nCrescimento (4 módulos): ${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
