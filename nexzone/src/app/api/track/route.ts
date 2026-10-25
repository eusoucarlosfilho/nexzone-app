import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// Coleta anônima de audiência (sem IP — LGPD). Sempre responde 204, nunca lança.
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOT = /bot\b|bot\/|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|headlesschrome|phantomjs|lighthouse|pagespeed|pingdom|uptimerobot|curl\/|wget|python-|axios|node-fetch|go-http|java\/|okhttp|vercel-screenshot/i;

const noContent = () => new NextResponse(null, { status: 204 });

function deviceFrom(ua: string): 'mobile' | 'desktop' | 'tablet' {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function dec(v: string | null): string | null {
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 120); } catch { return v.slice(0, 120); }
}

function num(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') || '';
    if (!ua || BOT.test(ua)) return noContent();

    let body: any = null;
    try { body = JSON.parse(await req.text()); } catch { return noContent(); }
    if (!body || typeof body !== 'object') return noContent();

    const sid = String(body.sid || '');
    const vid = String(body.vid || '');
    const type = body.type === 'ping' ? 'ping' : body.type === 'view' ? 'view' : null;
    let path = typeof body.path === 'string' ? body.path : '';
    if (!type || !UUID.test(sid) || !UUID.test(vid)) return noContent();
    if (!path.startsWith('/') || path.length > 300) return noContent();
    path = path.split('#')[0];
    if (/^\/(admin|api|_next)(\/|$|\?)/.test(path)) return noContent();

    const admin = createAdminClient();
    const now = new Date().toISOString();

    if (type === 'ping') {
      await admin.from('site_sessions').update({ last_seen: now }).eq('id', sid);
      return noContent();
    }

    // Usuário logado (opcional)
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
      const ref = typeof body.ref === 'string' && body.ref.length <= 500 ? body.ref : null;
      const region = h.get('x-vercel-ip-country-region');
      await admin.from('site_sessions').insert({
        id: sid,
        visitor_id: vid,
        started_at: now,
        last_seen: now,
        country: (h.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 2) || null,
        region: region ? region.toUpperCase().slice(0, 10) : null,
        city: dec(h.get('x-vercel-ip-city')),
        lat: num(h.get('x-vercel-ip-latitude')),
        lon: num(h.get('x-vercel-ip-longitude')),
        device: deviceFrom(ua),
        referrer: ref || null,
        landing_path: path,
        current_path: path,
        pageviews: 1,
        user_id: userId,
      });
    }

    await admin.from('site_pageviews').insert({ session_id: sid, path, created_at: now });
  } catch { /* nunca quebra o site por causa de analytics */ }
  return noContent();
}
