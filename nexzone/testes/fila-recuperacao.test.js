const assert = require('assert');
const F = require('./.build/filaRecuperacao.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };
const O1 = 'aaaaaaaa-0000-0000-0000-000000000001', O2 = 'aaaaaaaa-0000-0000-0000-000000000002', P = 'pppppppp-0000-0000-0000-000000000001';
const pix = (id, h, email = 'Ana@Gmail.com', user = 'u1') => ({ id, comprador: user, comprador_email: email, product_id: P, total: 29.9, created_at: `2026-10-30T${String(h).padStart(2, '0')}:00:00Z`, titulo: 'Conta FF', loja: 'Loja X' });
const base = { pix: [], carrinhos: [], logs: [], lembretes: [], manuais: [], desistiu: new Set(), contatos: {} };

t('chave: e-mail em minúsculas + produto; sem e-mail usa o usuário', () => {
  assert.strictEqual(F.chaveRecuperacao(' Ana@Gmail.com ', 'u1', P), `ana@gmail.com|${P}`);
  assert.strictEqual(F.chaveRecuperacao(null, 'u1', P), `u:u1|${P}`);
});
t('dois Pix da mesma pessoa e produto viram UMA linha', () => {
  const f = F.montarFila({ ...base, pix: [pix(O1, 10), pix(O2, 11, 'ana@gmail.com')] });
  assert.strictEqual(f.length, 1); assert.deepStrictEqual(f[0].pedidos.sort(), [O1, O2]); assert.strictEqual(f[0].situacao, 'novo');
});
t('carrinho + Pix da mesma pessoa juntam; o Pix manda no tipo', () => {
  const f = F.montarFila({ ...base, pix: [pix(O1, 10)], carrinhos: [{ id: 7, product_id: P, user_id: 'u1', email: 'ana@gmail.com', nome: 'Ana Souza', atualizado_em: '2026-10-30T09:00:00Z', titulo: 'Conta FF', loja: null, preco: 29.9, lembrete_1h: null, lembrete_24h: null }] });
  assert.strictEqual(f.length, 1); assert.strictEqual(f[0].tipo, 'pix'); assert.strictEqual(f[0].nome, 'Ana Souza'); assert.deepStrictEqual(f[0].carrinhos, [7]);
});
t('histórico automático: WhatsApp do pedido certo, sem o "código Pix" repetido, e-mail do lembrete', () => {
  const f = F.montarFila({ ...base, pix: [pix(O1, 10)],
    logs: [
      { evento: 'pix_gerado', chave: `pix_gerado:${O1}`, status: 'enviado', created_at: '2026-10-30T10:00:05Z', enviado_em: '2026-10-30T10:00:06Z' },
      { evento: 'pix_codigo', chave: `pix_codigo:${O1}`, status: 'enviado', created_at: '2026-10-30T10:00:07Z', enviado_em: null },
      { evento: 'pix_lembrete', chave: `pix_lembrete_15min:${O1}`, status: 'falhou', created_at: '2026-10-30T10:06:00Z', enviado_em: null },
      { evento: 'pix_lembrete', chave: `pix_lembrete_15min:outro`, status: 'enviado', created_at: '2026-10-30T10:06:00Z', enviado_em: null },
    ],
    lembretes: [{ order_id: O1, etapa: '15min', enviado_em: '2026-10-30T10:06:01Z', canais: ['whatsapp', 'email'] }] });
  const h = f[0].historico;
  assert.strictEqual(h.length, 3); assert.strictEqual(h[0].rotulo, 'Pix na hora (WhatsApp)'); assert.strictEqual(h[1].status, 'falhou'); assert.strictEqual(h[2].canal, 'email');
  assert.strictEqual(f[0].situacao, 'lembrado');
});
t('contato manual: situação "contatado", último contato com nome', () => {
  const k = F.chaveRecuperacao('ana@gmail.com', 'u1', P);
  const f = F.montarFila({ ...base, pix: [pix(O1, 10)], manuais: [{ chave: k, canal: 'whatsapp', por_nome: 'César', created_at: '2026-10-30T12:00:00Z' }] });
  assert.strictEqual(f[0].situacao, 'contatado'); assert.deepStrictEqual(f[0].ultimoManual, { quando: '2026-10-30T12:00:00Z', por: 'César', canal: 'whatsapp' });
  assert.ok(F.contatoRecente(f[0], 24, Date.parse('2026-10-30T13:00:00Z')));
  assert.ok(!F.contatoRecente(f[0], 24, Date.parse('2026-11-01T13:00:00Z')));
});
t('desistiu vai para o fim e vence "contatado"', () => {
  const k = F.chaveRecuperacao('bia@x.com', 'u2', P);
  const f = F.montarFila({ ...base, pix: [pix(O1, 10), pix(O2, 11, 'bia@x.com', 'u2')], desistiu: new Set([k]), manuais: [{ chave: k, canal: 'email', por_nome: 'Carlos', created_at: '2026-10-30T12:00:00Z' }] });
  assert.strictEqual(f[1].situacao, 'desistiu'); assert.strictEqual(f[0].situacao, 'novo');
});
t('contato do perfil entra (WhatsApp e consentimento)', () => {
  const f = F.montarFila({ ...base, pix: [pix(O1, 10)], contatos: { u1: { nome: 'Ana', whatsapp: '5563999990000', avisos: true } } });
  assert.strictEqual(f[0].nome, 'Ana'); assert.strictEqual(f[0].whatsapp, '5563999990000'); assert.ok(f[0].avisos);
});
t('idDaChave e haQuantoCurto', () => {
  assert.strictEqual(F.idDaChave(`pix_lembrete_retro:${O1}`), O1);
  const agora = Date.parse('2026-10-30T12:00:00Z');
  assert.strictEqual(F.haQuantoCurto('2026-10-30T11:30:00Z', agora), 'há 30 min');
  assert.strictEqual(F.haQuantoCurto('2026-10-29T12:00:00Z', agora), 'há 1 dia');
});
console.log(`fila de recuperação: ${ok} testes ok`);
