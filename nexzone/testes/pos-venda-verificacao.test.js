// Oferta pós-compra, carrinho abandonado e verificação do produtor (CPF/CNPJ).
const assert = require('assert');
const P = require('./.build/posVenda.js');
const D = require('./.build/documento.js');
let ok = 0;
const t = (n, f) => { f(); ok++; };
const PROD = '11111111-1111-4111-8111-111111111111', UP = '22222222-2222-4222-8222-222222222222', DOWN = '33333333-3333-4333-8333-333333333333', OUTRA = '44444444-4444-4444-8444-444444444444';
const minhas = new Set([UP, DOWN]);

t('sem linha no banco: recuperação ligada, ofertas desligadas', () => {
  const c = P.lerPosVenda(null);
  assert.strictEqual(c.recuperacao.ativa, true);
  assert.strictEqual(c.upsell.ativo, false);
  assert.strictEqual(P.etapaAtual(c, []), null);
});
t('validação: produto da própria loja, ativo, outro produto e preço mínimo', () => {
  assert.strictEqual(P.validarPosVenda({ upsell: { ativo: true } }, PROD, minhas).ok, false);
  assert.match(P.validarPosVenda({ upsell: { ativo: true, product_id: PROD, preco: 10 } }, PROD, minhas).erro, /outro produto/);
  assert.match(P.validarPosVenda({ upsell: { ativo: true, product_id: OUTRA, preco: 10 } }, PROD, minhas).erro, /seu e estar ativo/);
  assert.match(P.validarPosVenda({ upsell: { ativo: true, product_id: UP, preco: 0.5 } }, PROD, minhas).erro, /preço/);
  assert.match(P.validarPosVenda({ upsell: { ativo: false }, downsell: { ativo: true, product_id: DOWN, preco: 9 } }, PROD, minhas).erro, /primeira está ligada/);
  const v = P.validarPosVenda({ upsell: { ativo: true, product_id: UP.toUpperCase(), preco: '27.9', titulo: '  Leve junto  ', minutos: 999 }, downsell: { ativo: true, product_id: DOWN, preco: 17 }, recuperacao: { ativa: true, cupom: 'volta 10!' } }, PROD, minhas);
  assert.ok(v.ok);
  assert.strictEqual(v.linha.upsell_product_id, UP);
  assert.strictEqual(v.linha.upsell_preco, 27.9);
  assert.strictEqual(v.linha.upsell_titulo, 'Leve junto');
  assert.strictEqual(v.linha.upsell_minutos, 120);
  assert.strictEqual(v.linha.recuperacao_cupom, 'VOLTA10');
});
t('etapas: upsell → recusou → downsell → fim', () => {
  const c = P.lerPosVenda({ upsell_ativo: true, upsell_product_id: UP, upsell_preco: 27, downsell_ativo: true, downsell_product_id: DOWN, downsell_preco: 17, upsell_minutos: 15 });
  assert.strictEqual(P.etapaAtual(c, []), 'upsell');
  assert.strictEqual(P.etapaAtual(c, [{ etapa: 'upsell', resposta: 'recusou' }]), 'downsell');
  assert.strictEqual(P.etapaAtual(c, [{ etapa: 'upsell', resposta: 'aceitou' }]), null);
  assert.strictEqual(P.etapaAtual(c, [{ etapa: 'upsell', resposta: 'recusou' }, { etapa: 'downsell', resposta: 'recusou' }]), null);
});
t('prazo da oferta é de verdade', () => {
  const pago = '2026-10-27T12:00:00.000Z', base = new Date(pago).getTime();
  assert.ok(P.ofertaNoPrazo(pago, 15, base + 14 * 60000));
  assert.ok(!P.ofertaNoPrazo(pago, 15, base + 16 * 60000));
  assert.ok(P.ofertaNoPrazo(pago, 0, base + 999 * 60000));
  assert.strictEqual(P.expiraEm(pago, 15), '2026-10-27T12:15:00.000Z');
});
t('link de recuperação leva e-mail, cupom e origem', () => {
  const u = new URL(P.linkRecuperacao('https://www.compreibarato.com.br', PROD, 'ana+1@x.com', 'VOLTA10'));
  assert.strictEqual(u.pathname, `/checkout/${PROD}`);
  assert.strictEqual(u.searchParams.get('email'), 'ana+1@x.com');
  assert.strictEqual(u.searchParams.get('cupom'), 'VOLTA10');
  assert.strictEqual(u.searchParams.get('utm_source'), 'recuperacao');
  assert.strictEqual(P.ETAPAS_CARRINHO.length, 2);
});
t('CPF', () => {
  assert.ok(D.cpfValido('529.982.247-25'));
  assert.ok(D.cpfValido('11144477735'));
  assert.ok(!D.cpfValido('529.982.247-24'));
  assert.ok(!D.cpfValido('111.111.111-11'));
  assert.ok(!D.cpfValido('123'));
  assert.strictEqual(D.formatarDocumento('52998224725'), '529.982.247-25');
});
t('CNPJ', () => {
  assert.ok(D.cnpjValido('11.222.333/0001-81'));
  assert.ok(!D.cnpjValido('11.222.333/0001-80'));
  assert.ok(!D.cnpjValido('00000000000000'));
  assert.strictEqual(D.formatarDocumento('11222333000181'), '11.222.333/0001-81');
  assert.strictEqual(D.mascararDocumento('pf', '4725'), '•••.•••.•••-25');
});
t('idade', () => {
  const hoje = new Date(2026, 9, 27);
  assert.strictEqual(D.idade('2008-10-27', hoje), 18);
  assert.strictEqual(D.idade('2008-10-28', hoje), 17);
  assert.strictEqual(D.idade('xx', hoje), null);
});
console.log(`pós-venda + verificação: ${ok} testes ok`);
