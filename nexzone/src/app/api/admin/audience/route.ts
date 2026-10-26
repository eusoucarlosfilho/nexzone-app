import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro } from '@/lib/ofertas/adminSeguro';

export const dynamic = 'force-dynamic';

const TZ = 'America/Sao_Paulo';
const ONLINE_MS = 2 * 60 * 1000;
const MAX_SESSIONS = 20000;
const MAX_PAGEVIEWS = 50000;
const PAGE = 1000; // limite padrão de linhas por requisição do PostgREST/Supabase

type Range = 'today' | '7d' | '30d' | '90d';
const RANGE_DAYS: Record<Range, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

// ---------- fuso horário (America/Sao_Paulo) ----------
const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});
function tzParts(d: Date) {
  const o: Record<string, string> = {};
  partsFmt.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24 };
}
/** Offset (ms) do fuso em relação ao UTC para o instante dado. */
function tzOffset(d: Date) {
  const p = tzParts(d);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return asUtc - d.getTime();
}
/** Meia-noite (no fuso) de N dias atrás, como Date UTC. */
function startOfDayTz(daysAgo: number) {
  const now = new Date();
  const p = tzParts(now);
  const guess = Date.UTC(p.y, p.m - 1, p.d - daysAgo, 0, 0, 0);
  return new Date(guess - tzOffset(new Date(guess)));
}
const dayKey = (d: Date) => { const p = tzParts(d); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
const hourKey = (d: Date) => `${dayKey(d)}T${String(tzParts(d).h).padStart(2, '0')}`;

// ---------- auxiliares ----------
async function fetchAll<T>(build: (from: number, to: number) => any, cap: number): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const to = Math.min(from + PAGE, cap) - 1;
    const { data, error } = await build(from, to);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < to - from + 1) break;
  }
  return out;
}

function top(map: Map<string, number>, n: number) {
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value).slice(0, n);
}
const inc = (m: Map<string, number>, k: string, v = 1) => m.set(k, (m.get(k) || 0) + v);

function refHost(ref: string | null, ownHost: string) {
  if (!ref) return 'Direto';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase();
    if (!h) return 'Direto';
    if (ownHost && (h === ownHost || h.endsWith('.' + ownHost))) return 'Direto';
    if (/(^|\.)(l\.)?facebook\.com$|^fb\.|^m\.facebook/.test(h)) return 'facebook.com';
    if (/(^|\.)instagram\.com$/.test(h)) return 'instagram.com';
    if (/(^|\.)google\./.test(h)) return 'google';
    if (/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/.test(h)) return 'x.com';
    return h;
  } catch { return 'Direto'; }
}

