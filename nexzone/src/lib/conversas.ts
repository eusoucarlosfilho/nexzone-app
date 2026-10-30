// Conversas do pedido (puro, testado em testes/conversas.test.js):
// entrega marcada pelo vendedor, etiquetas da lista, "Enviado/Lido", anexos e alerta de contato externo.
import { ehSoLink } from './textoFormatado';

// ---------- Entrega ----------
/**
 * Entregue de verdade? O pagamento sempre deixa o status 'entregue' (liberação do conteúdo),
 * mas quem confirma a entrega é o VENDEDOR. Só é automático quando o comprador já recebe sozinho:
 * arquivo para baixar, área de membros ou um link direto (e não é conta/item/moeda/serviço).
 */
export function entregaEfetiva(o: { status: string; entrega_confirmada_em?: string | null }, auto: { manual: boolean; temArquivo: boolean; temCurso: boolean; conteudo: string | null }): boolean {
  if (!['pago', 'entregue'].includes(o.status)) return false;
  if (o.entrega_confirmada_em) return true;
  if (auto.manual) return false;
  return auto.temArquivo || auto.temCurso || ehSoLink(auto.conteudo);
}

// ---------- Etiquetas da lista de conversas ----------
export type Etiqueta = { id: 'reembolso' | 'entregue' | 'nova' | 'conversando' | 'entregar' | 'reembolsado'; rotulo: string; cor: string; fundo: string };
export const ETIQUETAS: Record<Etiqueta['id'], Etiqueta> = {
  entregar:    { id: 'entregar',    rotulo: 'Entregar',         cor: '#9A5B00', fundo: '#FFF1D6' },
  nova:        { id: 'nova',        rotulo: 'Nova mensagem',    cor: '#B84A00', fundo: '#FFE7D6' },
  conversando: { id: 'conversando', rotulo: 'Conversando',      cor: '#1F5FBF', fundo: '#E3EEFF' },
  entregue:    { id: 'entregue',    rotulo: 'Entregue',         cor: '#00875A', fundo: '#E3F6EE' },
  reembolso:   { id: 'reembolso',   rotulo: 'Reembolso pedido', cor: '#C62828', fundo: '#FDEBEB' },
  reembolsado: { id: 'reembolsado', rotulo: 'Reembolsado',      cor: '#6B6B80', fundo: '#EEEEF3' },
};

export type MsgResumo = { papel: string; created_at: string };

/** Etiqueta principal + se há mensagem do cliente que o vendedor ainda não viu. */
export function etiquetaConversa(p: { status: string; entregue: boolean; reembolsoAberto: boolean; msgs: MsgResumo[]; vistoEm: string | null }): { etiqueta: Etiqueta; naoLida: boolean } {
  const doCliente = p.msgs.filter((m) => m.papel === 'comprador');
  const ultimaCliente = doCliente.length ? doCliente.reduce((a, b) => (a.created_at > b.created_at ? a : b)) : null;
  const visto = p.vistoEm ? new Date(p.vistoEm).getTime() : 0;
  const naoLida = !!ultimaCliente && new Date(ultimaCliente.created_at).getTime() > visto;
  let id: Etiqueta['id'];
  if (p.status === 'reembolsado') id = 'reembolsado';
  else if (p.reembolsoAberto) id = 'reembolso';
  else if (p.entregue) id = 'entregue';
  else if (naoLida) id = 'nova';
  else if (doCliente.length || p.msgs.some((m) => m.papel === 'vendedor')) id = 'conversando';
  else id = 'entregar';
  return { etiqueta: ETIQUETAS[id], naoLida };
}

// ---------- Enviado / Lido ----------
/** A mensagem foi vista pela outra parte? (o admin olhando não conta) */
export function foiLida(criadaEm: string, vistoOutro: string | null | undefined): boolean {
  if (!vistoOutro) return false;
  return new Date(vistoOutro).getTime() >= new Date(criadaEm).getTime();
}

