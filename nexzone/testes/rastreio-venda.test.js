// Sprint 1 — pixels, página de obrigado, origem das vendas e checkout sem login (src/lib/rastreioVenda.ts)
const assert = require('assert');
const r = require('./.build/rastreioVenda.js');
const c = require('./.build/checkoutConfig.js');
let ok = 0, fail = 0; const t = (n, fn) => { try { fn(); ok++; console.log('OK  ', n); } catch (x) { fail++; console.log('FAIL', n, '-', x.message); } };
t('pixels válidos passam', () => assert.deepStrictEqual(r.normalizarRastreio({ meta: '1234567890123456', tiktok: 'c4a1b2c3d4e5f6g7h8i9', ga4: 'g-abc123', adsId: 'AW-123456789', adsLabel: 'AbC_d-12', obrigadoUrl: 'https://x.com/obrigado' }),
  { meta: '1234567890123456', tiktok: 'C4A1B2C3D4E5F6G7H8I9', ga4: 'G-ABC123', adsId: 'AW-123456789', adsLabel: 'AbC_d-12', obrigadoUrl: 'https://x.com/obrigado' }));
t('script no lugar do pixel é descartado', () => { const n = r.normalizarRastreio({ meta: '123</script><script>alert(1)', tiktok: "x');alert(1)//" }); assert.strictEqual(n.meta, ''); assert.strictEqual(n.tiktok, ''); });
t('página de obrigado: só https', () => { assert.strictEqual(r.urlObrigadoValida('http://x.com'), false); assert.strictEqual(r.urlObrigadoValida('javascript:alert(1)'), false); assert.strictEqual(r.urlObrigadoValida('https://user:pw@x.com'), false); assert.strictEqual(r.urlObrigadoValida('https://x.com/a?b=1'), true); });
t('validação com mensagem clara', () => { assert.ok(/Meta/.test(r.validarRastreio({ meta: 'abc' }))); assert.ok(/https/.test(r.validarRastreio({ obrigadoUrl: 'x.com' }))); assert.strictEqual(r.validarRastreio({ meta: '1234567890' }), null); });
t('rótulo do Google Ads sem ID é recusado', () => assert.ok(r.validarRastreio({ adsLabel: 'abcd' })));
t('rastreio entra na config do checkout e sobrevive à normalização', () => {
  const cfg = c.normalizarCheckout({ versao: 2, blocos: [], rastreio: { meta: '1234567890', obrigadoUrl: 'https://a.com/ok' } });
  assert.strictEqual(cfg.rastreio.meta, '1234567890'); assert.strictEqual(cfg.rastreio.obrigadoUrl, 'https://a.com/ok');
  assert.deepStrictEqual(c.configPadrao().rastreio, r.RASTREIO_VAZIO);
});
t('validarCheckout recusa pixel inválido', () => assert.strictEqual(c.validarCheckout({ versao: 2, blocos: [], rastreio: { ga4: 'UA-1' } }, () => true).ok, false));
t('origem: só chaves conhecidas, sem HTML', () => assert.deepStrictEqual(r.limparOrigem({ utm_source: 'facebook', utm_campaign: 'bf<script>', hack: 'x', ref: 'Instagram.com' }), { utm_source: 'facebook', utm_campaign: 'bfscript', ref: 'instagram.com' }));
t('origem vazia vira null', () => assert.strictEqual(r.limparOrigem({ x: 1 }), null));
t('cliques: fbp/fbc no formato do Meta; lixo descartado', () => {
  assert.deepStrictEqual(r.limparCliques({ fbp: 'fb.1.1700000000000.123456789', fbc: 'fb.1.1700000000000.IwAR0abcdefghijk', gclid: 'Cj0KCQ-abc_123', ttclid: '<x>' }),
    { fbp: 'fb.1.1700000000000.123456789', fbc: 'fb.1.1700000000000.IwAR0abcdefghijk', gclid: 'Cj0KCQ-abc_123' });
});
t('rótulo de origem para relatório', () => { assert.strictEqual(r.rotuloOrigem(null).fonte, 'Direto / sem rastreio'); assert.deepStrictEqual(r.rotuloOrigem({ utm_source: 'tiktok', utm_campaign: 'bf', sck: 'v1' }), { fonte: 'tiktok', campanha: 'bf', conteudo: 'v1' }); });
t('nome e e-mail do comprador', () => { assert.strictEqual(r.nomeValido('Ana'), false); assert.strictEqual(r.nomeValido('Ana Souza'), true); assert.strictEqual(r.emailValido('ana@x.com.br'), true); assert.strictEqual(r.emailValido('ana@x'), false); });
console.log(`\n${ok} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
