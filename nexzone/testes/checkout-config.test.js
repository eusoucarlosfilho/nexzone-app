// Construtor do checkout — Fases 1 e 2 (src/lib/checkoutConfig.ts e src/lib/extrasPedido.ts)
const assert = require('assert');
const c = require('./.build/checkoutConfig.js');
let ok = 0, fail = 0; const t = (n, fn) => { try { fn(); ok++; console.log('OK  ', n); } catch (x) { fail++; console.log('FAIL', n, '-', x.message); } };
const SB = 'https://abc.supabase.co';
const urlOk = c.urlDoArmazenamento(SB);
const IMG = `${SB}/storage/v1/object/public/capas/u1/a.jpg`;
const tipos = (cfg) => cfg.blocos.map((b) => b.tipo);
const P0 = '00000000-0000-4000-8000-000000000000', P1 = '11111111-1111-4111-8111-111111111111', P2 = '22222222-2222-4222-8222-222222222222', P3 = '33333333-3333-4333-8333-333333333333', P4 = '44444444-4444-4444-8444-444444444444', P5 = '55555555-5555-4555-8555-555555555555';

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
t('bump antigo (um só): textos limitados, imagem só do armazenamento e vira o 1º da lista', () => {
  const v = c.normalizarCheckout({ versao: 2, blocos: [], bump: { chamada: 'x'.repeat(500), texto: 'Leve', imagem: 'https://x.com/a.png' } }, urlOk);
  assert.strictEqual(v.bumps.length, 1); assert.strictEqual(v.bumps[0].product_id, '');
  assert.strictEqual(v.bumps[0].chamada.length, 120); assert.strictEqual(v.bumps[0].imagem, null);
  assert.strictEqual(c.visualDoBump(v, P1, 0).texto, 'Leve');   // 1º bump herda os textos antigos
  assert.strictEqual(c.visualDoBump(v, P2, 1).texto, '');       // os outros começam vazios
});
t('contador com data inválida fica vazio', () => assert.strictEqual(c.normalizarCheckout({ versao: 2, blocos: [{ tipo: 'contador', ate: 'amanhã' }] }).blocos[0].ate, ''));

// ---- Fase 2: até 4 order bumps ----
t('bumps: textos de cada bump ligados ao produto, no máximo 4', () => {
  const v = c.normalizarCheckout({ versao: 2, blocos: [], bumps: [P1, P2, P3, P4, P5].map((id, i) => ({ product_id: id, chamada: 'C' + i, texto: 'T' + i, imagem: IMG })) }, urlOk);
  assert.strictEqual(v.bumps.length, 4);
  assert.strictEqual(c.visualDoBump(v, P3, 2).chamada, 'C2');
  assert.strictEqual(c.visualDoBump(v, P5, 0).chamada, ''); // 5º foi descartado
});
t('lista do produto: até 4, sem repetir, sem o próprio produto, preço >= 1', () => {
  const l = c.listaDeBumps({ id: P0, bumps: [
    { product_id: P1, valor: 9.9 }, { product_id: P1, valor: 5 }, { product_id: P0, valor: 5 }, { product_id: 'x', valor: 5 },
    { product_id: P2, valor: 0.5 }, { product_id: P3, valor: '4.999' }, { product_id: P4, valor: 2 }, { product_id: P5, valor: 3 }, { product_id: P2, valor: 7 },
  ] });
  assert.deepStrictEqual(l.map((b) => b.product_id), [P1, P3, P4, P5]);
  assert.strictEqual(l[1].valor, 5);
});
t('lista do produto: sem lista nova, usa o bump antigo', () => {
  assert.deepStrictEqual(c.listaDeBumps({ id: P0, bumps: [], bump_product_id: P1, bump_valor: 4 }), [{ product_id: P1, valor: 4 }]);
  assert.deepStrictEqual(c.listaDeBumps({ id: P0 }), []);
});
t('salvar bumps: recusa 5, repetido, o próprio produto e preço < 1', () => {
  const ok = c.validarListaBumps([{ product_id: P1, valor: 1 }, { product_id: P2, valor: 19.9 }], P0);
  assert.strictEqual(ok.ok, true); assert.strictEqual(ok.lista.length, 2);
  assert.strictEqual(c.validarListaBumps([P1, P2, P3, P4, P5].map((p) => ({ product_id: p, valor: 2 })), P0).ok, false);
  assert.ok(/mesmo produto/.test(c.validarListaBumps([{ product_id: P1, valor: 2 }, { product_id: P1, valor: 3 }], P0).erro));
  assert.strictEqual(c.validarListaBumps([{ product_id: P0, valor: 2 }], P0).ok, false);
  assert.ok(/R\$ 1,00/.test(c.validarListaBumps([{ product_id: P1, valor: 0.99 }], P0).erro));
  assert.strictEqual(c.validarListaBumps([], P0).ok, true);
});
t('validar config: imagem externa em qualquer bump é recusada', () => {
  const r = c.validarCheckout({ versao: 2, blocos: [], bumps: [{ product_id: P1, imagem: IMG }, { product_id: P2, imagem: 'https://x.com/a.png' }] }, urlOk);
  assert.strictEqual(r.ok, false);
});
const e = require('./.build/extrasPedido.js');
t('extras do pedido: sem pagamento não mostra conteúdo nem arquivo', () => {
  const x = e.extrasDoPedido({ status: 'pendente', bumps: [{ titulo: 'A', conteudo: 'segredo', arquivo_path: 'p/a.pdf' }] });
  assert.strictEqual(x[0].conteudo, null); assert.strictEqual(x[0].temArquivo, false); assert.strictEqual(x[0].titulo, 'A');
});
t('extras do pedido: pago mostra os 4, na ordem', () => {
  const x = e.extrasDoPedido({ status: 'entregue', bumps: [1, 2, 3, 4].map((n) => ({ titulo: 'B' + n, conteudo: n === 2 ? 'https://x' : null, arquivo_path: n === 3 ? 'f.pdf' : null })) });
  assert.deepStrictEqual(x.map((i) => i.titulo), ['B1', 'B2', 'B3', 'B4']);
  assert.strictEqual(x[1].conteudo, 'https://x'); assert.strictEqual(x[2].temArquivo, true);
});
t('extras do pedido: pedido antigo (um bump) continua aparecendo', () => {
  const x = e.extrasDoPedido({ status: 'entregue', bumps: [], bump_product_id: P1, bump_titulo: 'Velho', bump_conteudo: 'ok', bump_arquivo_path: null });
  assert.strictEqual(x.length, 1); assert.strictEqual(x[0].conteudo, 'ok');
});
t('download do extra: posição certa, nunca fora da lista', () => {
  const o = { bumps: [{ arquivo_path: 'a' }, { arquivo_path: 'b' }] };
  assert.strictEqual(e.arquivoDoExtra(o, 1), 'b'); assert.strictEqual(e.arquivoDoExtra(o, 3), null);
  assert.strictEqual(e.arquivoDoExtra(o, -5), 'a'); assert.strictEqual(e.arquivoDoExtra({ bumps: [], bump_arquivo_path: 'v' }, 0), 'v');
  assert.strictEqual(e.arquivoDoExtra({ bumps: [], bump_arquivo_path: 'v' }, 1), null);
});
console.log(`\n${ok} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
