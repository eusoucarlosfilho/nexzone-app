const assert = require('assert');
const tel = require('./.build/whatsapp/telefone.js');
const ev = require('./.build/whatsapp/eventos.js');
let ok = 0, fail = 0;
const t = (n, f) => { try { f(); ok++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };

t('celular com máscara', () => assert.strictEqual(tel.normalizarTelefone('(63) 99999-1234'), '5563999991234'));
t('com +55', () => assert.strictEqual(tel.normalizarTelefone('+55 63 99999-1234'), '5563999991234'));
t('com 0 na frente', () => assert.strictEqual(tel.normalizarTelefone('063999991234'), '5563999991234'));
t('fixo de 8 dígitos', () => assert.strictEqual(tel.normalizarTelefone('6332151234'), '556332151234'));
t('DDD inexistente', () => assert.strictEqual(tel.normalizarTelefone('(20) 99999-1234'), null));
t('celular de 9 dígitos sem 9', () => assert.strictEqual(tel.normalizarTelefone('63 89999-1234'), null));
t('repetido', () => assert.strictEqual(tel.normalizarTelefone('63 99999-9999'), null));
t('curto, vazio, nulo, estrangeiro', () => { assert.strictEqual(tel.normalizarTelefone('1234'), null); assert.strictEqual(tel.normalizarTelefone(''), null); assert.strictEqual(tel.normalizarTelefone(null), null); assert.strictEqual(tel.normalizarTelefone('+1 415 555 2671'), null); });
t('máscara progressiva', () => { assert.strictEqual(tel.formatarTelefone('63'), '(63'); assert.strictEqual(tel.formatarTelefone('639999'), '(63) 9999'); assert.strictEqual(tel.formatarTelefone('63999991234'), '(63) 99999-1234'); });
t('mascarar para o admin', () => assert.strictEqual(tel.mascararTelefone('5563999991234'), '55 63 9****-1234'));

t('todos os eventos têm modelo e variáveis', () => { for (const e of ev.EVENTOS) { assert.ok(e.padrao.length > 10, e.chave); assert.ok(e.variaveis.length > 0, e.chave); } });
t('chaves únicas', () => assert.strictEqual(new Set(ev.CHAVES_EVENTOS).size, ev.EVENTOS.length));
t('variáveis usadas no padrão estão declaradas', () => { for (const e of ev.EVENTOS) for (const m of e.padrao.matchAll(/\{([a-z_]+)\}/g)) assert.ok(e.variaveis.includes(m[1]), `${e.chave}:${m[1]}`); });
t('monta texto com variáveis', () => assert.strictEqual(ev.montarTexto('Olá, {nome}! {produto} — {valor}', { nome: 'Ana', produto: 'Curso', valor: 'R$ 10,00' }), 'Olá, Ana! Curso — R$ 10,00'));
t('variável ausente some sem quebrar', () => assert.strictEqual(ev.montarTexto('Pedido {pedido} ok', {}), 'Pedido ok'));
t('remove HTML do modelo e das variáveis', () => assert.strictEqual(ev.montarTexto('<b>Oi</b> {nome}<br>tchau', { nome: '<script>x</script>Ana' }), 'Oi xAna\ntchau'));
t('limita tamanho', () => assert.ok(ev.montarTexto('x'.repeat(5000), {}).length <= ev.LIMITE_TEXTO));
t('rodapé de promoção tem o link de preferências', () => assert.ok(ev.montarTexto('Oferta!' + ev.RODAPE_PROMO, { link_preferencias: 'https://x/conta' }).endsWith('https://x/conta')));

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
