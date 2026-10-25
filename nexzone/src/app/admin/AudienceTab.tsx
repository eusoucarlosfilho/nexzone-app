'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { geoArea, geoEqualEarth, geoMercator, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import Icon from '@/components/Icon';

/* ============================================================
   Audiência ao vivo — mapa mundi / Brasil, KPIs e listas.
   Dados anônimos vindos de /api/admin/audience.
   ============================================================ */

type Range = 'today' | '7d' | '30d' | '90d';
const RANGES: [Range, string][] = [['today', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias']];

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const BRAZIL_URL = 'https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/brazil-states.geojson';

const UF: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const UF_BY_NAME: Record<string, string> = Object.fromEntries(Object.entries(UF).map(([k, v]) => [norm(v), k]));

/* ---------- caches de módulo para os mapas ---------- */
let worldCache: any[] | null = null;
let worldPromise: Promise<any[]> | null = null;
let brazilCache: any[] | null = null;
let brazilPromise: Promise<any[]> | null = null;

function loadWorld(): Promise<any[]> {
  if (worldCache) return Promise.resolve(worldCache);
  if (!worldPromise) {
    worldPromise = fetch(WORLD_URL).then((r) => { if (!r.ok) throw new Error('world'); return r.json(); }).then((topo: any) => {
      const fc: any = feature(topo, topo.objects.countries);
      worldCache = (fc?.features || []) as any[];
      if (!worldCache.length) throw new Error('world vazio');
      return worldCache;
    }).catch((e) => { worldPromise = null; throw e; });
  }
  return worldPromise;
}

/** d3 espera anéis no sentido horário; GeoJSON RFC 7946 usa anti-horário. Corrige se a área "virar o globo". */
function rewind(f: any) {
  try {
    if (geoArea(f) <= 2 * Math.PI) return f;
    const g = f.geometry;
    const rev = (poly: any[]) => poly.map((ring: any[]) => ring.slice().reverse());
    const geometry = g.type === 'Polygon' ? { ...g, coordinates: rev(g.coordinates) }
      : g.type === 'MultiPolygon' ? { ...g, coordinates: g.coordinates.map(rev) } : g;
    return { ...f, geometry };
  } catch { return f; }
}

function ufOf(props: any): string | null {
  if (!props) return null;
  for (const k of ['sigla', 'SIGLA', 'uf', 'UF', 'abbrev', 'abbreviation', 'code', 'postal']) {
    const v = props[k];
    if (typeof v === 'string' && UF[v.toUpperCase().trim()]) return v.toUpperCase().trim();
  }
  for (const k of ['name', 'nome', 'NAME', 'NOME', 'estado', 'state']) {
    const v = props[k];
    if (typeof v === 'string' && UF_BY_NAME[norm(v)]) return UF_BY_NAME[norm(v)];
  }
  return null;
}

function loadBrazil(): Promise<any[]> {
  if (brazilCache) return Promise.resolve(brazilCache);
  if (!brazilPromise) {
    brazilPromise = fetch(BRAZIL_URL).then((r) => { if (!r.ok) throw new Error('brasil'); return r.json(); }).then((gj: any) => {
      const feats = ((gj?.features || []) as any[]).filter((f) => f?.geometry).map((f) => ({ ...rewind(f), uf: ufOf(f.properties) }));
      if (!feats.length) throw new Error('brasil vazio');
      brazilCache = feats;
      return feats;
    }).catch((e) => { brazilPromise = null; throw e; });
  }
  return brazilPromise;
}

/* ---------- formatação ---------- */
const fmt = (v: number) => Number(v || 0).toLocaleString('pt-BR');
const fmt1 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let regionNames: Intl.DisplayNames | null | undefined;
function countryName(code?: string | null) {
  if (!code) return 'Desconhecido';
  if (regionNames === undefined) {
    try { regionNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' }); } catch { regionNames = null; }
  }
  try { return regionNames?.of(code.toUpperCase()) || code; } catch { return code; }
}
const DEVICE: Record<string, [string, string]> = {
  mobile: ['Celular', 'phone'], desktop: ['Computador', 'monitor'], tablet: ['Tablet', 'phone'],
};
function place(s: { city?: string | null; region?: string | null; country?: string | null }) {
  const parts = [s.city, s.country === 'BR' ? s.region : s.region && s.city ? s.region : null].filter(Boolean);
  const where = parts.join(', ');
  const c = s.country ? (s.country === 'BR' ? 'Brasil' : countryName(s.country)) : '';
  return [where, c].filter(Boolean).join(' · ') || 'Local desconhecido';
}
function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  return `há ${Math.floor(m / 60)}h`;
}

/* ---------- número animado ---------- */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const diff = value - start;
    if (!diff) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      const v = start + diff * e;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{decimals ? fmt1(shown) : fmt(Math.round(shown))}</>;
}

/* ---------- gráfico de área ---------- */
function AreaChart({ series, granularity }: { series: { label: string; sessions: number; pageviews: number }[]; granularity: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // Desenha na largura real do cartão, com altura fixa de 220px: fontes dos eixos ficam com 11px de verdade.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w > 0) setW(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220, L = 40, R = 14, T = 12, B = 24;
  const n = series.length;
  const rawMax = Math.max(1, ...series.map((s) => s.sessions));
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const max = Math.max(4, Math.ceil(rawMax / mag) * mag);
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.sessions).toFixed(1)}`).join('');
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(max * k));
  const every = Math.max(1, Math.ceil(n / 8));

  function onMove(e: RMouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    if (n <= 1) { setHover(n ? 0 : null); return; }
    const i = Math.round(((vx - L) / (W - L - R)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }
  const h = hover !== null ? series[hover] : null;

  return (
    <div className="aud-chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Sessões ao longo do tempo"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="audArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--bd2)" strokeDasharray={i ? '3 4' : undefined} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--sub)">{fmt(t)}</text>
          </g>
        ))}
        {series.map((s, i) => (i % every === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--sub)">{s.label}</text>
        ))}
        {n > 0 && <path d={area} fill="url(#audArea)" />}
        {n > 0 && <path d={line} fill="none" stroke="#FF6B00" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="var(--sub)" strokeOpacity=".5" />
            <circle cx={x(hover)} cy={y(h.sessions)} r="5" fill="#FF6B00" stroke="var(--panel)" strokeWidth="2" />
          </g>
        )}
        <rect x={0} y={0} width={W} height={H} fill="transparent" />
      </svg>
      {hover !== null && h && (
        <div className="aud-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.sessions) / H) * 100}%` }}>
          <b>{granularity === 'hour' ? `Hoje, ${h.label}` : h.label}</b>
          <span>{fmt(h.sessions)} sessões</span>
          <span>{fmt(h.pageviews)} visualizações</span>
        </div>
      )}
    </div>
  );
}