// ---------- Contato externo ----------
// Dois níveis (decisão do Carlos, 30/10):
//   RETER (rigoroso) — WhatsApp e número de telefone: a mensagem não chega à outra parte e o admin analisa.
//   ATENÇÃO (discreto) — e-mail, "contato/ctt", Telegram, Instagram, Discord…: a mensagem PASSA normal
//     (tem produto que é entregue por e-mail), ninguém vê aviso, e o admin recebe uma notificação para conferir.
const PADROES_RETER: RegExp[] = [
  /wa\.me\//i, /api\.whatsapp\.com/i, /chat\.whatsapp\.com/i, /whatsapp\.com\//i,
  // celular brasileiro: (DD) 9XXXX-XXXX, com ou sem +55, espaços, pontos ou traços
  /(?:\+?55[\s.-]?)?\(?\b[1-9]{2}\)?[\s.-]?9[\s.-]?\d{4}[\s.-]?\d{4}\b/,
];
const PADROES_ATENCAO: RegExp[] = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,       // e-mail
  /\bt\.me\//i, /discord\.gg\//i, /instagram\.com\//i, /facebook\.com\//i, /tiktok\.com\//i,
];
// para os testes antigos e quem importava
const PADROES_CONTATO = PADROES_RETER;

// Palavras proibidas (depois de normalizar: sem acento, minúsculas, letras soltas juntadas, 0→o, 3→e, 4→a, 1→i, 5→s, @→a)
const PALAVRAS_RETER = /\b(whats?app\w*|whats\w*|wh?ats\w*|uats\w*|wats\w*|wpp\w*|wts|wpzap|zap|zaps|zapzap|zapp|zp)\b/;
const PALAVRAS_ATENCAO = /\b(meu numero|me liga\w*|chama no|chama la fora|ctt|ctts|contato\w*|contatar|telegram\w*|insta|instagram\w*|discord\w*|tiktok|facebook|fb)\b/;

/** Deixa o texto num formato só para conferir (ninguém vê): tira acento e truques como "w h a t s", "z.a.p", "c0ntat0". */
export function normalizarParaFiltro(texto: string): string {
  let t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/0/g, 'o').replace(/3/g, 'e').replace(/4/g, 'a').replace(/1/g, 'i').replace(/5/g, 's').replace(/@/g, 'a').replace(/\$/g, 's');
  // letras soltas separadas por espaço, ponto, traço ou asterisco viram uma palavra: "w h a t s" → "whats"
  t = t.replace(/\b(?:[a-z][\s.\-_*|]{1,3}){2,}[a-z]\b/g, (m) => m.replace(/[\s.\-_*|]+/g, ''));
  return t.replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export type NivelContato = 'reter' | 'atencao' | null;
/** WhatsApp/telefone → 'reter'; e-mail e outras redes → 'atencao' (passa, admin confere); resto → null. */
export function classificarContato(texto: string): NivelContato {
  const t = String(texto || '');
  if (PADROES_CONTATO.some((r) => r.test(t))) return 'reter';
  // o e-mail é conferido ANTES de normalizar (o "@" vira "a" na normalização)
  const n = normalizarParaFiltro(t.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' '));
  if (PALAVRAS_RETER.test(n)) return 'reter';
  if (PADROES_ATENCAO.some((r) => r.test(t)) || PALAVRAS_ATENCAO.test(n)) return 'atencao';
  return null;
}
/** A mensagem fica RETIDA? (só WhatsApp e telefone) */
export function pareceContatoExterno(texto: string): boolean {
  return classificarContato(texto) === 'reter';
}

export const TEXTO_RETIDA = '🔒 Mensagem retida para análise do suporte.';
export const AVISO_RETIDA = '⚠️ Uma mensagem foi retida e o suporte foi avisado. Passar WhatsApp ou telefone para negociar fora do Comprei Barato é proibido e pode suspender a conta.';

// ---------- Reclamação, reembolso e fechamento do chat ----------
/** Motivos que valem desde o primeiro minuto (direito de arrependimento). */
export const MOTIVOS_IMEDIATOS = ['arrependimento', 'comprei_sem_querer'];
export const ESPERA_RECLAMACAO_H = 24;

/** Reclamação por problema ("não recebi", "não funciona"...) só depois de 24 h, a não ser que o vendedor já tenha marcado como entregue. */
export function podeReclamar(p: { pagoEm: string | null; entregue: boolean; motivo?: string | null }, agora = Date.now()): { pode: boolean; liberaEm: string | null } {
  if (p.motivo && MOTIVOS_IMEDIATOS.includes(p.motivo)) return { pode: true, liberaEm: null };
  if (p.entregue) return { pode: true, liberaEm: null };
  const t = p.pagoEm ? new Date(p.pagoEm).getTime() : NaN;
  if (!Number.isFinite(t)) return { pode: true, liberaEm: null };
  const libera = t + ESPERA_RECLAMACAO_H * 3600000;
  return agora >= libera ? { pode: true, liberaEm: null } : { pode: false, liberaEm: new Date(libera).toISOString() };
}

