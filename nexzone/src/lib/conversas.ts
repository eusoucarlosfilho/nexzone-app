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
const PADROES_CONTATO: RegExp[] = [
  /wa\.me\//i, /api\.whatsapp\.com/i, /chat\.whatsapp\.com/i, /\bt\.me\//i, /discord\.gg\//i,
  /\b(whats\s?app|whats|wpp|zap|zapzap|telegram|telefone|celular|meu n[uú]mero|me liga|me chama no)\b/i,
  /instagram\.com\//i,
  // celular brasileiro: (DD) 9XXXX-XXXX, com ou sem +55, espaços, pontos ou traços
  /(?:\+?55[\s.-]?)?\(?\b[1-9]{2}\)?[\s.-]?9[\s.-]?\d{4}[\s.-]?\d{4}\b/,
];

/** A mensagem parece passar contato para fora da plataforma? (não bloqueia: marca para o admin e avisa quem enviou) */
export function pareceContatoExterno(texto: string): boolean {
  const t = String(texto || '');
  return PADROES_CONTATO.some((r) => r.test(t));
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