/* ---------- mapas ---------- */
type Tip = { x: number; y: number; lines: string[] } | null;
const STEPS = [20, 40, 60, 80, 100];
const stepFill = (lvl: number) => (lvl <= 0 ? 'var(--panel2)' : `color-mix(in srgb, #FF6B00 ${STEPS[lvl - 1]}%, var(--panel2))`);

function MapCard({ online, points, states, mode, setMode }: {
  online: any[]; points: any[]; states: { key: string; value: number }[]; mode: 'mundo' | 'brasil'; setMode: (m: 'mundo' | 'brasil') => void;
}) {
  const [world, setWorld] = useState<any[] | null>(worldCache);
  const [brazil, setBrazil] = useState<any[] | null>(brazilCache);
  const [failed, setFailed] = useState<{ mundo: boolean; brasil: boolean }>({ mundo: false, brasil: false });
  const [tip, setTip] = useState<Tip>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (mode === 'mundo' && !world) loadWorld().then((w) => alive && setWorld(w)).catch(() => alive && setFailed((f) => ({ ...f, mundo: true })));
    if (mode === 'brasil' && !brazil) loadBrazil().then((b) => alive && setBrazil(b)).catch(() => alive && setFailed((f) => ({ ...f, brasil: true })));
    return () => { alive = false; };
  }, [mode, world, brazil]);

  const W = mode === 'mundo' ? 960 : 640;
  const H = mode === 'mundo' ? 480 : 600;

  const geo = useMemo(() => {
    try {
      if (mode === 'mundo') {
        if (!world) return null;
        const proj = geoEqualEarth().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' } as any);
        const path = geoPath(proj);
        return {
          proj,
          sphere: path({ type: 'Sphere' } as any) || '',
          grat: path(geoGraticule10()) || '',
          shapes: world.map((f: any, i: number) => ({ id: String(f.id ?? i), d: path(f) || '', name: f.properties?.name || '', uf: null as string | null })),
        };
      }
      if (!brazil) return null;
      const fc = { type: 'FeatureCollection', features: brazil } as any;
      const proj = geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], fc);
      const path = geoPath(proj);
      return {
        proj, sphere: '', grat: '',
        shapes: brazil.map((f: any, i: number) => ({ id: f.uf || String(i), d: path(f) || '', name: f.uf ? UF[f.uf] : (f.properties?.name || ''), uf: f.uf as string | null })),
      };
    } catch { return null; }
  }, [mode, world, brazil, W, H]);

  const stateCount = useMemo(() => Object.fromEntries(states.map((s) => [s.key, s.value])) as Record<string, number>, [states]);
  const stateMax = Math.max(0, ...states.map((s) => s.value));
  const level = (v: number) => (!v || !stateMax ? 0 : Math.max(1, Math.ceil((v / stateMax) * 5)));

  const project = useCallback((lon: number, lat: number): [number, number] | null => {
    if (!geo) return null;
    const p = geo.proj([lon, lat]);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
    if (p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) return null;
    return p as [number, number];
  }, [geo, W, H]);

  function showTip(e: RMouseEvent, lines: string[]) {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, lines });
  }

  const isFailed = failed[mode];
  const pointMax = Math.max(1, ...points.map((p) => p.count));

  return (
    <div className="adm-card aud-mapcard">
      <div className="aud-cardhead">
        <h3 className="adm-ct" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name={mode === 'mundo' ? 'globe' : 'mapPin'} size={18} /> {mode === 'mundo' ? 'Mapa mundial' : 'Mapa do Brasil'}
        </h3>
        <div className="aud-seg" role="tablist">
          <button className={mode === 'mundo' ? 'on' : ''} onClick={() => { setTip(null); setMode('mundo'); }}>Mundo</button>
          <button className={mode === 'brasil' ? 'on' : ''} onClick={() => { setTip(null); setMode('brasil'); }}>Brasil</button>
        </div>
      </div>

      {isFailed ? (
        <div className="adm-empty" style={{ padding: 24 }}>Não foi possível carregar o mapa agora. Os rankings abaixo continuam atualizados.</div>
      ) : !geo ? (
        <div className="aud-mapload" style={{ aspectRatio: `${W} / ${H}` }}><span>Carregando mapa…</span></div>
      ) : (
        <div className="aud-mapwrap" ref={wrap} onMouseLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label={mode === 'mundo' ? 'Mapa mundial de visitantes' : 'Mapa do Brasil por estado'}>
            {geo.sphere && <path d={geo.sphere} fill="none" stroke="var(--bd2)" strokeWidth="1" />}
            {geo.grat && <path d={geo.grat} fill="none" stroke="var(--bd)" strokeWidth=".6" />}
            {geo.shapes.map((s) => {
              if (mode === 'brasil') {
                const v = s.uf ? stateCount[s.uf] || 0 : 0;
                return (
                  <path key={s.id} d={s.d} className="aud-state" style={{ fill: stepFill(level(v)) }} stroke="var(--bd2)" strokeWidth="1"
                    onMouseMove={(e) => showTip(e, [s.uf ? `${UF[s.uf]} (${s.uf})` : s.name, `${fmt(v)} ${v === 1 ? 'sessão' : 'sessões'}`])} />
                );
              }
              return <path key={s.id} d={s.d} fill="var(--panel2)" stroke="var(--bd2)" strokeWidth=".6" />;
            })}

            {/* sessões do período (pontos menores, semitransparentes) */}
            {points.map((p, i) => {
              const xy = project(p.lon, p.lat);
              if (!xy) return null;
              const r = (mode === 'mundo' ? 2.2 : 2.6) + Math.sqrt(p.count / pointMax) * (mode === 'mundo' ? 5 : 6);
              return (
                <circle key={'p' + i} cx={xy[0]} cy={xy[1]} r={r} fill="#FF9A3C" fillOpacity=".28" stroke="#FF9A3C" strokeOpacity=".45" strokeWidth=".8"
                  onMouseMove={(e) => showTip(e, [place(p), `${fmt(p.count)} ${p.count === 1 ? 'sessão' : 'sessões'} no período`])} />
              );
            })}

            {/* online agora (pulsando) */}
            {online.map((s, i) => {
              if (typeof s.lat !== 'number' || typeof s.lon !== 'number') return null;
              const xy = project(s.lon, s.lat);
              if (!xy) return null;
              return (
                <g key={'o' + (s.id || i)} onMouseMove={(e) => showTip(e, [place(s), `Agora em ${s.current_path || '/'}`, (DEVICE[s.device] || DEVICE.desktop)[0]])}>
                  <circle cx={xy[0]} cy={xy[1]} r="5" fill="#FF6B00" className="aud-ring" />
                  <circle cx={xy[0]} cy={xy[1]} r="4.5" fill="#FF6B00" stroke="var(--panel)" strokeWidth="1.5" />
                </g>
              );
            })}
          </svg>
          {tip && (
            <div className="aud-tip aud-tip-map" style={{ left: tip.x, top: tip.y }}>
              {tip.lines.map((l, i) => (i === 0 ? <b key={i}>{l}</b> : <span key={i}>{l}</span>))}
            </div>
          )}
        </div>
      )}

      <div className="aud-legend">
        <span><i className="aud-dot live" /> Online agora</span>
        <span><i className="aud-dot range" /> Sessões no período</span>
        {mode === 'brasil' && !isFailed && (
          <span className="aud-scale">
            <em>Sessões</em>
            {[0, 1, 2, 3, 4, 5].map((l) => <i key={l} style={{ background: stepFill(l) }} title={l === 0 ? '0' : `até ${fmt(Math.ceil((stateMax * l) / 5))}`} />)}
            <em>{stateMax ? fmt(stateMax) : '0'}</em>
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- lista ranqueada com barras ---------- */
function RankList({ title, icon, rows, empty = 'Sem dados no período.' }: {
  title: string; icon: string; rows: { label: string; sub?: string; value: number; icon?: string }[]; empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div className="adm-card aud-rank">
      <h3 className="adm-ct" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={icon} size={17} /> {title}</h3>
      {rows.length ? rows.map((r, i) => (
        <div className="aud-rrow" key={i}>
          <div className="aud-rbar" style={{ width: `${(r.value / max) * 100}%` }} />
          <div className="aud-rlabel">
            {r.icon && <Icon name={r.icon} size={14} />}
            <span className="t" title={r.label}>{r.label}</span>
            {r.sub && <span className="s">{r.sub}</span>}
          </div>
          <div className="aud-rval">{fmt(r.value)} <small>{Math.round((r.value / total) * 100)}%</small></div>
        </div>
      )) : <div className="adm-empty" style={{ padding: 18 }}>{empty}</div>}
    </div>
  );
}

/* ---------- online agora (lista) ---------- */
function OnlineList({ sessions, skew }: { sessions: any[]; skew: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((t) => t + 1), 1000); return () => window.clearInterval(id); }, []);
  const now = Date.now() + skew;
  return (
    <div className="adm-card">
      <h3 className="adm-ct" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="activity" size={17} /> Online agora</h3>
      {sessions.length ? (
        <div className="aud-live">
          {sessions.slice(0, 60).map((s, i) => {
            const [dl, di] = DEVICE[s.device] || DEVICE.desktop;
            return (
              <div className="aud-lrow" key={s.id || i}>
                <i className="aud-dot live" />
                <div className="aud-lmain">
                  <b>{place(s)}</b>
                  <span title={s.current_path}>{s.current_path || '/'}</span>
                </div>
                <span className="aud-ldev" title={dl}><Icon name={di} size={14} /> <span className="aud-hide-sm">{dl}</span></span>
                <span className="aud-lago">{ago(now - new Date(s.last_seen).getTime())}</span>
              </div>
            );
          })}
        </div>
      ) : <div className="adm-empty" style={{ padding: 18 }}>Ninguém online neste momento.</div>}
    </div>
  );
}

/* ============================================================ */
export default function AudienceTab() {
  const [range, setRange] = useState<Range>('today');
  const [data, setData] = useState<any>(null);
  const [online, setOnline] = useState<{ count: number; sessions: any[] }>({ count: 0, sessions: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [skew, setSkew] = useState(0);
  const [mode, setMode] = useState<'mundo' | 'brasil'>('brasil');
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const loadFull = useCallback(async (r: Range, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/audience?range=${r}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'Acesso negado.' : 'Falha ao carregar.');
      const d = await res.json();
      if (rangeRef.current !== r) return;
      setData(d);
      if (d.online) setOnline(d.online);
      if (d.now) setSkew(new Date(d.now).getTime() - Date.now());
      setErr(null);
    } catch (e: any) {
      if (!silent) setErr(e?.message || 'Falha ao carregar.');
    } finally { if (!silent) setLoading(false); }
  }, []);

  const loadOnline = useCallback(async () => {
    try {
      if (document.visibilityState !== 'visible') return;
      const res = await fetch('/api/admin/audience?only=online', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      if (d.online) setOnline(d.online);
      if (d.now) setSkew(new Date(d.now).getTime() - Date.now());
    } catch {}
  }, []);

  useEffect(() => { loadFull(range); }, [range, loadFull]);
  useEffect(() => {
    const a = window.setInterval(loadOnline, 15000);
    const b = window.setInterval(() => { if (document.visibilityState === 'visible') loadFull(rangeRef.current, true); }, 120000);
    return () => { window.clearInterval(a); window.clearInterval(b); };
  }, [loadOnline, loadFull]);

  const t = data?.totals || { visitors: 0, sessions: 0, pageviews: 0, pagesPerSession: 0, newVisitors: 0, returning: 0 };
  const nvTotal = (t.newVisitors || 0) + (t.returning || 0);
  const newPct = nvTotal ? Math.round((t.newVisitors / nvTotal) * 100) : 0;

  const stateRows = (data?.topStates || []).map((s: any) => ({ label: UF[s.key] || s.key, sub: s.key, value: s.value }));
  const countryRows = (data?.topCountries || []).map((c: any) => ({ label: countryName(c.key), sub: c.key, value: c.value }));
  const cityRows = (data?.topCities || []).map((c: any) => ({
    label: c.city, sub: [c.country === 'BR' ? c.region : null, c.country && c.country !== 'BR' ? countryName(c.country) : null].filter(Boolean).join(' · '), value: c.value,
  }));
  const pageRows = (data?.topPages || []).map((p: any) => ({ label: p.key, value: p.value }));
  const refRows = (data?.topReferrers || []).map((r: any) => ({ label: r.key, value: r.value }));
  const devRows = (data?.devices || []).map((d: any) => ({ label: (DEVICE[d.key] || [d.key])[0], icon: (DEVICE[d.key]?.[1] || 'monitor'), value: d.value }));
  const rangeLabel = RANGES.find(([k]) => k === range)?.[1] || '';

  return (
    <div className="aud">
      <style>{`
        .aud{--live:#22C55E;}
        .aud-top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
        .aud-livebadge{display:inline-flex;align-items:center;gap:8px;font-family:'Outfit';font-weight:800;font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:var(--live);background:color-mix(in srgb,var(--live) 14%,transparent);border-radius:50px;padding:5px 12px 5px 10px;}
        .aud-pdot{position:relative;width:9px;height:9px;border-radius:50%;background:var(--live);display:inline-block;}
        .aud-pdot::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--live);animation:audPing 1.8s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes audPing{0%{transform:scale(1);opacity:.75}80%,100%{transform:scale(2.8);opacity:0}}
        .aud-big{font-family:'Outfit';font-weight:900;font-size:24px;letter-spacing:-.5px;line-height:1.15;margin:8px 0 2px;}
        .aud-top .adm-sub{font-size:12px;}
        .aud-big b{color:var(--or);font-variant-numeric:tabular-nums;}
        .aud-chips{display:flex;gap:8px;flex-wrap:wrap;}
        .aud-chips .adm-fb{margin:0;height:32px;min-height:32px;padding:0 13px;font-size:12px;}
        .aud-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px;}
        .aud-kpis .adm-stat{padding:14px;border-radius:16px;}
        .aud-kpis .adm-stat .ic{width:28px;height:28px;border-radius:8px;margin-bottom:8px;}
        .aud-kpis .adm-stat b{font-size:22px;letter-spacing:-.4px;font-variant-numeric:tabular-nums;}
        .aud-kpis .adm-stat small{font-size:12px;}
        .aud .adm-card{padding:16px;margin-bottom:14px;}
        .aud .adm-ct{font-size:15px;margin-bottom:10px;}
        .aud-split{display:flex;height:6px;border-radius:6px;overflow:hidden;background:var(--panel2);margin:8px 0 6px;}
        .aud-split i{display:block;height:100%;background:#FF6B00;transition:width .6s;}
        .aud-chart{position:relative;}
        .aud-tip{position:absolute;transform:translate(-50%,calc(-100% - 12px));background:var(--tx);color:var(--bg);border-radius:10px;padding:8px 11px;font-size:12px;line-height:1.35;pointer-events:none;white-space:nowrap;display:flex;flex-direction:column;z-index:5;box-shadow:0 8px 24px rgba(0,0,0,.25);}
        .aud-tip b{font-family:'Outfit';font-size:12.5px;}
        .aud-tip-map{transform:translate(-50%,calc(-100% - 14px));}
        .aud-cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
        .aud-seg{display:inline-flex;background:var(--panel2);border:1px solid var(--bd2);border-radius:50px;padding:3px;}
        .aud-seg button{font-family:'Nunito';font-weight:800;font-size:13px;border:none;background:none;color:var(--sub);padding:7px 16px;border-radius:50px;cursor:pointer;min-height:34px;}
        .aud-seg button.on{background:#FF6B00;color:#16162A;}
        .aud-mapwrap{position:relative;}
        .aud-mapload{display:flex;align-items:center;justify-content:center;background:var(--panel2);border-radius:14px;color:var(--sub);font-size:13px;width:100%;max-height:520px;}
        .aud-state{transition:fill .3s;cursor:default;}
        .aud-state:hover{stroke:var(--or);stroke-width:1.8;}
        .aud-ring{transform-box:fill-box;transform-origin:center;animation:audRing 2s ease-out infinite;pointer-events:none;}
        @keyframes audRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(3.4);opacity:0}}
        .aud-legend{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:12px;font-size:12px;color:var(--sub);font-weight:700;}
        .aud-legend>span{display:inline-flex;align-items:center;gap:6px;}
        .aud-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex-shrink:0;}
        .aud-dot.live{background:#FF6B00;box-shadow:0 0 0 3px color-mix(in srgb,#FF6B00 25%,transparent);}
        .aud-dot.range{background:color-mix(in srgb,#FF9A3C 35%,transparent);border:1px solid #FF9A3C;}
        .aud-scale{margin-left:auto;}
        .aud-scale i{display:inline-block;width:18px;height:10px;border-radius:2px;border:1px solid var(--bd2);}
        .aud-scale em{font-style:normal;font-weight:700;}
        .aud-grid2{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px;align-items:start;}
        .aud-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start;}
        .aud-rrow{position:relative;display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;margin-bottom:2px;overflow:hidden;}
        .aud-rbar{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,#FF6B00 16%,transparent);border-radius:9px;transition:width .6s;}
        .aud-rlabel{position:relative;flex:1;min-width:0;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;}
        .aud-rlabel .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .aud-rlabel .s{color:var(--sub);font-size:11px;font-weight:800;white-space:nowrap;}
        .aud-rval{position:relative;font-family:'Outfit';font-weight:800;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums;}
        .aud-rval small{color:var(--sub);font-weight:700;font-size:11px;margin-left:4px;}
        .aud-live{max-height:430px;overflow-y:auto;}
        .aud-lrow{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--bd);font-size:13px;}
        .aud-lrow:last-child{border-bottom:none;}
        .aud-lmain{flex:1;min-width:0;display:flex;flex-direction:column;}
        .aud-lmain b{font-family:'Outfit';font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .aud-lmain span{font-size:12px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .aud-ldev{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--sub);font-weight:700;}
        .aud-lago{font-size:12px;color:var(--sub);font-weight:800;min-width:56px;text-align:right;font-variant-numeric:tabular-nums;}
        .aud-note{display:flex;align-items:center;gap:8px;color:var(--sub);font-size:12px;margin-top:6px;}
        .aud-warn{background:var(--panel2);border:1px solid var(--bd2);border-radius:12px;padding:12px 14px;color:var(--sub);font-size:13px;margin-bottom:18px;}
        @media(max-width:1100px){.aud-grid3{grid-template-columns:repeat(2,minmax(0,1fr));}}
        @media(max-width:900px){.aud-grid2{grid-template-columns:minmax(0,1fr);}}
        @media(max-width:640px){.aud-grid3{grid-template-columns:minmax(0,1fr);}.aud-hide-sm{display:none;}.aud-scale{margin-left:0;}}
      `}</style>

      <div className="aud-top">
        <div>
          <span className="aud-livebadge"><span className="aud-pdot" /> Ao vivo</span>
          <div className="aud-big"><b><AnimatedNumber value={online.count} /></b> {online.count === 1 ? 'pessoa online agora' : 'pessoas online agora'}</div>
          <p className="adm-sub" style={{ margin: 0 }}>Atualiza a cada 15 segundos. Online = ativo nos últimos 2 minutos.</p>
        </div>
        <div className="aud-chips">
          {RANGES.map(([k, l]) => (
            <button key={k} className={`adm-fb ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>{l}</button>
          ))}
        </div>
      </div>

      {err && <div className="aud-warn">{err} Verifique se a migration <b>0002_analytics.sql</b> já foi aplicada no Supabase.</div>}

      <div className="aud-kpis" style={{ opacity: loading && data ? 0.6 : 1, transition: 'opacity .2s' }}>
        <div className="adm-stat"><div className="ic"><Icon name="users" size={16} /></div><b><AnimatedNumber value={t.visitors} /></b><small>Visitantes · {rangeLabel}</small></div>
        <div className="adm-stat"><div className="ic"><Icon name="activity" size={16} /></div><b><AnimatedNumber value={t.sessions} /></b><small>Sessões</small></div>
        <div className="adm-stat"><div className="ic"><Icon name="eye" size={16} /></div><b><AnimatedNumber value={t.pageviews} /></b><small>Visualizações de página</small></div>
        <div className="adm-stat"><div className="ic"><Icon name="file" size={16} /></div><b><AnimatedNumber value={t.pagesPerSession} decimals={1} /></b><small>Páginas por sessão</small></div>
        <div className="adm-stat">
          <div className="ic"><Icon name="trending" size={16} /></div>
          <b>{newPct}% <span style={{ fontSize: 13, color: 'var(--sub)', fontWeight: 800 }}>novos</span></b>
          <div className="aud-split"><i style={{ width: `${newPct}%` }} /></div>
          <small>{fmt(t.newVisitors)} novos · {fmt(t.returning)} recorrentes</small>
        </div>
      </div>

      <div className="adm-card">
        <div className="aud-cardhead">
          <h3 className="adm-ct" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="trending" size={18} /> Sessões {range === 'today' ? 'por hora (hoje)' : `por dia · ${rangeLabel}`}</h3>
        </div>
        {data?.series?.length ? <AreaChart series={data.series} granularity={data.granularity} />
          : <div className="adm-empty">{loading ? 'Carregando…' : 'Sem sessões no período.'}</div>}
      </div>

      <div className="aud-grid2">
        <MapCard online={online.sessions} points={data?.points || []} states={data?.topStates || []} mode={mode} setMode={setMode} />
        <OnlineList sessions={online.sessions} skew={skew} />
      </div>

      <div className="aud-grid3">
        <RankList title="Estados do Brasil" icon="mapPin" rows={stateRows} />
        <RankList title="Países" icon="globe" rows={countryRows} />
        <RankList title="Cidades" icon="mapPin" rows={cityRows} />
        <RankList title="Páginas mais vistas" icon="eye" rows={pageRows} />
        <RankList title="Origem do tráfego" icon="link" rows={refRows} />
        <RankList title="Dispositivos" icon="monitor" rows={devRows} />
      </div>

      <div className="aud-note"><Icon name="lock" size={14} /> Dados anônimos, sem IP — localização aproximada pela rede (Vercel).</div>
    </div>
  );
}
