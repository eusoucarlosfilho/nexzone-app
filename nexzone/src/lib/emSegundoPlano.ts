// Deixa uma tarefa terminar depois que a resposta já foi enviada (ex.: as 4 mensagens do Pix no WhatsApp).
// Na Vercel usa o waitUntil do próprio ambiente (o mesmo que o pacote @vercel/functions usa por dentro);
// fora dela a tarefa simplesmente continua rodando. Nunca lança erro.
export function emSegundoPlano(tarefa: Promise<unknown>): void {
  const p = tarefa.catch(() => null);
  try {
    const ctx = (globalThis as any)[Symbol.for('@vercel/request-context')]?.get?.();
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p);
  } catch { /* sem contexto da Vercel: segue normal */ }
}
