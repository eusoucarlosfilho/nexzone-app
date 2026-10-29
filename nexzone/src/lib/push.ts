// ============================================================
// Notificação no celular — partes puras (testáveis): o que vai na notificação e validação da inscrição.
// ============================================================
export type Inscricao = { id: number; endpoint: string; p256dh: string; auth: string };

const ICONE: Record<string, string> = {
  venda: '💰', compra: '🛍️', pagamento: '✅', reembolso: '↩️', mensagem: '💬', pergunta: '❓', resposta: '💬',
  saque: '🏦', anuncio: '📢', aviso: '🔔', advertencia: '⚠️', novidade: '🎮',
  pix_gerado: '⚡', adm_pix: '⚡', adm_venda: '💰',
};

/** Só links internos do site (começando com / e sem //). */
export const linkInterno = (l: unknown) => (typeof l === 'string' && /^\/(?!\/)[^\s]{0,300}$/.test(l) ? l : '/notificacoes');

export function cargaDoPush(n: { id?: number; tipo?: string | null; titulo?: string | null; texto?: string | null; link?: string | null; grupo?: string | null }) {
  const ic = ICONE[String(n.tipo || '')] || '🔔';
  const titulo = `${ic} ${String(n.titulo || 'Comprei Barato').replace(/\s+/g, ' ').trim()}`.slice(0, 80);
  const texto = String(n.texto || 'Toque para ver no Comprei Barato.').replace(/\s+/g, ' ').trim().slice(0, 180);
  return { titulo, texto, url: linkInterno(n.link), tag: String(n.grupo || (n.id ? `n-${n.id}` : 'cb')).slice(0, 64) };
}

/** Valida o objeto que o navegador entrega em pushManager.subscribe(). */
export function validarInscricao(b: any): { ok: true; endpoint: string; p256dh: string; auth: string } | { ok: false; erro: string } {
  const endpoint = String(b?.endpoint || '');
  const p256dh = String(b?.keys?.p256dh || '');
  const auth = String(b?.keys?.auth || '');
  let u: URL;
  try { u = new URL(endpoint); } catch { return { ok: false, erro: 'Inscrição inválida.' }; }
  if (u.protocol !== 'https:' || endpoint.length > 1000) return { ok: false, erro: 'Inscrição inválida.' };
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) return { ok: false, erro: 'Inscrição inválida.' };
  return { ok: true, endpoint, p256dh, auth };
}
