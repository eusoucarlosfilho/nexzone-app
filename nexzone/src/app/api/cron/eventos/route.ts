import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { processarEventos, lembrarPix } from '@/lib/eventosVenda-servidor';

// Sprint 2 — rotina de 1 em 1 minuto: envia compras para Meta/TikTok, postbacks e lembretes de Pix.
// Chamada por um agendador externo (Supabase Cron ou cron-job.org) com ?key=<CRON_SECRET>
// ou pelo cron da Vercel (Authorization: Bearer <CRON_SECRET>).
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurada na Vercel' }, { status: 503 });
  const key = new URL(req.url).searchParams.get('key');
  const auth = req.headers.get('authorization') || '';
  if (key !== secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'sem permissão' }, { status: 401 });

  const admin = createAdminClient();
  const inicio = Date.now();
  const eventos = await processarEventos(admin, { limite: 40 }).catch((e) => ({ processados: 0, erro: String(e?.message || e) }));
  const lembretes = Date.now() - inicio < 18000 ? await lembrarPix(admin).catch(() => ({ enviados: 0 })) : { enviados: 0, adiado: true };
  return NextResponse.json({ ok: true, eventos, lembretes, ms: Date.now() - inicio }, { headers: { 'Cache-Control': 'no-store' } });
}
