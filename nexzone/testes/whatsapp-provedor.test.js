// Testa a camada do provedor (src/lib/whatsapp.ts) contra um servidor FALSO que imita a Evolution API.
// Nada sai da máquina: o "provedor" roda em 127.0.0.1. A configuração vem de um substituto em memória.
const http = require('http');
const Module = require('module');
const assert = require('assert');

const chamadas = [];
let estado = 'close';
const srv = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => (corpo += c));
  req.on('end', () => {
    chamadas.push({ metodo: req.method, url: req.url, apikey: req.headers.apikey, corpo: corpo ? JSON.parse(corpo) : null });
    const json = (s, d) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
    if (req.headers.apikey !== 'chave-teste') return json(401, { message: 'Unauthorized' });
    if (req.method === 'POST' && req.url === '/instance/create') return json(403, { response: { message: ['This name "cb" is already in use.'] } });
    if (req.method === 'GET' && req.url === '/instance/connect/cb') { estado = 'connecting'; return json(200, { base64: 'data:image/png;base64,iVBORw0KGgo=', pairingCode: 'ABCD-1234' }); }
    if (req.method === 'GET' && req.url === '/instance/connectionState/cb') return json(200, { instance: { instanceName: 'cb', state: estado } });
    if (req.method === 'GET' && req.url.startsWith('/instance/fetchInstances')) return json(200, [{ name: 'cb', ownerJid: '5563999991234@s.whatsapp.net' }]);
    if (req.method === 'DELETE' && req.url === '/instance/logout/cb') { estado = 'close'; return json(200, { status: 'SUCCESS' }); }
    if (req.method === 'POST' && req.url === '/message/sendText/cb') {
      if (estado !== 'open') return json(400, { response: { message: ['Connection Closed'] } });
      return json(201, { key: { id: 'MSG123' }, status: 'PENDING' });
    }
    json(404, { message: 'not found' });
  });
});

srv.listen(0, '127.0.0.1', async () => {
  const porta = srv.address().port;
  // Substitui a leitura de configuração (que normalmente vem do banco)
  const cfg = { ativo: true, apiUrl: `http://127.0.0.1:${porta}`, instancia: 'cb' };
  const original = Module._load;
  Module._load = function (req, ...rest) {
    if (req === '@/lib/whatsapp/config') return { lerConfig: async () => cfg, lerChave: async () => 'chave-teste' };
    return original.call(this, req, ...rest);
  };
  const w = require('./.build/whatsapp.js');
  let ok = 0, fail = 0;
  const t = async (n, f) => { try { await f(); ok++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };

  await t('createInstance aceita "já existe" (idempotente)', async () => assert.deepStrictEqual(await w.createInstance(), { ok: true }));
  await t('cria com integração Baileys e QR', async () => { const c = chamadas.find((x) => x.url === '/instance/create'); assert.strictEqual(c.corpo.integration, 'WHATSAPP-BAILEYS'); assert.strictEqual(c.corpo.qrcode, true); assert.strictEqual(c.apikey, 'chave-teste'); });
  await t('getQrCode devolve imagem e código', async () => { const q = await w.getQrCode(); assert.ok(q.ok); assert.ok(q.qr.startsWith('data:image/png;base64,')); assert.strictEqual(q.codigoPareamento, 'ABCD-1234'); });
  await t('status: aguardando QR', async () => assert.strictEqual((await w.getStatus()).estado, 'aguardando_qr'));
  await t('envio com sessão fechada falha com o motivo', async () => { const r = await w.sendText('5563999991234', 'oi'); assert.ok(!r.ok); assert.match(r.erro, /Connection Closed/); });
  estado = 'open';
  await t('status: conectado com o número', async () => { const s = await w.getStatus(); assert.strictEqual(s.estado, 'conectado'); assert.strictEqual(s.numero, '5563999991234'); });
  await t('sendText envia número e texto', async () => { const r = await w.sendText('5563999991234', 'Olá'); assert.deepStrictEqual(r, { ok: true, id: 'MSG123' }); const c = chamadas.filter((x) => x.url === '/message/sendText/cb').pop(); assert.deepStrictEqual(c.corpo, { number: '5563999991234', text: 'Olá' }); });
  await t('sendText recusa número fora do padrão sem chamar o provedor', async () => { const n = chamadas.length; const r = await w.sendText('63999991234', 'x'); assert.ok(!r.ok); assert.strictEqual(chamadas.length, n); });
  await t('disconnect', async () => { assert.deepStrictEqual(await w.disconnect(), { ok: true }); assert.strictEqual((await w.getStatus()).estado, 'desconectado'); });
  cfg.apiUrl = 'http://127.0.0.1:1';
  await t('provedor fora do ar: erro, sem travar', async () => { const r = await w.sendText('5563999991234', 'x', 1500); assert.ok(!r.ok); });
  await t('status com provedor fora do ar: erro', async () => assert.strictEqual((await w.getStatus()).estado, 'erro'));
  cfg.apiUrl = '';
  await t('sem configuração: não chama nada', async () => { assert.strictEqual((await w.getStatus()).estado, 'nao_configurado'); assert.ok(!(await w.sendText('5563999991234', 'x')).ok); });

  console.log(`\n${ok} passaram, ${fail} falharam`);
  srv.close();
  process.exit(fail ? 1 : 0);
});
