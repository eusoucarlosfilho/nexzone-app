// Sequência do Pix no WhatsApp: modelos, chaves de registro e QR Code.
const assert = require('assert');
const ev = require('./.build/whatsapp/eventos.js');
const { qrPixPng } = require('./.build/whatsapp/qrPix.js');
const fila = require('./.build/filaRecuperacao.js');
let ok = 0, fail = 0;
const t = async (n, f) => { try { await f(); ok++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const PIX = '00020101021226850014br.gov.bcb.pix2563qrcodepix.exemplo.com.br/v2/cobv/9d36b84fc70b478fb95c12729b90ca25520400005303986540510.005802BR5905TESTE6008BRASILIA62070503***6304  AB';

(async () => {
  await t('eventos novos existem e ligam sozinhos', () => { for (const k of ['pix_gerado', 'pix_codigo_aviso', 'pix_codigo', 'aviso_numero', 'pix_lembrete', 'compra_aprovada']) assert.ok(ev.CHAVES_EVENTOS.includes(k), k); });
  await t('aviso diz que o número é só de notificações e manda para o site', () => { const e = ev.acharEvento('aviso_numero'); assert.ok(/apenas notificações/.test(e.padrao) && /site/.test(e.padrao) && e.padrao.includes('{link}')); });
  await t('aviso do código fala em copia e cola', () => assert.ok(/copia e cola/i.test(ev.acharEvento('pix_codigo_aviso').padrao)));
  await t('confirmação fala em chat com o vendedor', () => assert.ok(/chat do pedido/.test(ev.acharEvento('compra_aprovada').padrao) && /vendedor/.test(ev.acharEvento('compra_aprovada').padrao)));
  await t('lembrete diz que a confirmação é automática', () => assert.ok(/automática/.test(ev.acharEvento('pix_lembrete').padrao)));
  await t('nada de jogo nos modelos', () => { for (const e of ev.EVENTOS) assert.ok(!/🎮|gamer/i.test(e.padrao), e.chave); });
  await t('código Pix longo não é cortado', () => { const longo = PIX + 'x'.repeat(150); assert.strictEqual(ev.montarTexto('{pix}', { pix: longo }), longo.replace(/[ \t]{2,}/g, ' ')); });
  await t('chave de cada passo mantém o id do pedido depois do 1º ":"', () => {
    assert.strictEqual(ev.chavePasso('pix_gerado:abc-123', 0), 'pix_gerado.1:abc-123');
    assert.strictEqual(ev.chavePasso('pix_lembrete:abc-123', 3), 'pix_lembrete.4:abc-123');
    assert.strictEqual(fila.idDaChave(ev.chavePasso('pix_gerado:abc-123', 0)), 'abc-123');
  });
  await t('QR Code vira PNG em base64 puro', async () => {
    const b = await qrPixPng(PIX);
    assert.ok(b && !b.startsWith('data:'));
    const buf = Buffer.from(b, 'base64');
    assert.strictEqual(buf.slice(1, 4).toString(), 'PNG');
    assert.ok(buf.length > 1000);
  });
  await t('QR Code vazio ou gigante = null', async () => { assert.strictEqual(await qrPixPng(''), null); assert.strictEqual(await qrPixPng('x'.repeat(2000)), null); });
  console.log(`\nWhatsApp Pix: ${ok} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})();
