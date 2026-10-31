// Caixa de e-mail: partes que usam criptografia (SÓ SERVIDOR). Testado em testes/caixa-email.test.js.
import crypto from 'crypto';
import { DOMINIO } from './caixaEmail';

/**
 * Confere a assinatura do webhook (Resend usa Svix):
 *   conteúdo assinado = `${svix-id}.${svix-timestamp}.${corpo}`, HMAC-SHA256 com o segredo (whsec_… em base64)
 *   cabeçalho svix-signature = "v1,<base64> v1,<base64>" (pode ter mais de uma)
 * Recusa aviso com mais de 5 minutos (evita reenvio de aviso antigo).
 */
export function assinaturaValida(segredo: string, h: { id: string | null; timestamp: string | null; assinatura: string | null }, corpo: string, agoraSeg = Math.floor(Date.now() / 1000)): boolean {
  if (!segredo || !h.id || !h.timestamp || !h.assinatura) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(agoraSeg - ts) > 300) return false;
  const chave = Buffer.from(segredo.replace(/^whsec_/, ''), 'base64');
  if (!chave.length) return false;
  const esperado = crypto.createHmac('sha256', chave).update(`${h.id}.${h.timestamp}.${corpo}`).digest();
  return h.assinatura.split(' ').some((parte) => {
    const [versao, valor] = parte.split(',');
    if (versao !== 'v1' || !valor) return false;
    const recebido = Buffer.from(valor, 'base64');
    return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
  });
}

/** Message-ID que nós geramos ao enviar (para a resposta voltar para a mesma conversa). */
export const novoMessageId = () => `<${Date.now().toString(36)}.${crypto.randomBytes(8).toString('hex')}@${DOMINIO}>`;