/** O chat fecha quando termina a garantia (ou na hora, se a venda foi reembolsada). Enquanto houver reembolso ou reclamação aberta, fica aberto. */
export function situacaoChat(p: { status: string; fimGarantia: string | null; reembolsoAberto: boolean; reclamacaoAberta: boolean }, agora = Date.now()): { fechado: boolean; fechaEm: string | null } {
  if (p.reembolsoAberto || p.reclamacaoAberta) return { fechado: false, fechaEm: null };
  if (p.status === 'reembolsado' || p.status === 'cancelado') return { fechado: true, fechaEm: null };
  if (!p.fimGarantia) return { fechado: false, fechaEm: null };
  return { fechado: agora >= new Date(p.fimGarantia).getTime(), fechaEm: p.fimGarantia };
}

export const AVISO_SEGURANCA = 'Para a segurança de vocês, é proibido trocar telefone, WhatsApp, redes sociais ou combinar pagamento fora do Comprei Barato. Fora daqui não existe garantia, e a conta pode ser suspensa.';

/** E-mail do cliente para o vendedor: só o começo e o domínio (jo***@gmail.com). */
export function mascararEmail(e: string | null | undefined): string {
  const s = String(e || '').trim();
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(s);
  if (!m) return s ? 'Cliente' : '';
  const u = m[1];
  return `${u.slice(0, Math.min(2, u.length))}***@${m[2]}`;
}

// ---------- Anexos ----------
export const BUCKET_CHAT = 'chat-anexos';
export const ANEXO_CHAT_MAX = 10 * 1024 * 1024;
export const ANEXO_CHAT_TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'] as const;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };
export const extDoTipo = (t: string) => EXT[t] || null;

export function validarAnexoChat(tipo: string, tamanho: number): string | null {
  if (!(ANEXO_CHAT_TIPOS as readonly string[]).includes(tipo)) return 'Envie uma imagem (PNG, JPG, WEBP, GIF) ou PDF.';
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > ANEXO_CHAT_MAX) return 'O anexo pode ter no máximo 10 MB.';
  return null;
}

/** O caminho do anexo pertence a este pedido? (o upload é sempre em <pedido>/<uuid>.<ext>) */
export function caminhoDoPedido(path: unknown, orderId: string): boolean {
  const p = String(path || '');
  return p.startsWith(`${orderId}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif|pdf)$/i.test(p);
}

/** Tipo real pelos primeiros bytes (não confia no nome nem no tipo informado pelo navegador). */
export function tipoPelosBytes(b: Uint8Array): string | null {
  const h = (i: number) => b[i];
  if (b.length >= 8 && h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47) return 'image/png';
  if (b.length >= 3 && h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return 'image/jpeg';
  if (b.length >= 6 && h(0) === 0x47 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x38) return 'image/gif';
  if (b.length >= 12 && h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46 && h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50) return 'image/webp';
  if (b.length >= 5 && h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46 && h(4) === 0x2d) return 'application/pdf';
  return null;
}

export function nomeSeguro(n: unknown): string {
  const s = String(n || 'anexo').replace(/[\\/<>:"|?*\u0000-\u001f]/g, '').trim().slice(0, 80);
  return s || 'anexo';
}

export const tamanhoLegivel = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// ---------- Produto enviado no chat ----------
const RE_PRODUTO = /https?:\/\/(?:www\.)?compreibarato\.com\.br\/(?:produto|checkout)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[^\s]*/gi;

/** Ids de produtos do Comprei Barato citados por link na mensagem (/produto/<id> ou /checkout/<id>). */
export function produtosNaMensagem(texto: string): string[] {
  const out: string[] = [];
  for (const m of String(texto || '').matchAll(RE_PRODUTO)) { const id = m[1].toLowerCase(); if (!out.includes(id)) out.push(id); }
  return out.slice(0, 3);
}

/** Texto sem os links de produto (eles viram cartão). Vazio = a mensagem era só o link. */
export function textoSemLinksDeProduto(texto: string): string {
  return String(texto || '').replace(RE_PRODUTO, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const linkDoProduto = (site: string, id: string) => `${site.replace(/\/+$/, '')}/produto/${id}`;
