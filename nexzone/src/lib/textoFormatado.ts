// ============================================================
// Texto com formatação simples (mensagem pós-compra e chat do pedido).
// Guardado como TEXTO com marcações leves — nunca HTML — e desenhado como elementos React,
// então não há como injetar script/HTML pelo conteúdo.
//
//   **negrito**   _itálico_ (ou *itálico*)   ~~riscado~~
//   - item de lista        1. item numerado
//   [texto do link](https://…)   e links https://… soltos viram clicáveis
// ============================================================

export const MSG_MAX = 2000;

export type Inline =
  | { t: 'txt'; v: string }
  | { t: 'b' | 'i' | 's'; c: Inline[] }
  | { t: 'a'; href: string; c: Inline[] };

export type Bloco =
  | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; itens: Inline[][] }
  | { t: 'vazio' };

/** Só links http(s) válidos; qualquer outra coisa (javascript:, data:…) vira texto. */
export function linkSeguro(u: string): string | null {
  try {
    const url = new URL(u.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

const RE = /(\*\*([^*\n]+?)\*\*)|(~~([^~\n]+?)~~)|(\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>"')\]]+)|((?<![\w])_([^_\n]+?)_(?![\w]))|(\*([^*\n]+?)\*)/g;

export function parseInline(s: string, prof = 0): Inline[] {
  const out: Inline[] = [];
  if (!s) return out;
  if (prof > 4) return [{ t: 'txt', v: s }];
  let ult = 0;
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(RE.source, 'g');
  while ((m = re.exec(s))) {
    if (m.index > ult) out.push({ t: 'txt', v: s.slice(ult, m.index) });
    if (m[1]) out.push({ t: 'b', c: parseInline(m[2], prof + 1) });
    else if (m[3]) out.push({ t: 's', c: parseInline(m[4], prof + 1) });
    else if (m[5]) {
      const href = linkSeguro(m[7]);
      out.push(href ? { t: 'a', href, c: parseInline(m[6], prof + 1) } : { t: 'txt', v: m[0] });
    } else if (m[8]) {
      // ponto/vírgula no fim da URL ficam fora do link
      let u = m[8]; let resto = '';
      while (/[.,;:!?]$/.test(u)) { resto = u.slice(-1) + resto; u = u.slice(0, -1); }
      const href = linkSeguro(u);
      out.push(href ? { t: 'a', href, c: [{ t: 'txt', v: u }] } : { t: 'txt', v: u });
      if (resto) out.push({ t: 'txt', v: resto });
    } else if (m[9]) out.push({ t: 'i', c: parseInline(m[10], prof + 1) });
    else if (m[11]) out.push({ t: 'i', c: parseInline(m[12], prof + 1) });
    ult = m.index + m[0].length;
  }
  if (ult < s.length) out.push({ t: 'txt', v: s.slice(ult) });
  // junta textos vizinhos
  return out.reduce<Inline[]>((acc, x) => {
    const a = acc[acc.length - 1];
    if (x.t === 'txt' && a && a.t === 'txt') a.v += x.v; else acc.push(x);
    return acc;
  }, []);
}

export function parseTexto(texto: string): Bloco[] {
  const linhas = String(texto ?? '').replace(/\r\n?/g, '\n').slice(0, 20000).split('\n');
  const blocos: Bloco[] = [];
  for (const linha of linhas) {
    const ul = /^\s*[-•]\s+(.*)$/.exec(linha);
    const ol = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(linha);
    const ant = blocos[blocos.length - 1];
    if (ul) {
      if (ant && ant.t === 'ul') ant.itens.push(parseInline(ul[1])); else blocos.push({ t: 'ul', itens: [parseInline(ul[1])] });
    } else if (ol) {
      if (ant && ant.t === 'ol') ant.itens.push(parseInline(ol[1])); else blocos.push({ t: 'ol', itens: [parseInline(ol[1])] });
    } else if (!linha.trim()) {
      blocos.push({ t: 'vazio' });
    } else {
      blocos.push({ t: 'p', c: parseInline(linha) });
    }
  }
  // tira linhas vazias do começo e do fim
  while (blocos.length && blocos[0].t === 'vazio') blocos.shift();
  while (blocos.length && blocos[blocos.length - 1].t === 'vazio') blocos.pop();
  return blocos;
}

/** Versão sem marcações (prévias, notificações). */
export function textoPuro(texto: string): string {
  const inl = (c: Inline[]): string => c.map((x) => (x.t === 'txt' ? x.v : x.t === 'a' ? (inl(x.c) === x.href ? x.href : `${inl(x.c)} (${x.href})`) : inl(x.c))).join('');
  return parseTexto(texto).map((b) => b.t === 'p' ? inl(b.c) : b.t === 'vazio' ? '' : b.itens.map((it, i) => `${b.t === 'ol' ? `${i + 1}.` : '•'} ${inl(it)}`).join('\n')).join('\n');
}

/** É só um link (sem mais nada)? Usado para mostrar o botão "Acessar produto". */
export function ehSoLink(texto: string | null | undefined): boolean {
  const s = String(texto ?? '').trim();
  return /^https?:\/\/\S+$/.test(s) && !!linkSeguro(s);
}