async function isAdmin() {
  // V3: exige a autorização reforçada (C1): perfil admin + id em ADMIN_USER_IDS.
  try { return (await adminSeguro()).ok; } catch { return false; }
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const rangeParam = sp.get('range') as Range;
  const range: Range = rangeParam in RANGE_DAYS ? rangeParam : 'today';
  const onlyOnline = sp.get('only') === 'online';
  const admin = createAdminClient();
  const nowMs = Date.now();

  // ----- online agora -----
  const onlineSince = new Date(nowMs - ONLINE_MS).toISOString();
  let onlineCount = 0;
  let onlineList: any[] = [];
  try {
    const { data, count } = await admin.from('site_sessions')
      .select('id', { count: 'exact', head: true })
      .gt('last_seen', onlineSince);
    onlineCount = count ?? 0;
    onlineList = []; // V3: sem lista individual (sem trajetória nem localização de ninguém)
    void data;
  } catch { /* tabela pode não existir ainda */ }

  const online = { count: onlineCount, sessions: onlineList };
  if (onlyOnline) return NextResponse.json({ online, now: new Date(nowMs).toISOString() }, { headers: { 'Cache-Control': 'no-store' } });

  // ----- dados do período -----
  const start = startOfDayTz(RANGE_DAYS[range] - 1);
  const startIso = start.toISOString();

  const [sessions, pageviews] = await Promise.all([
    fetchAll<any>((f, t) => admin.from('site_sessions')
      .select('id, visitor_id, started_at, country, region, city, lat, lon, device, referrer, pageviews')
      .gte('started_at', startIso).order('started_at', { ascending: false }).range(f, t), MAX_SESSIONS).catch(() => []),
    fetchAll<any>((f, t) => admin.from('site_pageviews')
      .select('path, created_at')
      .gte('created_at', startIso).order('created_at', { ascending: false }).range(f, t), MAX_PAGEVIEWS).catch(() => []),
  ]);

  // ----- novos vs recorrentes -----
  const visitorIds = Array.from(new Set(sessions.map((s) => s.visitor_id).filter(Boolean)));
  const returningSet = new Set<string>();
  const checkIds = visitorIds.slice(0, 6000);
  const CHUNK = 150;
  const chunks: string[][] = [];
  for (let i = 0; i < checkIds.length; i += CHUNK) chunks.push(checkIds.slice(i, i + CHUNK));
  for (let i = 0; i < chunks.length; i += 6) {
    await Promise.all(chunks.slice(i, i + 6).map(async (ids) => {
      try {
        const { data } = await admin.from('site_sessions').select('visitor_id')
          .in('visitor_id', ids).lt('started_at', startIso).limit(PAGE);
        ((data as any[]) || []).forEach((r) => returningSet.add(r.visitor_id));
      } catch {}
    }));
  }
  const returning = returningSet.size;
  const newVisitors = Math.max(0, visitorIds.length - returning);

  // ----- série temporal -----
  const isToday = range === 'today';
  const buckets: { key: string; label: string; sessions: number; pageviews: number }[] = [];
  const idx = new Map<string, number>();
  if (isToday) {
    const curHour = tzParts(new Date(nowMs)).h;
    const dk = dayKey(new Date(nowMs));
    for (let h = 0; h <= curHour; h++) {
      const key = `${dk}T${String(h).padStart(2, '0')}`;
      idx.set(key, buckets.length);
      buckets.push({ key, label: `${String(h).padStart(2, '0')}h`, sessions: 0, pageviews: 0 });
    }
  } else {
    for (let i = RANGE_DAYS[range] - 1; i >= 0; i--) {
      const d = new Date(startOfDayTz(i).getTime() + 12 * 3600 * 1000); // meio-dia evita bordas
      const key = dayKey(d);
      if (idx.has(key)) continue;
      const [, m, dd] = key.split('-');
      idx.set(key, buckets.length);
      buckets.push({ key, label: `${dd}/${m}`, sessions: 0, pageviews: 0 });
    }
  }
  const bkey = (iso: string) => (isToday ? hourKey(new Date(iso)) : dayKey(new Date(iso)));

  // ----- agregações -----
  const countries = new Map<string, number>();
  const states = new Map<string, number>();
  const cities = new Map<string, number>();
  const devices = new Map<string, number>();
  const refs = new Map<string, number>();
  const pages = new Map<string, number>();
  const points = new Map<string, { lat: number; lon: number; count: number; city: string | null; region: string | null; country: string | null }>();
  const ownHost = (req.headers.get('host') || '').replace(/^www\./, '').split(':')[0].toLowerCase();

  let pvFromSessions = 0;
  for (const s of sessions) {
    const b = idx.get(bkey(s.started_at));
    if (b !== undefined) buckets[b].sessions++;
    pvFromSessions += Number(s.pageviews || 0);
    if (s.country) inc(countries, s.country);
    if (s.country === 'BR' && s.region) inc(states, String(s.region).toUpperCase());
    if (s.city) inc(cities, `${s.city}|${s.region || ''}|${s.country || ''}`);
    inc(devices, s.device || 'desktop');
    inc(refs, refHost(s.referrer, ownHost));
    if (typeof s.lat === 'number' && typeof s.lon === 'number') {
      const k = `${s.lat.toFixed(1)},${s.lon.toFixed(1)}`;
      const p = points.get(k);
      if (p) p.count++;
      else points.set(k, { lat: +s.lat.toFixed(2), lon: +s.lon.toFixed(2), count: 1, city: s.city, region: s.region, country: s.country });
    }
  }
  for (const pv of pageviews) {
    const b = idx.get(bkey(pv.created_at));
    if (b !== undefined) buckets[b].pageviews++;
    inc(pages, pv.path || '/');
  }

  const totalPageviews = Math.max(pageviews.length, 0);
  const totals = {
    visitors: visitorIds.length,
    sessions: sessions.length,
    pageviews: totalPageviews,
    pagesPerSession: sessions.length ? (pvFromSessions || totalPageviews) / sessions.length : 0,
    newVisitors,
    returning,
  };

  return NextResponse.json({
    range,
    now: new Date(nowMs).toISOString(),
    online,
    totals,
    series: buckets.map(({ label, sessions: s, pageviews: p }) => ({ label, sessions: s, pageviews: p })),
    granularity: isToday ? 'hour' : 'day',
    topCountries: top(countries, 15),
    topStates: top(states, 27),
    topCities: top(cities, 15).map(({ key, value }) => {
      const [city, region, country] = key.split('|');
      return { city, region, country, value };
    }),
    topPages: top(pages, 15),
    devices: top(devices, 3),
    topReferrers: top(refs, 12),
    points: [], // V3: sem pontos individuais no mapa (coordenadas não são mais gravadas)
    capped: { sessions: sessions.length >= MAX_SESSIONS, pageviews: pageviews.length >= MAX_PAGEVIEWS },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
