// Lê o TEXTO escrito nas imagens do anúncio (OCR), para achar site, @ ou WhatsApp escondidos na capa.
// SÓ SERVIDOR. Roda no próprio site (tesseract.js + idioma português empacotado), sem serviço pago.
// Cada imagem é lida duas vezes: normal e com as cores invertidas (letra clara em fundo escuro é o padrão das capas gamer).
import path from 'path';
import fs from 'fs';

// pasta do idioma português (vai junto no pacote da função pela configuração do next.config)
function pastaIdioma(): string {
  const local = path.join(process.cwd(), 'node_modules', '@tesseract.js-data', 'por', '4.0.0_best_int');
  if (fs.existsSync(local)) return local;
  // eslint-disable-next-line no-eval
  const req = eval('require');
  return path.join(path.dirname(req.resolve('@tesseract.js-data/por/package.json')), '4.0.0_best_int');
}

const MAX_BYTES = 6 * 1024 * 1024;

async function baixar(url: string, ms: number): Promise<Buffer | null> {
  try {
    if (!/^https:\/\//.test(url)) return null;
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), cache: 'no-store' });
    if (!r.ok) return null;
    const tam = Number(r.headers.get('content-length') || 0);
    if (tam > MAX_BYTES) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > MAX_BYTES ? null : b;
  } catch { return null; }
}

/**
 * Lê até `max` imagens dentro do tempo `prazoMs`. Devolve o texto de cada uma.
 * `ok: false` = não conseguiu ler (pacote ausente, imagem quebrada, tempo esgotado): quem chama trata como "sem leitura".
 */
export async function lerTextoDasImagens(urls: string[], opts: { max?: number; prazoMs?: number } = {}): Promise<{ ok: boolean; textos: string[] }> {
  const lista = Array.from(new Set(urls.filter(Boolean))).slice(0, opts.max ?? 3);
  if (!lista.length) return { ok: true, textos: [] };
  const fim = Date.now() + (opts.prazoMs ?? 12000);
  let worker: any = null;
  try {
    const [{ createWorker }, sharpMod] = await Promise.all([import('tesseract.js'), import('sharp')]);
    const sharp: any = (sharpMod as any).default || sharpMod;
    const dados = pastaIdioma();
    worker = await createWorker('por', 1, { langPath: dados, cacheMethod: 'none', gzip: true });
    const textos: string[] = [];
    let todas = true;
    for (const url of lista) {
      const resta = fim - Date.now();
      if (resta < 1500) { todas = false; break; }
      const img = await baixar(url, Math.min(5000, resta));
      if (!img) { todas = false; continue; }
      const base = sharp(img, { failOn: 'none' }).rotate().resize({ width: 1400, withoutEnlargement: false }).grayscale().normalize();
      const [a, b] = await Promise.all([base.clone().png().toBuffer(), base.clone().negate().png().toBuffer()]);
      const r1 = await worker.recognize(a);
      const r2 = Date.now() < fim - 800 ? await worker.recognize(b) : { data: { text: '' } };
      textos.push(`${r1.data.text || ''}\n${r2.data.text || ''}`.trim());
    }
    return { ok: todas, textos };
  } catch (e: any) {
    console.error('[ocr]', e?.message || e);
    return { ok: false, textos: [] };
  } finally {
    try { await worker?.terminate(); } catch { /* ignora */ }
  }
}
