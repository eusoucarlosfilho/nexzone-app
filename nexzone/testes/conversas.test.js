const assert = require('assert');
const C = require('./.build/conversas.js');
const I = require('./.build/integracoes.js');
const W = require('./.build/whatsapp/eventos.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const auto = (o = {}) => ({ manual: false, temArquivo: false, temCurso: false, conteudo: null, ...o });

t('entrega: pagamento sozinho NÃO marca como entregue', () => {
  assert.strictEqual(C.entregaEfetiva({ status: 'entregue' }, auto({ conteudo: 'Me manda seu e-mail que eu envio o acesso' })), false);
  assert.strictEqual(C.entregaEfetiva({ status: 'entregue' }, auto({ manual: true, temArquivo: true })), false);
});
t('entrega: vendedor marcou → entregue', () => {
  assert.strictEqual(C.entregaEfetiva({ status: 'entregue', entrega_confirmada_em: '2026-10-30T10:00:00Z' }, auto({ manual: true })), true);
});
t('entrega automática de verdade: arquivo, curso ou link direto', () => {
  assert.ok(C.entregaEfetiva({ status: 'entregue' }, auto({ temArquivo: true })));
  assert.ok(C.entregaEfetiva({ status: 'entregue' }, auto({ temCurso: true })));
  assert.ok(C.entregaEfetiva({ status: 'entregue' }, auto({ conteudo: 'https://drive.google.com/x' })));
  assert.ok(!C.entregaEfetiva({ status: 'reembolsado', entrega_confirmada_em: 'x' }, auto({ temArquivo: true })));
  assert.ok(!C.entregaEfetiva({ status: 'pendente' }, auto({ temArquivo: true })));
});
t('etiquetas da lista', () => {
  const m = (papel, h) => ({ papel, created_at: `2026-10-30T${String(h).padStart(2, '0')}:00:00Z` });
  const e = (p) => C.etiquetaConversa({ status: 'entregue', entregue: false, reembolsoAberto: false, msgs: [], vistoEm: null, ...p });
  assert.strictEqual(e({}).etiqueta.id, 'entregar');
  assert.strictEqual(e({ msgs: [m('vendedor', 10)] }).etiqueta.id, 'conversando');
  const nova = e({ msgs: [m('vendedor', 10), m('comprador', 11)], vistoEm: '2026-10-30T10:30:00Z' });
  assert.strictEqual(nova.etiqueta.id, 'nova'); assert.ok(nova.naoLida);
  const vista = e({ msgs: [m('comprador', 11)], vistoEm: '2026-10-30T11:30:00Z' });
  assert.strictEqual(vista.etiqueta.id, 'conversando'); assert.ok(!vista.naoLida);
  assert.strictEqual(e({ entregue: true, msgs: [m('comprador', 11)] }).etiqueta.id, 'entregue');
  assert.ok(e({ entregue: true, msgs: [m('comprador', 11)] }).naoLida);
  assert.strictEqual(e({ entregue: true, reembolsoAberto: true }).etiqueta.id, 'reembolso');
  assert.strictEqual(e({ status: 'reembolsado' }).etiqueta.id, 'reembolsado');
});
t('lido: só quando a outra parte viu depois da mensagem', () => {
  assert.ok(!C.foiLida('2026-10-30T10:00:00Z', null));
  assert.ok(!C.foiLida('2026-10-30T10:00:00Z', '2026-10-30T09:59:00Z'));
  assert.ok(C.foiLida('2026-10-30T10:00:00Z', '2026-10-30T10:00:05Z'));
});
t('contato externo: pega telefone, links e convites', () => {
  ['me chama no zap', 'meu whats é 63 99999-0000', '(11) 98765-4321', '+55 63 9 9999 0000', 'https://wa.me/5563999990000']
    .forEach((x) => assert.strictEqual(C.classificarContato(x), 'reter', x));
  ['t.me/fulano', 'chama no telegram', 'instagram.com/loja'].forEach((x) => assert.strictEqual(C.classificarContato(x), 'atencao', x));
});
t('contato externo: não pega entrega normal de conta', () => {
  ['Login: joao@gmail.com Senha: abc123', 'ID do Free Fire: 123456789', 'Pedido 12345678', 'https://drive.google.com/abc', 'Obrigado pela compra!']
    .forEach((x) => assert.ok(!C.pareceContatoExterno(x), x));
});
t('e-mail mascarado para o vendedor', () => {
  assert.strictEqual(C.mascararEmail('joaosilva@gmail.com'), 'jo***@gmail.com');
  assert.strictEqual(C.mascararEmail('a@b.com'), 'a***@b.com');
  assert.strictEqual(C.mascararEmail(''), '');
  assert.strictEqual(C.mascararEmail('lixo'), 'Cliente');
});
t('anexos: tipos, tamanho e caminho do pedido', () => {
  assert.strictEqual(C.validarAnexoChat('image/png', 1000), null);
  assert.ok(C.validarAnexoChat('application/zip', 1000));
  assert.ok(C.validarAnexoChat('image/png', 11 * 1024 * 1024));
  const o = '11111111-2222-3333-4444-555555555555';
  assert.ok(C.caminhoDoPedido(`${o}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png`, o));
  assert.ok(!C.caminhoDoPedido(`99999999-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png`, o));
  assert.ok(!C.caminhoDoPedido(`${o}/../x.png`, o));
  assert.ok(!C.caminhoDoPedido(`${o}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.exe`, o));
});
t('anexos: tipo real pelos bytes', () => {
  assert.strictEqual(C.tipoPelosBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.strictEqual(C.tipoPelosBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), 'application/pdf');
  assert.strictEqual(C.tipoPelosBytes(new Uint8Array([0x4d, 0x5a, 0x90, 0x00])), null);
  assert.strictEqual(C.nomeSeguro('../../etc/<x>.pdf'), '....etcx.pdf');
  assert.strictEqual(C.tamanhoLegivel(2 * 1048576), '2,0 MB');
});
t('postback para o vendedor não leva o telefone do cliente', () => {
  const b = I.corpoPostback({ evento: 'compra_aprovada', pedidoId: 'p', status: 'pago', total: 10, criadoEm: 'x', produto: { id: 'a', titulo: 'b' }, bumps: [], comprador: { id: 'u', nome: 'Ana', email: 'a@b.com', whatsapp: '5511999998888' } });
  assert.strictEqual(b.comprador.whatsapp, undefined); assert.strictEqual(b.comprador.email, 'a@b.com');
});
t('evento WhatsApp de pedido entregue', () => assert.ok(W.acharEvento('pedido_entregue').padrao.includes('{link}')));
t('contato externo: palavras proibidas e disfarces', () => {
  ['whatsapp', 'me chama no zap', 'qual teu wpp', 'w h a t s', 'z.a.p', 'uatsapp', 'WhAtS', 'w.p.p'].forEach((x) => assert.strictEqual(C.classificarContato(x), 'reter', x));
  ['passa teu ctt', 'meu contato', 'c0ntat0', 'me add no insta', 'telegram', 'manda no email: fulano@gmail.com', 'otaviano@maxxspace.com ggluiz1@'].forEach((x) => assert.strictEqual(C.classificarContato(x), 'atencao', x));
  ['zapato', 'faz a partida', 'face id', 'número do pedido 123', 'conta entregue, confere', 'Se solicitado um PIN no seu computador é a senha dele. Se aparecer USB ou algo do tipo clica em cancelar e em outras maneiras de entrar ai entra utilizando a senha', 'baixa o app no celular e entra com o telefone da conta', 'ok, falta agora so o da tv', 'o número do pedido é 123'].forEach((x) => assert.strictEqual(C.classificarContato(x), null, x));
  // e-mail não é retido (tem produto entregue por e-mail), só avisa o admin
  assert.strictEqual(C.pareceContatoExterno('Login: joao@gmail.com Senha: abc123'), false);
});
t('produto citado vira cartão', () => {
  const id = '46ce7bf4-128b-40b7-8f41-2a4878eabfed';
  assert.deepStrictEqual(C.produtosNaMensagem(`https://www.compreibarato.com.br/checkout/${id}`), [id]);
  assert.deepStrictEqual(C.produtosNaMensagem(`olha https://compreibarato.com.br/produto/${id.toUpperCase()}?x=1 e ${'https://www.compreibarato.com.br/produto/' + id}`), [id]);
  assert.deepStrictEqual(C.produtosNaMensagem('https://outrosite.com/produto/' + id), []);
  assert.strictEqual(C.textoSemLinksDeProduto(`https://www.compreibarato.com.br/checkout/${id}`), '');
  assert.strictEqual(C.textoSemLinksDeProduto(`Dá uma olhada neste produto: https://www.compreibarato.com.br/produto/${id}`), 'Dá uma olhada neste produto:');
});
t('reclamação: 24 h para o vendedor, exceto desistência ou entrega marcada', () => {
  const agora = Date.parse('2026-10-30T12:00:00Z');
  assert.strictEqual(C.podeReclamar({ pagoEm: '2026-10-30T10:00:00Z', entregue: false }, agora).pode, false);
  assert.strictEqual(C.podeReclamar({ pagoEm: '2026-10-30T10:00:00Z', entregue: false }, agora).liberaEm, '2026-10-31T10:00:00.000Z');
  assert.ok(C.podeReclamar({ pagoEm: '2026-10-30T10:00:00Z', entregue: false, motivo: 'arrependimento' }, agora).pode);
  assert.ok(C.podeReclamar({ pagoEm: '2026-10-30T10:00:00Z', entregue: true }, agora).pode);
  assert.ok(C.podeReclamar({ pagoEm: '2026-10-29T10:00:00Z', entregue: false }, agora).pode);
});
t('chat fecha no fim da garantia; reembolso/reclamação aberta mantém', () => {
  const agora = Date.parse('2026-11-10T12:00:00Z');
  const base = { status: 'entregue', fimGarantia: '2026-11-06T12:00:00Z', reembolsoAberto: false, reclamacaoAberta: false };
  assert.ok(C.situacaoChat(base, agora).fechado);
  assert.ok(!C.situacaoChat({ ...base, reclamacaoAberta: true }, agora).fechado);
  assert.ok(!C.situacaoChat(base, Date.parse('2026-11-01T00:00:00Z')).fechado);
  assert.ok(C.situacaoChat({ ...base, status: 'reembolsado', fimGarantia: null }, agora).fechado);
});
console.log(`conversas: ${ok} testes ok`);
