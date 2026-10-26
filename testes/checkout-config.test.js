// Construtor do checkout — Fase 1 (src/lib/checkoutConfig.ts)
const assert = require('assert');
const c = require('./.build/checkoutConfig.js');
let ok = 0, fail = 0; const t = (n, fn) => { try { fn(); ok++; console.log('OK  ', n); } catch (x) { fail++; console.log('FAIL', n, '-', x.message); } };
const SB = 'https://abc.supabase.co';
const urlOk = c.urlDoArmazenamento(SB);
const IMG = `${SB}/storage/v1/object/public/capas/u1/a.jpg`;
const tipos = (cfg) => cfg.blocos.map((b) => b.tipo);

t('sem config = padrão com pagamento', () => assert.deepStrictEqual(tipos(c.normalizarCheckout(null)), ['titulo', 'pagamento', 'recebe', 'garantia', 'selos']));
t('config antiga (v1) vira blocos sem perder nada', () => {
  const v = c.normalizarCheckout({ headline: 'Oferta', subtitle: 'Sub', banner_url: IMG, badge_text: 'Lançamento', cor: '#112233', countdown_until: '2030-01-01T00:00:00Z' }, urlOk);
  assert.deepStrictEqual(tipos(v), ['imagem', 'titulo', 'contador', 'pagamento', 'recebe', 'garantia', 'selos']);
  assert.strictEqual(v.blocos[1].titulo, 'Oferta'); assert.strictEqual(v.blocos[1].selo, 'Lançamento'); assert.strictEqual(v.cor, '#112233');
});
t('pagamento sempre existe e não pode ser escondido', () => {
  const v = c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'texto', texto: 'oi' }] });
  assert.ok(tipos(v).includes('pagamento'));
  const v2 = c.normalizarCheckout({ versao: 2, blocos: [{ id: 'p', tipo: 'pagamento', ativo: false }] });
  assert.strictEqual(v2.blocos[0].ativo, true);
});
t('ordem escolhida é mantida', () => assert.deepStrictEqual(tipos(c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'depoimentos', itens: [] }, { tipo: 'pagamento' }, { tipo: 'texto', texto: 'x' }] })), ['depoimentos', 'pagamento', 'texto']));
t('blocos únicos não duplicam; textos até 5', () => {
  const v = c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'garantia' }, { tipo: 'garantia' }, ...Array(8).fill({ tipo: 'texto', texto: 'a' })] });
  assert.strictEqual(tipos(v).filter((x) => x === 'garantia').length, 1); assert.strictEqual(tipos(v).filter((x) => x === 'texto').length, 5);
});
t('tipo desconhecido é ignorado', () => assert.ok(!tipos(c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'script', html: '<x>' }] })).includes('script')));
t('imagem de fora do nosso armazenamento é descartada', () => {
  const v = c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'imagem', url: 'https://malicioso.com/a.jpg' }] }, urlOk);
  assert.strictEqual(v.blocos[0].url, '');
});
t('armazenamento: aceita capas, recusa outro bucket e ..', () => {
  assert.strictEqual(urlOk(IMG), true);
  assert.strictEqual(urlOk(`${SB}/storage/v1/object/public/privado/a.jpg`), false);
  assert.strictEqual(urlOk(`${SB}/storage/v1/object/public/capas/../privado/a.jpg`), false);
});
t('depoimentos: limpa vazios, limita a 6 e nota 1–5', () => {
  const itens = [{ nome: 'Ana', texto: 'Ótimo', nota: 9 }, { nome: '', texto: 'sem nome' }, ...Array(10).fill({ nome: 'B', texto: 'ok', nota: 0 })];
  const v = c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'depoimentos', itens }] });
  const d = v.blocos[0].itens; assert.strictEqual(d[0].nota, 5); assert.ok(d.length <= 6); assert.ok(d.every((x) => x.nome && x.nota >= 1));
});
t('validar: depoimento sem confirmação é recusado', () => {
  const r = c.validarCheckout({ versao: 2, blocos: [{ tipo: 'depoimentos', itens: [{ nome: 'Ana', texto: 'bom', nota: 5 }] }, { tipo: 'pagamento' }] }, urlOk);
  assert.strictEqual(r.ok, false); assert.ok(/clientes reais/.test(r.erro));
});
t('validar: com confirmação passa', () => {
  const r = c.validarCheckout({ versao: 2, depoimentosConfirmados: true, blocos: [{ tipo: 'depoimentos', itens: [{ nome: 'Ana', texto: 'bom', nota: 5 }] }, { tipo: 'pagamento' }] }, urlOk);
  assert.strictEqual(r.ok, true);
});
t('validar: imagem externa recusada com mensagem clara', () => {
  const r = c.validarCheckout({ versao: 2, blocos: [{ tipo: 'imagem', url: 'https://x.com/a.png' }] }, urlOk);
  assert.strictEqual(r.ok, false);
});
t('validar: cor inválida recusada', () => assert.strictEqual(c.validarCheckout({ versao: 2, cor: 'red;x', blocos: [] }, urlOk).ok, false));
t('bump: textos limitados e imagem só do armazenamento', () => {
  const v = c.normalizarCheckout({ versao: 2, blocos: [], bump: { chamada: 'x'.repeat(500), texto: 'Leve', imagem: 'https://x.com/a.png' } }, urlOk);
  assert.strictEqual(v.bump.chamada.length, 120); assert.strictEqual(v.bump.imagem, null);
});
t('contador com data inválida fica vazio', () => assert.strictEqual(c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'contador', ate: 'amanhã' }] }).blocos[0].ate, ''));
console.log(`\n${ok} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
