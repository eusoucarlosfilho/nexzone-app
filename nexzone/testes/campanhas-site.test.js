const assert = require('assert');
const C = require('./.build/campanhasSite.js');
const M = require('./.build/modelosEmail.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const base = { formato: 'faixa', titulo: 'Natal Gamer', inicio: '2026-12-10T03:00:00Z', fim: '2026-12-26T02:59:00Z', tema: 'natal' };

t('validar campanha', () => {
  assert.ok(C.validarCampanha(base).ok);
  assert.ok(!C.validarCampanha({ ...base, formato: 'popup' }).ok);
  assert.ok(!C.validarCampanha({ ...base, titulo: 'a' }).ok);
  assert.ok(!C.validarCampanha({ ...base, fim: base.inicio }).ok);
  assert.ok(!C.validarCampanha({ ...base, link: 'https://ggmax.com.br' }).ok, 'link externo');
  assert.strictEqual(C.validarCampanha({ ...base, link: 'https://www.compreibarato.com.br/jogos' }).c.link, '/jogos');
  assert.strictEqual(C.validarCampanha({ ...base, link: '/produtos?q=gift card' }).c.link, '/produtos?q=gift%20card');
  assert.ok(!C.validarCampanha({ ...base, botao: 'Ver' }).ok, 'botão sem link');
  assert.ok(!C.validarCampanha({ ...base, imagem_url: 'https://evil.com/x.png' }).ok, 'imagem de fora');
  assert.ok(C.validarCampanha({ ...base, imagem_url: 'https://abc.supabase.co/storage/v1/object/public/capas/campanhas/x1.png' }).ok);
  assert.strictEqual(C.validarCampanha({ ...base, tema: 'xx' }).c.tema, 'laranja');
});
t('situação e quem fica no ar', () => {
  const agora = Date.parse('2026-12-20T12:00:00Z');
  assert.strictEqual(C.situacao({ ...base, ativa: true }, agora), 'no_ar');
  assert.strictEqual(C.situacao({ ...base, ativa: false }, agora), 'pausada');
  assert.strictEqual(C.situacao({ ...base, ativa: true }, Date.parse('2026-12-01T00:00:00Z')), 'agendada');
  assert.strictEqual(C.situacao({ ...base, ativa: true }, Date.parse('2027-01-01T00:00:00Z')), 'encerrada');
  const a = { ...base, ativa: true, titulo: 'A', prioridade: 1 }, b = { ...base, ativa: true, titulo: 'B', prioridade: 5 }, c = { ...base, ativa: true, titulo: 'C', formato: 'banner', prioridade: 9 };
  assert.strictEqual(C.noAr([a, b, c], 'faixa', agora).titulo, 'B');
  assert.strictEqual(C.noAr([a, b, c], 'banner', agora).titulo, 'C');
  assert.strictEqual(C.noAr([a], 'banner', agora), null);
});
t('datas móveis', () => {
  assert.strictEqual(C.pascoa(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.strictEqual(C.pascoa(2027).toISOString().slice(0, 10), '2027-03-28');
  assert.strictEqual(C.blackFriday(2026).toISOString().slice(0, 10), '2026-11-27');
  assert.strictEqual(C.blackFriday(2027).toISOString().slice(0, 10), '2027-11-26');
});
t('próximas datas a partir de 31/10/2026', () => {
  const l = C.proximasDatas(Date.parse('2026-10-31T15:00:00Z'), 6);
  assert.deepStrictEqual(l.map((x) => x.nome).slice(0, 3), ['Halloween', 'Black Friday', 'Natal']);
  const natal = l.find((x) => x.nome === 'Natal');
  assert.strictEqual(natal.comeca, '2026-12-10T03:00:00.000Z'); // 00:00 em Brasília
  assert.strictEqual(natal.termina, '2026-12-26T02:59:00.000Z'); // 23:59 do dia 25 em Brasília
  assert.ok(l.some((x) => x.nome === 'Férias de janeiro'));
});
t('prompt da imagem traz o texto exato e o tamanho', () => {
  const n = C.proximasDatas(Date.parse('2026-10-31T15:00:00Z'), 6).find((x) => x.nome === 'Natal');
  const p = C.promptDaImagem(n.sugestao, 'computador');
  assert.ok(p.includes('1920 x 600') && p.includes('"NATAL GAMER"') && p.includes('"O PRESENTE CHEGA NA HORA · SEM FRETE"') && /sem logos/i.test(p));
  assert.ok(C.promptDaImagem(n.sugestao, 'celular').includes('1080 x 1080'));
});
t('modelos de e-mail', () => {
  const e = M.montarEmail('pix_pendente', { nome: 'Felipe Almeida', produto: 'Passe Booyah', link: 'https://x/checkout/1' });
  assert.ok(e.assunto.includes('Passe Booyah') && e.texto.startsWith('Oi, Felipe!') && e.texto.includes('https://x/checkout/1'));
  assert.ok(e.texto.includes('{atendente}'), 'atendente fica para a caixa trocar');
  const b = M.montarEmail('boas_vindas_vendedor', { nome: 'Ana', atendente: 'Carlos Filho' });
  assert.ok(b.texto.includes('Aqui é Carlos') && b.assunto === 'Bem-vindo ao Comprei Barato, Ana!');
  const s = M.montarEmail('lojista_sem_anuncio', { nome: '', loja: 'Loja do Zé' });
  assert.ok(s.texto.startsWith('Oi! Tudo bem?') && s.texto.includes('"Loja do Zé"'));
  assert.ok(M.urlEscrever({ para: 'a@b.com', assunto: 'x y', texto: 'z' }).startsWith('/admin/email?para=a%40b.com'));
});
console.log(`campanhas do site e modelos de e-mail: ${ok} testes ok`);
