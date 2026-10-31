const assert = require('assert');
const crypto = require('crypto');
const C = require('./.build/caixaEmail.js');
const S = require('./.build/caixaEmail-assinatura.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };

const segredoBruto = crypto.randomBytes(24);
const segredo = 'whsec_' + segredoBruto.toString('base64');
const assinar = (id, ts, corpo) => 'v1,' + crypto.createHmac('sha256', segredoBruto).update(`${id}.${ts}.${corpo}`).digest('base64');

t('assinatura do webhook: válida passa', () => {
  const ts = String(Math.floor(Date.now() / 1000)), corpo = '{"type":"email.received"}';
  assert.ok(S.assinaturaValida(segredo, { id: 'msg_1', timestamp: ts, assinatura: assinar('msg_1', ts, corpo) }, corpo));
  // várias assinaturas no cabeçalho (troca de segredo): basta uma bater
  assert.ok(S.assinaturaValida(segredo, { id: 'msg_1', timestamp: ts, assinatura: 'v1,AAAA ' + assinar('msg_1', ts, corpo) }, corpo));
});
t('assinatura do webhook: corpo mexido, segredo errado, antiga ou sem cabeçalho falham', () => {
  const ts = String(Math.floor(Date.now() / 1000)), corpo = '{"a":1}';
  const sig = assinar('m', ts, corpo);
  assert.ok(!S.assinaturaValida(segredo, { id: 'm', timestamp: ts, assinatura: sig }, '{"a":2}'));
  assert.ok(!S.assinaturaValida('whsec_' + crypto.randomBytes(24).toString('base64'), { id: 'm', timestamp: ts, assinatura: sig }, corpo));
  const velho = String(Math.floor(Date.now() / 1000) - 600);
  assert.ok(!S.assinaturaValida(segredo, { id: 'm', timestamp: velho, assinatura: assinar('m', velho, corpo) }, corpo));
  assert.ok(!S.assinaturaValida(segredo, { id: null, timestamp: ts, assinatura: sig }, corpo));
  assert.ok(!S.assinaturaValida('', { id: 'm', timestamp: ts, assinatura: sig }, corpo));
});
t('endereços', () => {
  assert.deepStrictEqual(C.lerEndereco('Fulano de Tal <Fulano@X.com>'), { nome: 'Fulano de Tal', email: 'fulano@x.com' });
  assert.deepStrictEqual(C.lerEndereco('"Loja, Ltda" <a@b.com>'), { nome: 'Loja, Ltda', email: 'a@b.com' });
  assert.deepStrictEqual(C.lerEndereco('a@b.com'), { nome: null, email: 'a@b.com' });
  const l = C.listaDeEmails('a@b.com, A@B.com; c@d.com.br\nerrado');
  assert.deepStrictEqual(l.validos, ['a@b.com', 'c@d.com.br']);
  assert.deepStrictEqual(l.invalidos, ['errado']);
  assert.ok(C.ehNosso('Suporte <suporte@compreibarato.com.br>'));
  assert.ok(!C.ehNosso('x@compreibarato.com.br.evil.com'));
});
t('conversa: references > in-reply-to > message-id', () => {
  assert.strictEqual(C.chaveConversa({ messageId: '<c@x>', inReplyTo: '<b@x>', references: '<A@x> <b@x>' }), '<a@x>');
  assert.strictEqual(C.chaveConversa({ messageId: '<c@x>', inReplyTo: '<B@x>' }), '<b@x>');
  assert.strictEqual(C.chaveConversa({ messageId: '<C@x>' }), '<c@x>');
  assert.ok(C.chaveConversa({}).startsWith('<sem-id-'));
});
t('assunto de resposta e encaminhamento', () => {
  assert.strictEqual(C.assuntoResposta('Re: RE: Pedido 123'), 'Re: Pedido 123');
  assert.strictEqual(C.assuntoResposta('Fwd: Pedido', 'fwd'), 'Fwd: Pedido');
  assert.strictEqual(C.assuntoResposta('', 're'), 'Re: (sem assunto)');
});
t('texto, prévia e html seguros', () => {
  assert.strictEqual(C.textoDoHtml('<style>x{}</style><p>Olá&nbsp;<b>mundo</b></p><script>alert(1)</script>'), 'Olá mundo');
  assert.strictEqual(C.previaDe(null, '<p>a</p><p>b</p>'), 'a b');
  const h = C.htmlDoTexto('oi <b>\nveja https://x.com/a.');
  assert.ok(h.includes('&lt;b&gt;') && h.includes('<br>') && h.includes('<a href="https://x.com/a">'));
  const ex = C.htmlParaExibir('<p onclick="x()">a</p><script>alert(1)</script><img src=x onerror=alert(1)>');
  assert.ok(!/script|onclick|onerror/i.test(ex) && ex.includes('<base target="_blank">'));
  assert.ok(C.htmlParaExibir(null, 'a<b').includes('a&lt;b'));
});
t('citação no fim da resposta', () => {
  const c = C.citacao({ de: 'a@b.com', de_nome: 'Ana', criado_em: '2026-10-30T12:00:00Z', texto: 'linha 1\nlinha 2' });
  assert.ok(c.includes('Ana <a@b.com> escreveu:') && c.includes('> linha 1\n> linha 2'));
});
t('message-id nosso', () => {
  const m = S.novoMessageId();
  assert.ok(/^<[a-z0-9]+\.[0-9a-f]{16}@compreibarato\.com\.br>$/.test(m));
});
t('tamanho legível', () => {
  assert.strictEqual(C.tamanhoLegivel(500), '500 B');
  assert.strictEqual(C.tamanhoLegivel(2048), '2 KB');
  assert.strictEqual(C.tamanhoLegivel(1572864), '1,5 MB');
});
console.log(`caixa de e-mail: ${ok} testes ok`);
