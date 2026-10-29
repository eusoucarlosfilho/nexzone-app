const assert = require('assert');
const N = require('./.build/notifPreferencias.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
t('comprador comum não vê vendas nem plataforma', () => assert.deepStrictEqual(N.gruposPara({ admin: false, vendedor: false }).map((g) => g.id), ['compras', 'geral']));
t('lojista vê vendas', () => assert.deepStrictEqual(N.gruposPara({ admin: false, vendedor: true }).map((g) => g.id), ['vendas', 'compras', 'geral']));
t('admin vê tudo', () => assert.deepStrictEqual(N.gruposPara({ admin: true, vendedor: false }).map((g) => g.id), ['plataforma', 'vendas', 'compras', 'geral']));
t('tipos válidos: tira desconhecidos, repetidos e os fixos', () => assert.deepStrictEqual(N.tiposValidos(['pix_gerado', 'pix_gerado', 'hack', 'advertencia', 'adm_venda']), ['pix_gerado', 'adm_venda']));
t('tipos válidos: lixo vira lista vazia', () => { assert.deepStrictEqual(N.tiposValidos(null), []); assert.deepStrictEqual(N.tiposValidos('pix_gerado'), []); });
t('opção ligada por padrão e desligada quando um tipo dela sai', () => {
  const aviso = N.GRUPOS.flatMap((g) => g.opcoes).find((o) => o.id === 'aviso');
  assert.strictEqual(N.opcaoLigada(aviso, new Set()), true); assert.strictEqual(N.opcaoLigada(aviso, new Set(['novidade'])), false);
});
t('advertência nunca desliga', () => { const adv = N.GRUPOS.flatMap((g) => g.opcoes).find((o) => o.id === 'advertencia'); assert.strictEqual(N.opcaoLigada(adv, new Set(['advertencia'])), true); });
t('todo tipo da central existe no banco (SQL 23)', () => {
  const banco = ['venda','compra','pagamento','reembolso','mensagem','pergunta','resposta','saque','anuncio','aviso','advertencia','novidade','pix_gerado','adm_pix','adm_venda'];
  N.TODOS_TIPOS.forEach((x) => assert.ok(banco.includes(x), x)); banco.forEach((x) => assert.ok(N.TODOS_TIPOS.includes(x), 'falta na central: ' + x));
});
console.log(`central de notificações: ${ok} testes ok`);
