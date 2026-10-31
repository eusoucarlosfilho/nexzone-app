// ============================================================
// Caixa de e-mail do admin (puro, testado em testes/caixa-email.test.js)
//   - ler endereços ("Nome <a@b.com>"), montar a prévia, a conversa e o "Re:"
// ============================================================

export const DOMINIO = 'compreibarato.com.br';
export const PASTAS = ['entrada', 'enviados', 'arquivo', 'lixeira', 'spam'] as const;
export type Pasta = typeof PASTAS[number];

/** "Fulano de Tal <fulano@x.com>" → { nome, email }. Aceita só o e-mail também. */
export function lerEndereco(bruto: unknown): { nome: string | null; email: string } {
  const s = String(bruto ?? '').trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
  if (m) return { nome: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { nome: null, email: s.replace(/^<|>$/g, '').trim().toLowerCase() };
}

export const emailValido = (e: string) => /^[^\s@<>,;]{1,64}@[^\s@<>,;]{1,190}\.[a-z]{2,24}$/i.test(String(e || '').trim());

/** Lista digitada ("a@x.com, b@y.com; c@z.com") → e-mails válidos, sem repetir, até 20. */
export function listaDeEmails(bruto: unknown): { validos: string[]; invalidos: string[] } {
  const partes = (Array.isArray(bruto) ? bruto : String(bruto ?? '').split(/[,;\n]/)).map((x) => lerEndereco(x).email).filter(Boolean);
  const validos: string[] = [], invalidos: string[] = [];
  for (const p of partes) (emailValido(p) ? (validos.includes(p) ? null : validos.push(p)) : invalidos.push(p));
  return { validos: validos.slice(0, 20), invalidos };
}

/** É um endereço nosso (@compreibarato.com.br)? */
export const ehNosso = (e: string) => lerEndereco(e).email.endsWith('@' + DOMINIO);

/** Texto puro a partir do HTML (para a prévia e para busca), sem estilos nem scripts. */
export function textoDoHtml(html: string | null | undefined): string {
  return String(html || '')
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export function previaDe(texto: string | null | undefined, html?: string | null): string {
  const t = (texto && texto.trim()) ? texto : textoDoHtml(html);
  return t.replace(/\s+/g, ' ').trim().slice(0, 180);
}

/** "Re: Re: Assunto" → "Re: Assunto" (e "Fwd:" para encaminhar). */
export function assuntoResposta(assunto: string, tipo: 're' | 'fwd' = 're'): string {
  const base = String(assunto || '').replace(/^\s*((re|res|fw|fwd|enc)\s*:\s*)+/i, '').trim() || '(sem assunto)';
  return `${tipo === 're' ? 'Re' : 'Fwd'}: ${base}`;
}

/**
 * Conversa: a 1ª mensagem do fio. Usa o 1º item de References, senão In-Reply-To, senão o próprio Message-ID.
 * Assim a resposta do cliente cai junto com o e-mail que mandamos.
 */
export function chaveConversa(h: { messageId?: string | null; inReplyTo?: string | null; references?: string | null }): string {
  const ids = (s: string | null | undefined) => (String(s || '').match(/<[^>]+>/g) || []).map((x) => x.toLowerCase());
  const refs = ids(h.references);
  if (refs.length) return refs[0];
  const irt = ids(h.inReplyTo);
  if (irt.length) return irt[0];
  const proprio = ids(h.messageId);
  return proprio[0] || `<sem-id-${Date.now()}-${Math.random().toString(36).slice(2)}@${DOMINIO}>`;
}

/** Texto digitado no admin → HTML simples e seguro (quebra de linha, links). */
export function htmlDoTexto(texto: string): string {
  const esc = String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const comLinks = esc.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1">$1</a>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#16162A">${comLinks.replace(/\n/g, '<br>')}</div>`;
}

/** Citação do e-mail anterior no fim da resposta (como o Gmail faz). */
export function citacao(m: { de: string; de_nome?: string | null; criado_em: string; texto?: string | null; html?: string | null }): string {
  const quando = new Date(m.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const quem = m.de_nome ? `${m.de_nome} <${m.de}>` : m.de;
  const corpo = (m.texto && m.texto.trim()) ? m.texto : textoDoHtml(m.html);
  return `\n\nEm ${quando}, ${quem} escreveu:\n` + corpo.split('\n').slice(0, 200).map((l) => '> ' + l).join('\n');
}

/** HTML do e-mail recebido pronto para exibir num iframe isolado: links abrem fora e nada roda. */
export function htmlParaExibir(html: string | null | undefined, texto?: string | null): string {
  const corpo = html && html.trim() ? html : `<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:14px">${String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;
  const semScripts = corpo.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#16162A;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${semScripts}</body></html>`;
}

export function tamanhoLegivel(bytes: number): string {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
