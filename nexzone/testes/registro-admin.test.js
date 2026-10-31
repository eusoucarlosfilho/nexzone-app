// Registro do admin ("quem fez") e sequência de mensagens do 1º contato com o lojista novo.
const assert = require('assert');
const R = require('./.build/registroAdmin.js');
let ok = 0;
const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };

t('toda ação tem grupo conhecido', () => {
  const grupos = R.GRUPOS.map((g) => g.id);
  for (const [k, v] of Object.entries(R.ACOES)) assert.ok(grupos.includes(v.grupo), k);
  assert.ok(R.acoesDoGrupo('aprovacao').includes('produto_aprovado'));
  assert.strictEqual(R.grupoDaAcao('nao_existe'), null);
});
t('frases: aprovação, WhatsApp, status e configurações', () => {
  assert.strictEqual(R.descreverAcao({ acao: 'produto_aprovado', alvo_nome: 'Conta FF', detalhes: {} }), 'aprovou o anúncio “Conta FF”');
  assert.strictEqual(R.descreverAcao({ acao: 'whatsapp_enviado', alvo_nome: 'Lucas', detalhes: { etapa: 2, titulo: 'O que vende' } }), 'enviou a mensagem 2 (O que vende) no WhatsApp para “Lucas”');
  assert.strictEqual(R.descreverAcao({ acao: 'whatsapp_enviado', alvo_nome: null, detalhes: { etapa: 0 } }), 'enviou a mensagem da fase no WhatsApp para');
  assert.strictEqual(R.descreverAcao({ acao: 'produtor_status', alvo_nome: 'Lucas', detalhes: { de: 'novo', para: 'conversando', automatico: true } }), 'mudou “Lucas” de Novo para Conversando (ao enviar a mensagem)');
  assert.ok(R.descreverAcao({ acao: 'config_alterada', alvo_nome: null, detalhes: { chaves: ['commission_percent'] } }).includes('commission_percent'));
  assert.strictEqual(R.descreverAcao({ acao: 'produto_destaque', alvo_nome: 'X', detalhes: { dias: 0 } }), 'tirou o destaque do anúncio “X”');
  assert.strictEqual(R.descreverAcao({ acao: 'acao_nova', alvo_nome: null, detalhes: null }), 'acao nova');
});
t('nome do admin: perfil, senão e-mail; cor fixa por pessoa', () => {
  assert.strictEqual(R.nomeDoAdmin('carlos filho'), 'Carlos');
  assert.strictEqual(R.nomeDoAdmin('', 'was.c.cesar@gmail.com'), 'Was');
  assert.strictEqual(R.nomeDoAdmin(null, null), 'Admin');
  assert.strictEqual(R.corDoAdmin('abc'), R.corDoAdmin('abc'));
  assert.strictEqual(R.corDoAdmin(null), '#8A8AA0');
});
t('sequência padrão: 3 mensagens, todas terminam com pergunta', () => {
  assert.strictEqual(R.SEQUENCIA_PADRAO.length, 3);
  for (const m of R.SEQUENCIA_PADRAO) assert.ok(m.texto.trim().endsWith('?'), m.titulo);
  assert.ok(R.SEQUENCIA_PADRAO[2].texto.includes('/vender/produtos/novo'));
});
t('variáveis: nome do lojista, quem está logado e jogo', () => {
  const m = R.montarMensagem('Oi, {nome}! Aqui é {atendente}. {jogo}?', { nome: 'Lucas Andrade', atendente: 'César Filho', jogo: 'Free Fire' });
  assert.strictEqual(m, 'Oi, Lucas! Aqui é César. Free Fire?');
  assert.strictEqual(R.montarMensagem('{atendente} / {jogo}', {}), 'a equipe / seu jogo');
});
t('validar sequência: 1 a 3, texto de 10 a 1000, título com padrão', () => {
  assert.strictEqual(R.validarSequencia([]).ok, false);
  assert.strictEqual(R.validarSequencia([{ texto: 'curto' }]).ok, false);
  assert.strictEqual(R.validarSequencia([1, 2, 3, 4].map(() => ({ texto: 'mensagem válida aqui?' }))).ok, false);
  assert.strictEqual(R.validarSequencia([{ texto: 'x'.repeat(1001) }]).ok, false);
  const v = R.validarSequencia([{ titulo: '', texto: '  Oi, tudo bem com você?  ' }]);
  assert.ok(v.ok); assert.strictEqual(v.sequencia[0].titulo, 'Mensagem 1'); assert.strictEqual(v.sequencia[0].texto, 'Oi, tudo bem com você?');
  assert.deepStrictEqual(R.sequenciaSalva(null), R.SEQUENCIA_PADRAO);
});
t('próxima mensagem e quem está atendendo', () => {
  assert.strictEqual(R.proximaEtapa(0), 1);
  assert.strictEqual(R.proximaEtapa(2), 3);
  assert.strictEqual(R.proximaEtapa(3), null);
  assert.strictEqual(R.proximaEtapa(1, 1), null);
  assert.deepStrictEqual(R.situacaoAtendimento({}, 'a'), { tipo: 'livre' });
  assert.deepStrictEqual(R.situacaoAtendimento({ responsavel_id: 'a', responsavel_nome: 'Carlos' }, 'a'), { tipo: 'meu', nome: 'Carlos' });
  assert.deepStrictEqual(R.situacaoAtendimento({ responsavel_id: 'b', responsavel_nome: 'César' }, 'a'), { tipo: 'outro', nome: 'César' });
});
t('há quanto tempo', () => {
  const agora = Date.parse('2026-10-31T12:00:00Z');
  assert.strictEqual(R.haQuanto('2026-10-31T11:59:30Z', agora), 'agora');
  assert.strictEqual(R.haQuanto('2026-10-31T11:55:00Z', agora), 'há 5 min');
  assert.strictEqual(R.haQuanto('2026-10-31T09:00:00Z', agora), 'há 3 h');
  assert.strictEqual(R.haQuanto('2026-10-30T11:00:00Z', agora), 'há 1 dia');
  assert.strictEqual(R.haQuanto(null, agora), '');
});
console.log(`registro-admin: ${ok} testes ok`);
