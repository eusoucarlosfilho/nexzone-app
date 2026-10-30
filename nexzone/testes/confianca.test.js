const assert = require('assert');
const C = require('./.build/confianca.js');
const W = require('./.build/whatsapp/eventos.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; } catch (e) { console.error('FALHOU:', n); throw e; } };

t('CNPJ: válido, inválido e repetido', () => {
  assert.ok(C.cnpjValido('11.222.333/0001-81'));
  assert.ok(!C.cnpjValido('11.222.333/0001-82'));
  assert.ok(!C.cnpjValido('11111111111111'));
  assert.ok(!C.cnpjValido(''));
  assert.strictEqual(C.formatarCnpj('11222333000181'), '11.222.333/0001-81');
});
t('WhatsApp da empresa: aceita com e sem 55, recusa curto', () => {
  assert.strictEqual(C.whatsappEmpresa('(63) 99999-0000'), '5563999990000');
  assert.strictEqual(C.whatsappEmpresa('5563999990000'), '5563999990000');
  assert.strictEqual(C.whatsappEmpresa('9999'), '');
  assert.strictEqual(C.whatsappLegivel('5563999990000'), '(63) 99999-0000');
});
t('lerDadosEmpresa: nada inventado; CNPJ inválido some; e-mail cai no suporte', () => {
  const d = C.lerDadosEmpresa({}, '');
  assert.deepStrictEqual(d, { razao: '', cnpj: '', whatsapp: '', email: '', cidade: '', prazoManualHoras: 24 });
  const e = C.lerDadosEmpresa({ empresa_razao: '"Comprei Barato Ltda"', empresa_cnpj: '11222333000182', entrega_prazo_horas: '"2"' }, 'a@b.com, c@d.com');
  assert.strictEqual(e.razao, 'Comprei Barato Ltda'); assert.strictEqual(e.cnpj, ''); assert.strictEqual(e.email, 'a@b.com'); assert.strictEqual(e.prazoManualHoras, 2);
  assert.strictEqual(C.lerDadosEmpresa({ empresa_razao: '<script>x' }).razao, 'scriptx');
  assert.strictEqual(C.lerDadosEmpresa({ entrega_prazo_horas: true }).prazoManualHoras, 24);
});
t('validarEmpresa: campos vazios ok, erros apontam o campo', () => {
  assert.ok(C.validarEmpresa({ prazoManualHoras: 24 }).ok);
  assert.strictEqual(C.validarEmpresa({ cnpj: '123', prazoManualHoras: 24 }).campo, 'cnpj');
  assert.strictEqual(C.validarEmpresa({ whatsapp: '123', prazoManualHoras: 24 }).campo, 'whatsapp');
  assert.strictEqual(C.validarEmpresa({ email: 'x@', prazoManualHoras: 24 }).campo, 'email');
  assert.strictEqual(C.validarEmpresa({ prazoManualHoras: 0 }).campo, 'prazoManualHoras');
  const v = C.validarEmpresa({ cnpj: '11.222.333/0001-81', whatsapp: '63999990000', prazoManualHoras: '48' });
  assert.ok(v.ok); assert.strictEqual(v.dados.cnpj, '11222333000181'); assert.strictEqual(v.dados.whatsapp, '5563999990000'); assert.strictEqual(v.dados.prazoManualHoras, 48);
});
t('promessa de entrega: na hora x pelo vendedor com prazo', () => {
  assert.strictEqual(C.promessaEntrega('chave', 24).titulo, 'Entrega na hora');
  assert.strictEqual(C.promessaEntrega(null, 24).manual, false);
  const m = C.promessaEntrega('conta', 48);
  assert.ok(m.manual); assert.strictEqual(m.titulo, 'Entrega pelo vendedor em até 2 dias');
  assert.strictEqual(C.promessaEntrega('item', 2).titulo, 'Entrega pelo vendedor em até 2 horas');
  assert.strictEqual(C.textoHoras(1), '1 hora');
});
t('cartão do vendedor: só números reais; loja nova sem número inventado', () => {
  const n = C.linhasVendedor({ desde: '2026-10-05T12:00:00Z', vendas: 0, avaliacoes: 0, media: 0 }, { oficial: false, verificada: false });
  assert.deepStrictEqual(n, { selo: null, linhas: ['Na plataforma desde out/2026'], nova: true });
  const v = C.linhasVendedor({ desde: null, vendas: 12, avaliacoes: 3, media: 4.666 }, { oficial: false, verificada: true });
  assert.strictEqual(v.selo, 'Loja verificada'); assert.deepStrictEqual(v.linhas, ['12 vendas concluídas', '4,7 de 5 · 3 avaliações']); assert.ok(!v.nova);
  assert.strictEqual(C.linhasVendedor({ desde: null, vendas: 1, avaliacoes: 0, media: 0 }, { oficial: true, verificada: true }).selo, 'Loja oficial');
  assert.strictEqual(C.linhasVendedor({ desde: null, vendas: 1, avaliacoes: 0, media: 0 }, { oficial: false, verificada: false }).linhas[0], '1 venda concluída');
});
t('contador manual de avaliações some sem avaliação real escrita', () => {
  assert.deepStrictEqual(C.avaliacoesExibidas({ avaliacoes: 356, media: 4.9 }, 0), { avaliacoes: 0, media: 0 });
  assert.deepStrictEqual(C.avaliacoesExibidas({ avaliacoes: 356, media: 4.9 }, 2), { avaliacoes: 356, media: 4.9 });
});
t('pedido de avaliação: só entre 24 h e 72 h, uma vez, sem avaliação', () => {
  const agora = Date.parse('2026-10-30T12:00:00Z');
  const o = (h, status = 'entregue') => ({ id: 'a', comprador: 'u', status, entregue_em: new Date(agora - h * 3600000).toISOString() });
  assert.ok(!C.precisaPedirAvaliacao(o(10), agora, false, false));
  assert.ok(C.precisaPedirAvaliacao(o(30), agora, false, false));
  assert.ok(!C.precisaPedirAvaliacao(o(80), agora, false, false));
  assert.ok(!C.precisaPedirAvaliacao(o(30), agora, true, false));
  assert.ok(!C.precisaPedirAvaliacao(o(30), agora, false, true));
  assert.ok(!C.precisaPedirAvaliacao(o(30, 'reembolsado'), agora, false, false));
  assert.ok(!C.precisaPedirAvaliacao({ ...o(30), entregue_em: null }, agora, false, false));
});
t('linha do tempo do pedido', () => {
  const agora = Date.parse('2026-10-30T12:00:00Z');
  const p = C.linhaDoTempo({ status: 'pendente', created_at: '2026-10-30T11:00:00Z' }, agora);
  assert.deepStrictEqual(p.map((e) => [e.feito, e.atual]), [[true, false], [false, true], [false, false], [false, false]]);
  const e = C.linhaDoTempo({ status: 'entregue', created_at: '2026-10-20T11:00:00Z', entregue_em: '2026-10-20T11:05:00Z', garantia_ate: '2026-10-27T11:05:00Z' }, agora);
  assert.ok(e.every((x) => x.feito)); assert.strictEqual(e[3].rotulo, 'Garantia concluída');
  const g = C.linhaDoTempo({ status: 'entregue', entregue_em: '2026-10-29T11:05:00Z', garantia_ate: '2026-11-05T11:05:00Z' }, agora);
  assert.strictEqual(g[3].atual, true); assert.strictEqual(g[3].rotulo, 'Garantia em andamento');
});
t('evento WhatsApp de avaliação existe e tem link', () => {
  const ev = W.acharEvento('pedir_avaliacao');
  assert.ok(ev && ev.para === 'comprador' && ev.padrao.includes('{link}'));
});
console.log(`confiança no checkout: ${ok} testes ok`);
