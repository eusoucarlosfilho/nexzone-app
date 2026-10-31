const assert = require('assert');
const A = require('./.build/analiseAnuncio.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const tipos = (txt, onde = 'descricao') => A.sinaisDoTexto(txt, onde).map((s) => s.tipo);
const ctxOk = { preco: 10, aprovadosAntes: 3, diasDeLoja: 60 };

t('anúncio limpo fica verde', () => {
  const a = A.avaliar({ titulo: 'Passe Booyah Free Fire', descricao: 'Passe Booyah da temporada, entregue pelo chat do pedido em até 1 hora após o pagamento.' }, ctxOk, 'ok');
  assert.strictEqual(a.nivel, 'verde'); assert.strictEqual(a.sinais.length, 0);
  assert.ok(A.podeAprovarSozinho(a, { ligado: true, correcaoPendente: false }));
});
t('site de outra loja NA CAPA (texto lido da imagem) não entra sozinho', () => {
  const a = A.avaliar({ titulo: 'Passe Booyah', descricao: 'Passe Booyah da temporada, entrega rápida pelo chat do pedido.', textoImagens: ['PASSE BOOYAH!\nDIAMOND STORE\nCOMPRE EM WWW.LOJADIAMANTE.COM.BR'] }, ctxOk, 'ok');
  assert.notStrictEqual(a.nivel, 'verde');
  assert.ok(a.sinais.some((s) => s.tipo === 'link_externo' && s.onde === 'imagem' && s.trecho.includes('lojadiamante.com.br')));
  assert.ok(!A.podeAprovarSozinho(a, { ligado: true, correcaoPendente: false }));
});
t('contato e pagamento por fora', () => {
  assert.ok(tipos('chama no zap (63) 99999-1234').includes('contato_externo'));
  assert.ok(tipos('me chama no privado').includes('contato_externo'));
  assert.ok(tipos('segue @lojadoze no insta').includes('contato_externo'));
  assert.ok(tipos('faço mais barato no pix direto').includes('pagamento_fora'));
  assert.ok(tipos('Pagamento fora da plataforma sai mais barato').includes('pagamento_fora'));
  assert.ok(tipos('contato: vendedor@gmail.com').includes('contato_externo'));
});
t('truques para fugir do filtro', () => {
  assert.ok(tipos('acesse lojadiamante ponto com ponto br').includes('link_externo'));
  assert.ok(tipos('compre no ggmax também').includes('outro_site'));
  assert.ok(tipos('link: bit.ly/abc').includes('link_externo'));
});
t('produto proibido, compartilhado, promessa', () => {
  assert.ok(tipos('Painel FF com aimbot').includes('proibido'));
  assert.ok(tipos('Gerador de robux infinito').includes('proibido'));
  assert.ok(tipos('Netflix tela compartilhada vitalício').includes('compartilhada'));
  assert.ok(tipos('Conta que nunca cai, 100% garantido').includes('promessa'));
});
t('sem falso alarme no que é normal', () => {
  assert.deepStrictEqual(tipos('Gift card Roblox. Resgate em roblox.com/redeem'), []);
  assert.deepStrictEqual(tipos('Discord Nitro 1 mês, entrega automática'), []);
  assert.deepStrictEqual(tipos('Conta lvl 70 com 120 skins por R$ 4.99, versão 1.2'), []);
  assert.deepStrictEqual(tipos('Instalação simples, veja o tutorial na página do pedido'), []);
  assert.deepStrictEqual(tipos('Mais detalhes em compreibarato.com.br/loja/minha'), []);
  assert.deepStrictEqual(tipos('Telegram Premium 3 meses'), []);
});
t('preço muito abaixo dos parecidos', () => {
  const a = A.avaliar({ titulo: 'Conta Valorant', descricao: 'Conta com todas as skins do passe, e-mail trocável, entrega pelo chat.' }, { ...ctxOk, preco: 5, medianaParecidos: 80, qtdParecidos: 8 }, 'ok');
  assert.ok(a.sinais.some((s) => s.tipo === 'preco_baixo'));
  const b = A.avaliar({ titulo: 'Conta Valorant', descricao: 'Conta com todas as skins do passe, e-mail trocável, entrega pelo chat.' }, { ...ctxOk, preco: 5, medianaParecidos: 80, qtdParecidos: 2 }, 'ok');
  assert.ok(!b.sinais.some((s) => s.tipo === 'preco_baixo'));
});
t('histórico do vendedor pesa', () => {
  const desc = 'Passe Booyah da temporada, entregue pelo chat do pedido em até 1 hora.';
  const novo = A.avaliar({ titulo: 'Passe', descricao: desc }, { preco: 10, aprovadosAntes: 0, diasDeLoja: 1 }, 'ok');
  assert.ok(novo.sinais.some((s) => s.tipo === 'vendedor_novo')); assert.strictEqual(novo.nivel, 'verde');
  const reinc = A.avaliar({ titulo: 'Passe', descricao: desc }, { ...ctxOk, problemasAntes: 2 }, 'ok');
  assert.strictEqual(reinc.nivel, 'amarelo');
  // vendedor confiável não apaga sinal grave
  const conf = A.avaliar({ titulo: 'Passe', descricao: desc + ' chama no whats' }, { ...ctxOk, lojaVerificada: true, vendasDaLoja: 50 }, 'ok');
  assert.strictEqual(conf.nivel, 'amarelo');
});
t('sem leitura da imagem não aprova sozinho; com correção pendente também não', () => {
  const a = A.avaliar({ titulo: 'Passe', descricao: 'Passe Booyah da temporada, entregue pelo chat do pedido.' }, ctxOk, 'falhou');
  assert.strictEqual(a.nivel, 'verde');
  assert.ok(!A.podeAprovarSozinho(a, { ligado: true, correcaoPendente: false }));
  const b = { ...a, ocr: 'ok' };
  assert.ok(!A.podeAprovarSozinho(b, { ligado: false, correcaoPendente: false }));
  assert.ok(!A.podeAprovarSozinho(b, { ligado: true, correcaoPendente: true }));
});
t('mediana', () => { assert.strictEqual(A.mediana([10, 2, 8]), 8); assert.strictEqual(A.mediana([1, 3]), 2); assert.strictEqual(A.mediana([]), null); });
console.log(`análise do anúncio: ${ok} testes ok`);
