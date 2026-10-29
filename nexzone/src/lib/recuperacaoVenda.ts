// ============================================================
// Recuperação de pedido não pago — partes puras (testáveis).
// O vendedor (e o admin) chamam o comprador no WhatsApp com uma mensagem pronta e o link para finalizar.
// ============================================================
export const primeiroNome = (n: unknown) => String(n || '').trim().split(/\s+/)[0] || '';

/** Mensagem de recuperação: curta, sem pressão, com o link do checkout do produto. */
export function mensagemRecuperacao(o: { nome?: string | null; produto: string; loja?: string | null; link: string }) {
  const p = primeiroNome(o.nome);
  return [
    `Oi${p ? `, ${p}` : ''}! Aqui é ${o.loja ? `da ${o.loja}, ` : ''}do Comprei Barato.`,
    `Vi que você começou a compra de "${o.produto}" e o pagamento ainda não foi concluído.`,
    `Se ainda quiser, é só finalizar por aqui: ${o.link}`,
    'Ficou alguma dúvida? Te ajudo agora.',
  ].join('\n');
}

/** Link do WhatsApp com a mensagem pronta. Só número brasileiro válido (55 + DDD + número). */
export function linkWhatsapp(numero: unknown, texto: string): string | null {
  const n = String(numero || '').replace(/\D/g, '');
  if (!/^55\d{10,11}$/.test(n)) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/** "há 25 min", "há 3 h", "há 2 dias". */
export function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** WhatsApp formatado para leitura: (63) 99999-8888. */
export function foneLegivel(numero: unknown): string {
  const n = String(numero || '').replace(/\D/g, '').replace(/^55/, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}
