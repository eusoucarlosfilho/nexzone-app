// Filtro de período do admin (puro, testado em testes/periodo.test.js). Tudo no horário de Brasília (UTC-3).
export type Preset = 'tudo' | 'hoje' | 'ontem' | '7d' | '30d' | 'mes' | 'mes_passado' | 'dia' | 'mes_escolhido' | 'periodo';
export const PRESETS: [Preset, string][] = [
  ['tudo', 'Tudo'], ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'],
  ['mes', 'Este mês'], ['mes_passado', 'Mês passado'], ['dia', 'Um dia'], ['mes_escolhido', 'Um mês'], ['periodo', 'De… até…'],
];
const FUSO = 3 * 3600000; // Brasília
const DIA = 86400000;

/** Meia-noite (Brasília) do dia de `ms`, em ms UTC. */
export function inicioDoDia(ms: number): number {
  return Math.floor((ms - FUSO) / DIA) * DIA + FUSO;
}
/** "2026-10-31" → meia-noite de Brasília daquele dia. */
export const doDia = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? Date.parse(`${ymd}T00:00:00-03:00`) : NaN);
/** "2026-10" → meia-noite de Brasília do dia 1. */
export const doMes = (ym: string) => (/^\d{4}-\d{2}$/.test(ym) ? Date.parse(`${ym}-01T00:00:00-03:00`) : NaN);
function proximoMes(ms: number): number {
  const d = new Date(ms - FUSO);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) + FUSO;
}
/** Data de hoje em Brasília: "2026-10-31". */
export const hojeYMD = (agora = Date.now()) => new Date(agora - FUSO).toISOString().slice(0, 10);

/** Intervalo [ini, fim) em ms. `null` = sem filtro (ou campos ainda incompletos). */
export function intervalo(p: Preset, v: { dia?: string; mes?: string; de?: string; ate?: string } = {}, agora = Date.now()): { ini: number; fim: number } | null {
  const hoje = inicioDoDia(agora);
  switch (p) {
    case 'hoje': return { ini: hoje, fim: hoje + DIA };
    case 'ontem': return { ini: hoje - DIA, fim: hoje };
    case '7d': return { ini: hoje - 6 * DIA, fim: hoje + DIA };
    case '30d': return { ini: hoje - 29 * DIA, fim: hoje + DIA };
    case 'mes': { const ini = doMes(hojeYMD(agora).slice(0, 7)); return { ini, fim: proximoMes(ini) }; }
    case 'mes_passado': { const atual = doMes(hojeYMD(agora).slice(0, 7)); const ini = doMes(hojeYMD(atual - DIA).slice(0, 7)); return { ini, fim: atual }; }
    case 'dia': { const ini = doDia(v.dia || ''); return Number.isFinite(ini) ? { ini, fim: ini + DIA } : null; }
    case 'mes_escolhido': { const ini = doMes(v.mes || ''); return Number.isFinite(ini) ? { ini, fim: proximoMes(ini) } : null; }
    case 'periodo': {
      const ini = doDia(v.de || ''), ate = doDia(v.ate || '');
      if (!Number.isFinite(ini) && !Number.isFinite(ate)) return null;
      const a = Number.isFinite(ini) ? ini : 0, b = Number.isFinite(ate) ? ate + DIA : Number.MAX_SAFE_INTEGER;
      return a <= b ? { ini: a, fim: b } : { ini: b - DIA, fim: a + DIA }; // datas invertidas: troca
    }
    default: return null;
  }
}

export const dentro = (iso: string | null | undefined, r: { ini: number; fim: number } | null) => {
  if (!r) return true;
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) && t >= r.ini && t < r.fim;
};
