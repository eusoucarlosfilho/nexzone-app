// Sprint 2 — API de Conversões, TikTok Events API e postback (src/lib/integracoes.ts)
const assert = require('assert');
const crypto = require('crypto');
const i = require('./.build/integracoes.js');
let ok = 0, fail = 0; const t = (n, fn) => { try { fn(); ok++; console.log('OK  ', n); } catch (x) { fail++; console.log('FAIL', n, '-', x.message); } };
const d = {
  evento: 'compra', pedidoId: 'abc-123', status: 'entregue', total: 97.5, criadoEm: '2026-10-27T10:00:00Z', pagoEm: '2026-10-27T10:05:00Z',
  produto: { id: 'p1', titulo: 'Curso X' }, bumps: [{ product_id: 'p2', titulo: 'Bump', valor: 19.9 }],
  comprador: { id: 'u1', nome: 'Ana Maria Souza', email: ' Ana@Email.com ', whatsapp: '5511999998888' },
  origem: { utm_source: 'facebook' }, cliques: { fbp: 'fb.1.1700000000000.123', fbc: 'fb.1.1700000000000.abc', ttclid: 'tt123456789' },
  ip: '200.1.2.3', userAgent: 'Mozilla', urlPagina: 'https://www.compreibarato.com.br/checkout/p1',
};
const h = (s) => crypto.createHash('sha256').update(s).digest('hex');
t('Meta: e-mail normalizado e com hash', () => assert.deepStrictEqual(i.eventoMeta(d).data[0].user_data.em, [h('ana@email.com')]));
t('Meta: telefone só dígitos com hash; nome e sobrenome', () => { const u = i.eventoMeta(d).data[0].user_data; assert.deepStrictEqual(u.ph, [h('5511999998888')]); assert.deepStrictEqual(u.fn, [h('ana')]); assert.deepStrictEqual(u.ln, [h('souza')]); });
t('Meta: mesmo event_id do pixel do navegador (sem contar em dobro)', () => assert.strictEqual(i.eventoMeta(d).data[0].event_id, 'Purchase-abc-123'));
t('Meta: valor, moeda, itens e fbp/fbc/IP', () => { const e = i.eventoMeta(d).data[0]; assert.strictEqual(e.custom_data.value, 97.5); assert.strictEqual(e.custom_data.currency, 'BRL'); assert.deepStrictEqual(e.custom_data.content_ids, ['p1', 'p2']); assert.strictEqual(e.user_data.fbp, d.cliques.fbp); assert.strictEqual(e.user_data.client_ip_address, '200.1.2.3'); assert.strictEqual(e.event_time, 1793095500); });
t('Meta: código de teste só quando informado', () => { assert.strictEqual(i.eventoMeta(d).test_event_code, undefined); assert.strictEqual(i.eventoMeta(d, 'TEST1').test_event_code, 'TEST1'); });
t('TikTok: CompletePayment com hash e ttclid', () => { const e = i.eventoTikTok(d, 'C4X'); assert.strictEqual(e.event_source_id, 'C4X'); assert.strictEqual(e.data[0].event, 'CompletePayment'); assert.strictEqual(e.data[0].user.email, h('ana@email.com')); assert.strictEqual(e.data[0].user.phone, h('+5511999998888')); assert.strictEqual(e.data[0].user.ttclid, 'tt123456789'); assert.strictEqual(e.data[0].event_id, 'Purchase-abc-123'); });
t('Postback: evento e dados do comprador', () => { const c = i.corpoPostback(d); assert.strictEqual(c.evento, 'venda_aprovada'); assert.strictEqual(c.comprador.email, ' Ana@Email.com '); assert.strictEqual(c.itens_extras.length, 1); assert.strictEqual(c.pedido.total, 97.5); });
t('Postback: assinatura HMAC confere', () => { const corpo = '{"a":1}'; assert.strictEqual(i.assinarPostback('seg', corpo), 'sha256=' + crypto.createHmac('sha256', 'seg').update(corpo).digest('hex')); });
t('Postback: segredo novo é longo e aleatório', () => { const a = i.novoSegredo(), b = i.novoSegredo(); assert.ok(a.startsWith('cbps_') && a.length > 30 && a !== b); });
t('URL do postback: só https com domínio público', () => {
  assert.strictEqual(i.urlPostbackValida('https://hooks.zapier.com/x').ok, true);
  for (const u of ['http://x.com', 'https://127.0.0.1/a', 'https://localhost/a', 'https://user:pw@x.com', 'https://x.com:22/a', 'https://www.compreibarato.com.br/api', 'ftp://x.com']) assert.strictEqual(i.urlPostbackValida(u).ok, false, u);
});
t('Tentativas: 1, 5, 30, 120, 720 min e depois desiste', () => { assert.strictEqual(i.proximaTentativa(1), 60000); assert.strictEqual(i.proximaTentativa(5), 720 * 60000); assert.strictEqual(i.proximaTentativa(6), null); });
t('Máscara do token', () => { assert.strictEqual(i.mascarar('EAAabcdef1234'), '••••1234'); assert.strictEqual(i.mascarar(''), ''); });
console.log(`\n${ok} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
