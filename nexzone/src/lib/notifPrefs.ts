// Preferências de notificação do vendedor, guardadas NESTE navegador (sem tabela nesta etapa).
// Controlam o que aparece no sino e nos avisos rápidos do painel.

export type TipoNotif = 'pergunta' | 'mensagem' | 'pedido';
export type Prefs = Record<TipoNotif, boolean>;
export const PREFS_PADRAO: Prefs = { pergunta: true, mensagem: true, pedido: true };
const CHAVE = 'cb_notif_prefs';

export function lerPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (v && typeof v === 'object') return { ...PREFS_PADRAO, ...Object.fromEntries(Object.entries(v).filter(([k, b]) => k in PREFS_PADRAO && typeof b === 'boolean')) };
  } catch {}
  return { ...PREFS_PADRAO };
}

export function gravarPrefs(p: Prefs) {
  try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch {}
  try { window.dispatchEvent(new Event('cb-notif-prefs')); } catch {}
}
