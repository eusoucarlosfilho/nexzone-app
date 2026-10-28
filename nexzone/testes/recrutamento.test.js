// Página de recrutamento de produtores: validação do formulário, simulador e evento da API de Conversões.
const Module = require('module'); const assert = require('assert');
const orig = Module._load;
Module._load = function (r, ...a) { if (r === '@/lib/supabase/server') return { createAdminClient: () => { throw new Error('sem banco no teste'); } }; return orig.call(this, r, ...a); };
process.env.SUPABASE_SERVICE_ROLE_KEY = 'segredo-de-teste-do-servidor';
const R = require('./.build/recrutamento.js');
const S = require('./.build/recrutamento-servidor.js');
let ok = 0;
const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };

t('whatsapp: aceita formatos comuns e devolve com 55', () => {
  assert.strictEqual(R.normalizarWhatsapp('(63) 99999-8888'), '5563999998888');
  assert.strictEqual(R.normalizarWhatsapp('+55 11 98888-7777'), '5511988887777');
  assert.strictEqual(R.normalizarWhatsapp('5511988887777'), '5511988887777');
  assert.strictEqual(R.normalizarWhatsapp('11 3333-4444'), '551133334444');
});
t('whatsapp: recusa número curto, DDD inválido e celular sem 9', () => {
  assert.strictEqual(R.normalizarWhatsapp('99999-8888'), null);
  assert.strictEqual(R.normalizarWhatsapp('(05) 99999-8888'), null);
  assert.strictEqual(R.normalizarWhatsapp('(11) 89999-8888'), null);
  assert.strictEqual(R.normalizarWhatsapp(''), null);
});
t('instagram: tira @, link e barra; recusa caractere inválido', () => {
  assert.strictEqual(R.normalizarInstagram('@Fulano.Silva'), 'fulano.silva');
  assert.strictEqual(R.normalizarInstagram('https://www.instagram.com/fulano_/?hl=pt'), 'fulano_');
  assert.strictEqual(R.normalizarInstagram('ful ano'), null);
  assert.strictEqual(R.normalizarInstagram(''), null);
});
t('etapa 1: nome e WhatsApp obrigatórios; e-mail e @ opcionais mas validados', () => {
  assert.strictEqual(R.validarEtapa1({ nome: 'A', whatsapp: '63999998888' }).campo, 'nome');
  assert.strictEqual(R.validarEtapa1({ nome: 'Ana', whatsapp: '123' }).campo, 'whatsapp');
  assert.strictEqual(R.validarEtapa1({ nome: 'Ana', whatsapp: '63999998888', email: 'x@' }).campo, 'email');
  const v = R.validarEtapa1({ nome: '  Ana   Souza ', whatsapp: '(63) 99999-8888', email: 'ANA@Mail.com', instagram: '@ana' });
  assert.ok(v.ok);
  assert.deepStrictEqual(v.dados, { nome: 'Ana Souza', whatsapp: '5563999998888', email: 'ana@mail.com', instagram: 'ana' });
});
t('etapa 2: só aceita valores da lista e limpa plataformas de quem não vende', () => {
  assert.strictEqual(R.validarEtapa2({}).campo, 'nicho');
  assert.strictEqual(R.validarEtapa2({ nicho: 'Idiomas' }).campo, 'tipos');
  assert.strictEqual(R.validarEtapa2({ nicho: 'Idiomas', tipos: ['hackeado'] }).campo, 'tipos');
  assert.strictEqual(R.validarEtapa2({ nicho: 'Idiomas', tipos: ['ebook'] }).campo, 'ja_vende');
  const v = R.validarEtapa2({ nicho: 'Idiomas', tipos: ['ebook', 'ebook', 'curso'], ja_vende: 'nao', plataformas: ['Hotmart'], link_produto: 'meusite.com/x' });
  assert.ok(v.ok);
  assert.deepStrictEqual(v.dados.tipos, ['ebook', 'curso']);
  assert.deepStrictEqual(v.dados.plataformas, []);
  assert.strictEqual(v.dados.link_produto, 'https://meusite.com/x');
  const w = R.validarEtapa2({ nicho: 'Idiomas', tipos: ['curso'], ja_vende: 'sim', plataformas: ['Hotmart', 'Inventada'], faturamento: 'R$ 1 mil a R$ 5 mil/mês' });
  assert.deepStrictEqual(w.dados.plataformas, ['Hotmart']);
  assert.strictEqual(R.validarEtapa2({ nicho: 'Idiomas', tipos: ['curso'], ja_vende: 'sim', link_produto: 'javascript:alert(1)' }).campo, 'link_produto');
});
t('origem: só chaves conhecidas', () => {
  assert.deepStrictEqual(R.limparOrigem({ utm_source: 'meta', utm_campaign: 'fundadores', x: 'y', ref: 5 }), { utm_source: 'meta', utm_campaign: 'fundadores' });
});
t('simulador: 10 mil a 10% + R$1 x 100 vendas = 1.100; com 3% = 300', () => {
  assert.deepStrictEqual(R.economiaMensal(10000, 10, 1, 100), { atual: 1100, nossa: 300, economia: 800 });
  assert.strictEqual(R.economiaMensal(1000, 2, 0, 0).economia, 0);
});
t('links e mensagens do WhatsApp', () => {
  assert.match(R.linkWhatsapp('+55 (63) 99999-8888', 'Oi, tudo?'), /^https:\/\/wa\.me\/5563999998888\?text=Oi%2C%20tudo%3F$/);
  assert.match(R.mensagemParaProdutor('Ana Souza', 'Idiomas'), /Oi, Ana!.*\(idiomas\).*3% por venda por 12 meses/);
});
t('API de Conversões: dados com hash, event_id igual ao do navegador, código de teste', () => {
  const c = S.corpoEventoLead({ nome: 'Lead', eventId: 'lead-abc12345', url: 'https://compreibarato.com.br/produtores', ip: '1.2.3.4', userAgent: 'UA', fbp: 'fb.1.1.2', fbc: null,
    pessoa: { nome: 'Ana Souza', whatsapp: '5563999998888', email: 'ana@mail.com', id: 'tok' } }, 'TEST1');
  const e = c.data[0];
  assert.strictEqual(e.event_name, 'Lead');
  assert.strictEqual(e.event_id, 'lead-abc12345');
  assert.strictEqual(c.test_event_code, 'TEST1');
  assert.strictEqual(e.user_data.ph[0].length, 64);
  assert.notStrictEqual(e.user_data.em[0], 'ana@mail.com');
  assert.strictEqual(e.user_data.client_ip_address, '1.2.3.4');
  assert.strictEqual(e.user_data.fbc, undefined);
  assert.ok(!JSON.stringify(c).includes('5563999998888'));
});
t('config: valida WhatsApp e Pixel; token em branco não sobrescreve', () => {
  assert.strictEqual(S.linhasDeConfig({ whatsapp: '6399999' }).ok, false);
  assert.strictEqual(S.linhasDeConfig({ pixel: '12' }).ok, false);
  const r = S.linhasDeConfig({ whatsapp: '+55 63 99999-8888', pixel: '123456789012345', token: '   ', teste: 'TEST 12' });
  assert.ok(r.ok);
  assert.deepStrictEqual(r.linhas.map((l) => l.key), ['recrut_whatsapp', 'recrut_pixel', 'recrut_teste']);
  assert.strictEqual(r.linhas[2].value, 'TEST12');
  assert.strictEqual(S.linhasDeConfig({ token: 'curto' }).ok, false);
  const tk = 'EAAB' + 'x'.repeat(60);
  const g = S.linhasDeConfig({ token: tk });
  assert.ok(g.ok && g.linhas[0].key === 'recrut_capi' && g.linhas[0].value.startsWith('enc:v1:') && !g.linhas[0].value.includes(tk));
  assert.deepStrictEqual(S.linhasDeConfig({ limparToken: true, token: tk }).linhas, [{ key: 'recrut_capi', value: '' }]);
});
t('cookies do Meta: monta fbc a partir do fbclid quando não há cookie', () => {
  const req = { headers: { get: (h) => (h === 'cookie' ? '_fbp=fb.1.123.456; outro=1' : null) } };
  const c = S.cliquesMeta(req, 'IwAR0abcdefghij');
  assert.strictEqual(c.fbp, 'fb.1.123.456');
  assert.match(c.fbc, /^fb\.1\.\d+\.IwAR0abcdefghij$/);
  assert.strictEqual(S.cliquesMeta(req, '<script>').fbc, null);
});
console.log(`recrutamento de produtores: ${ok} testes ok`);
