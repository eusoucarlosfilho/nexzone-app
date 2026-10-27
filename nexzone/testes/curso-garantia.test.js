// Área de membros (vídeo, liberação gradual, progresso, materiais, certificado) e garantia/reembolso.
const assert = require('assert');
const C = require('./.build/curso.js');
const G = require('./.build/garantia.js');
let ok = 0;
const t = (n, f) => { f(); ok++; };

t('YouTube em todos os formatos vira player sem cookies', () => {
  const urls = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ'];
  for (const u of urls) assert.strictEqual(C.videoDaUrl(u).src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1', u);
});
t('Vimeo, inclusive não listado', () => {
  assert.strictEqual(C.videoDaUrl('https://vimeo.com/123456789').src, 'https://player.vimeo.com/video/123456789');
  assert.strictEqual(C.videoDaUrl('https://vimeo.com/123456789/abcdef1234').src, 'https://player.vimeo.com/video/123456789?h=abcdef1234');
  assert.strictEqual(C.videoDaUrl('https://player.vimeo.com/video/123456789?h=abcdef1234').src, 'https://player.vimeo.com/video/123456789?h=abcdef1234');
});
t('Panda, Bunny, Loom, Drive, Wistia e mp4', () => {
  assert.strictEqual(C.videoDaUrl('https://player-vz-7b6cf9e4-8bf.tv.pandavideo.com.br/embed/?v=0c2d2b3a-1234-4abc-9def-1234567890ab').provedor, 'panda');
  assert.strictEqual(C.videoDaUrl('https://iframe.mediadelivery.net/embed/12345/0c2d2b3a-1234-4abc-9def-1234567890ab').src, 'https://iframe.mediadelivery.net/embed/12345/0c2d2b3a-1234-4abc-9def-1234567890ab?responsive=true');
  assert.strictEqual(C.videoDaUrl('https://www.loom.com/share/0123456789abcdef0123456789abcdef').src, 'https://www.loom.com/embed/0123456789abcdef0123456789abcdef');
  assert.strictEqual(C.videoDaUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWx/view?usp=sharing').src, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWx/preview');
  assert.strictEqual(C.videoDaUrl('https://fast.wistia.net/embed/iframe/abc123xyz').provedor, 'wistia');
  assert.deepStrictEqual(C.videoDaUrl('https://cdn.site.com/aulas/a1.mp4'), { tipo: 'arquivo', src: 'https://cdn.site.com/aulas/a1.mp4' });
});
t('links perigosos ou desconhecidos não viram vídeo', () => {
  for (const u of ['javascript:alert(1)', 'http://youtu.be/dQw4w9WgXcQ', 'https://evil.com/embed?v=x', 'https://youtu.be/<script>', '', null, 'https://player-vz-x.tv.pandavideo.com.br.evil.com/embed/?v=0c2d2b3a-1234-4abc-9def-1234567890ab'])
    assert.strictEqual(C.videoDaUrl(u), null, String(u));
});
t('materiais: só https/http ou arquivo da pasta do próprio produtor', () => {
  const m = C.limparMateriais([
    { titulo: 'PDF', path: 'u1/abc-apostila.pdf', nome: 'apostila.pdf' },
    { titulo: 'Alheio', path: 'u2/roubado.pdf' },
    { titulo: 'Volta', path: 'u1/../u2/x.pdf' },
    { titulo: 'Planilha', url: 'https://docs.google.com/x' },
    { titulo: 'Script', url: 'javascript:alert(1)' },
    'lixo',
  ], 'u1');
  assert.deepStrictEqual(m, [{ titulo: 'PDF', path: 'u1/abc-apostila.pdf', nome: 'apostila.pdf' }, { titulo: 'Planilha', url: 'https://docs.google.com/x' }]);
  assert.strictEqual(C.limparMateriais(Array(30).fill({ titulo: 'x', url: 'https://a.com' }), 'u1').length, 15);
});
t('liberação gradual: vale o maior entre módulo e aula', () => {
  const compra = '2026-10-01T12:00:00.000Z';
  const agora = new Date('2026-10-05T12:00:00.000Z').getTime();
  assert.ok(C.aulaLiberada(compra, 0, 0, agora));
  assert.ok(C.aulaLiberada(compra, 3, 0, agora));
  assert.ok(!C.aulaLiberada(compra, 7, 2, agora));
  assert.ok(!C.aulaLiberada(compra, 0, 5, agora));
  assert.ok(C.aulaLiberada(compra, 0, 5, agora, true), 'dono vê tudo');
  assert.strictEqual(C.liberaEm(compra, 2, 7).toISOString(), '2026-10-08T12:00:00.000Z');
});
const linhasMod = [{ id: 'm2', titulo: 'B', ordem: 2, liberar_apos_dias: 0 }, { id: 'm1', titulo: 'A', ordem: 1, liberar_apos_dias: 0 }];
const linhasAula = [
  { id: 'a3', modulo_id: 'm2', titulo: 'Aula 3', ordem: 1, duracao_min: 30, liberar_apos_dias: 10 },
  { id: 'a2', modulo_id: 'm1', titulo: 'Aula 2', ordem: 2, duracao_min: 20 },
  { id: 'a1', modulo_id: 'm1', titulo: 'Aula 1', ordem: 1, duracao_min: 10, previa: true },
  { id: 'rx', modulo_id: 'm1', titulo: 'Rascunho', ordem: 3, publicada: false },
  { id: 'orf', modulo_id: 'zz', titulo: 'Sem módulo', ordem: 1 },
];
t('monta a árvore em ordem e ignora aula sem módulo', () => {
  const m = C.montarCurso(linhasMod, linhasAula);
  assert.deepStrictEqual(m.map((x) => x.id), ['m1', 'm2']);
  assert.deepStrictEqual(m[0].aulas.map((a) => a.id), ['a1', 'a2', 'rx']);
  assert.strictEqual(m[0].aulas[0].previa, true);
  assert.strictEqual(m[0].aulas[2].publicada, false);
});
t('progresso conta só aulas publicadas', () => {
  const m = C.montarCurso(linhasMod, linhasAula);
  assert.deepStrictEqual(C.progresso(m, ['a1', 'rx']), { total: 3, feitas: 1, pct: 33, completo: false, minutos: 60 });
  assert.strictEqual(C.progresso(m, ['a1', 'a2', 'a3']).completo, true);
  assert.strictEqual(C.progresso([], []).completo, false);
});
t('próxima aula respeita liberação; vizinhas', () => {
  const m = C.montarCurso(linhasMod, linhasAula);
  const compra = '2026-10-01T00:00:00.000Z', agora = new Date('2026-10-03T00:00:00.000Z').getTime();
  assert.strictEqual(C.proximaAula(m, new Set(['a1']), compra, agora).id, 'a2');
  assert.strictEqual(C.proximaAula(m, new Set(['a1', 'a2']), compra, agora), null, 'a3 ainda não liberou');
  assert.deepStrictEqual(Object.values(C.vizinhas(m, 'a2')).map((x) => x && x.id), ['a1', 'a3']);
});
t('configuração e certificado', () => {
  assert.deepStrictEqual(C.normalizarConfig({ ativo: true, cor: 'red', carga_horaria: 0, certificado: true }), { ativo: true, boas_vindas: null, certificado: true, carga_horaria: null, cor: null });
  assert.strictEqual(C.normalizarConfig({ cor: '#00AAff', carga_horaria: 12 }).cor, '#00AAff');
  let i = 0; const seq = () => (i++ % 32) / 32;
  const cod = C.codigoCertificado(seq);
  assert.ok(C.codigoValido(cod), cod);
  assert.ok(!C.codigoValido('ABCD-EFGH-IJK0'));
  assert.strictEqual(C.duracaoTexto(95), '1 h 35 min');
  assert.strictEqual(C.duracaoTexto(120), '2 h');
});

// ---------- garantia ----------
t('garantia: mínimo de 7 dias, máximo 365', () => {
  assert.strictEqual(G.diasDeGarantia(0), 7);
  assert.strictEqual(G.diasDeGarantia(null), 7);
  assert.strictEqual(G.diasDeGarantia(30), 30);
  assert.strictEqual(G.diasDeGarantia(999), 365);
});
t('pode pedir reembolso dentro do prazo, uma vez', () => {
  const pago = '2026-10-01T12:00:00.000Z';
  const d3 = new Date('2026-10-04T12:00:00.000Z').getTime();
  const d9 = new Date('2026-10-09T12:00:00.000Z').getTime();
  assert.strictEqual(G.podePedirReembolso({ status: 'entregue', pagoEm: pago, garantiaDias: 7 }, d3).pode, true);
  assert.strictEqual(G.podePedirReembolso({ status: 'entregue', pagoEm: pago, garantiaDias: 7 }, d9).pode, false);
  assert.strictEqual(G.podePedirReembolso({ status: 'entregue', pagoEm: pago, garantiaDias: 30 }, d9).pode, true);
  assert.strictEqual(G.podePedirReembolso({ status: 'pendente', pagoEm: null, garantiaDias: 7 }, d3).pode, false);
  assert.strictEqual(G.podePedirReembolso({ status: 'reembolsado', pagoEm: pago, garantiaDias: 7 }, d3).pode, false);
  assert.strictEqual(G.podePedirReembolso({ status: 'entregue', pagoEm: pago, garantiaDias: 7, pedidoAberto: true }, d3).pode, false);
  assert.strictEqual(G.podePedirReembolso({ status: 'entregue', pagoEm: pago, garantiaDias: 7, jaDecidido: 'recusado' }, d3).pode, false);
  assert.strictEqual(G.diasRestantes(G.fimDaGarantia(pago, 7), d3), 4);
  assert.strictEqual(G.rotuloMotivo('xx'), 'Outro motivo');
});
console.log(`curso + garantia: ${ok} testes ok`);
