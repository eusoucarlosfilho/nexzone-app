// Datas no fuso de São Paulo para os painéis administrativos (puro, testável).
export const TZ = 'America/Sao_Paulo';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

export function tzParts(d: Date) {
  const o: Record<string, string> = {};
  partsFmt.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24 };
}

function tzOffset(d: Date) {
  const p = tzParts(d);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return asUtc - d.getTime();
}

/** Meia-noite (no fuso) de N dias atrás em relação a `agora`. */
export function inicioDoDia(diasAtras: number, agora = new Date()): Date {
  const p = tzParts(agora);
  const guess = Date.UTC(p.y, p.m - 1, p.d - diasAtras, 0, 0, 0);
  return new Date(guess - tzOffset(new Date(guess)));
}

/** Meia-noite (no fuso) de uma data AAAA-MM-DD. Null se inválida. */
export function inicioDeData(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
  if (!Number.isFinite(guess)) return null;
  return new Date(guess - tzOffset(new Date(guess)));
}

export const chaveDia = (d: Date) => { const p = tzParts(d); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };

export type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | '90d' | 'custom';

/** Intervalo [de, ate) do período, e o intervalo anterior equivalente (para comparação). */
export function intervalo(periodo: Periodo, deIso?: string | null, ateIso?: string | null, agora = new Date()) {
  let de: Date; let ate: Date;
  if (periodo === 'hoje') { de = inicioDoDia(0, agora); ate = new Date(agora.getTime() + 1); }
  else if (periodo === 'ontem') { de = inicioDoDia(1, agora); ate = inicioDoDia(0, agora); }
  else if (periodo === '7d') { de = inicioDoDia(6, agora); ate = new Date(agora.getTime() + 1); }
  else if (periodo === '30d') { de = inicioDoDia(29, agora); ate = new Date(agora.getTime() + 1); }
  else if (periodo === '90d') { de = inicioDoDia(89, agora); ate = new Date(agora.getTime() + 1); }
  else {
    const a = inicioDeData(deIso || '');
    const b = inicioDeData(ateIso || '');
    de = a || inicioDoDia(29, agora);
    ate = b ? new Date(b.getTime() + 24 * 3600 * 1000) : new Date(agora.getTime() + 1);
    if (ate <= de) ate = new Date(de.getTime() + 24 * 3600 * 1000);
    // teto de 366 dias
    if (ate.getTime() - de.getTime() > 366 * 24 * 3600 * 1000) de = new Date(ate.getTime() - 366 * 24 * 3600 * 1000);
  }
  const dur = ate.getTime() - de.getTime();
  return { de, ate, anteriorDe: new Date(de.getTime() - dur), anteriorAte: de };
}

export function periodoValido(v: unknown): Periodo {
  return v === 'hoje' || v === 'ontem' || v === '7d' || v === '30d' || v === '90d' || v === 'custom' ? v : '30d';
}

/** Variação percentual; null quando a base anterior é zero (sem comparação honesta). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

/** Lista de dias (chaves) entre duas datas, no fuso. */
export function diasEntre(de: Date, ate: Date, max = 120): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let t = de.getTime() + 12 * 3600 * 1000; t < ate.getTime() + 12 * 3600 * 1000 && out.length < max; t += 24 * 3600 * 1000) {
    const k = chaveDia(new Date(Math.min(t, ate.getTime() - 1)));
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}
