import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { CHAVES_UTM, canalDe, eventoValido, hostDe, limparProps, limparTexto, type Utm } from '@/lib/eventos';
import { BOT, caminhoSeguro, dispositivoDe, duplicado, funilAtivo, permitido } from '@/lib/track-servidor';

// Coleta anônima de audiência (sem IP gravado — LGPD). Sempre responde 204, nunca lança.
// V3:
// - limite de requisições por sessão e por origem de rede (só em memória, o IP não é gravado);
// - não grava mais latitude/longitude; grava só o DOMÍNIO de origem (não a URL com parâmetros);
// - aceita as 4 chaves UTM e o canal (se o SQL V3 de sessões tiver sido aplicado);
// - aceita eventos de funil da lista fechada de src/lib/eventos.ts, só com a chave analytics_funil ligada.
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noContent = () => new NextResponse(null, { status: 204 });

function dec(v: string | null): string | null {
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 120); } catch { return v.slice(0, 120); }
}

function utmLimpa(v: unknown): Utm {
  const out: Utm = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of CHAVES_UTM) {
    const t = limparTexto((v as any)[k], 80);
    if (t) out[k] = t;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') || '';
    if (!ua || BOT.test(ua)) return noContent();
    const len = Number(req.headers.get('content-length') || 0);
    if (len > 4000) return noContent();

    // Limite por origem de rede (IP usado só em memória, nunca gravado)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sem-ip';
    if (!permitido('ip:' + ip, 240, 60_000)) return noContent();

    let body: any = null;
    try {
      const txt = await req.text();
      if (txt.length > 4000) return noContent();
      body = JSON.parse(txt);
    } catch { return noContent(); }
    if (!body || typeof body !== 'object') return noContent();

    const sid = String(body.sid || '');
    const vid = String(body.vid || '');
    const type = body.type === 'ping' ? 'ping' : body.type === 'view' ? 'view' : body.type === 'event' ? 'event' : null;
    if (!type || !UUID.test(sid) || !UUID.test(vid)) return noContent();
    const path = caminhoSeguro(body.path);
    if (!path) return noContent();
    if (!permitido('sid:' + sid, 90, 60_000)) return noContent();

    const admin = createAdminClient();
    const now = new Date().toISOString();

    if (type === 'ping') {
      await admin.from('site_sessions').update({ last_seen: now, current_path: path }).eq('id', sid);
      return noContent();
    }

    if (type === 'event') {
      if (!eventoValido(body.nome)) return noContent();
      if (!(await funilAtivo())) return noContent();
      const props = limparProps(body.nome, body.props);
      if (duplicado(`${sid}|${body.nome}|${JSON.stringify(props)}`)) return noContent();
      if (!permitido('ev:' + sid, 40, 60_000)) return noContent();
      // Tabela site_events só existe depois do SQL V3 (04). Sem ela, o insert falha em silêncio.
      await admin.from('site_events').insert({
        session_id: sid, visitor_id: vid, nome: body.nome, props, path, device: dispositivoDe(ua), created_at: now,
      });
      return noContent();
    }

    // ---- view ----
    let userId: string | null = null;
    try {
      const sb = createClient();
      const { data } = await sb.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch { userId = null; }

    const { data: existing } = await admin.from('site_sessions')
      .select('id, pageviews, user_id').eq('id', sid).maybeSingle();

    if (existing) {
      const upd: Record<string, any> = {
        last_seen: now, current_path: path, pageviews: Number((existing as any).pageviews || 0) + 1,
      };
      if (userId && !(existing as any).user_id) upd.user_id = userId;
      await admin.from('site_sessions').update(upd).eq('id', sid);
    } else {
      const h = req.headers;
      const refHost = hostDe(body.ref);
      const proprio = (h.get('host') || '').replace(/^www\./, '').split(':')[0].toLowerCase();
      const host = refHost && refHost !== proprio ? refHost : null;
      const utm = utmLimpa(body.utm);
      const region = h.get('x-vercel-ip-country-region');
      const base: Record<string, any> = {
        id: sid,
        visitor_id: vid,
        started_at: now,
        last_seen: now,
        country: (h.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 2) || null,
        region: region ? region.toUpperCase().slice(0, 10) : null,
        city: dec(h.get('x-vercel-ip-city')),
        lat: null,
        lon: null,
        device: dispositivoDe(ua),
        // Só o domínio de origem, no formato de URL para compatibilidade com o painel antigo.
        referrer: host ? `https://${host}/` : null,
        landing_path: path,
        current_path: path,
        pageviews: 1,
        user_id: userId,
      };
      const v3 = { ...base, ...utm, canal: canalDe(utm, host) };
      const { error } = await admin.from('site_sessions').insert(v3);
      // Sem as colunas do SQL V3 (05), grava no formato antigo.
      if (error) await admin.from('site_sessions').insert(base);
    }

    await admin.from('site_pageviews').insert({ session_id: sid, path, created_at: now });
  } catch { /* nunca quebra o site por causa de analytics */ }
  return noContent();
}
