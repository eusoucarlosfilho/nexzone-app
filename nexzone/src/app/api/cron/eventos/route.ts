import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { processarEventos, lembrarPix } from '@/lib/eventosVenda-servidor';
import { lembrarCarrinhos } from '@/lib/posVenda-servidor';
import { minutosRecuperacao } from '@/lib/posVenda';

// Sprint 2 — rotina de 1 em 1 minuto: envia compras para Meta/TikTok, postbacks e lembretes de Pix.
// Chamada por um agendador externo (Supabase Cron ou cron-job.org) com ?key=<CRON_SECRET>
// ou pelo cron da Vercel (Authorization: Bearer <CRON_SECRET>).
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  // Duas senhas aceitas: CRON_SECRET da Vercel (cron diário) ou a senha interna do SQL 24 (robô de 1 em 1 minuto do Supabase)
  const admin = createAdminClient();
  const segredos: string[] = [];
  if (process.env.CRON_SECRET) segredos.push(process.env.CRON_SECRET);
  try { const { data } = await admin.from('push_config').select('valor').eq('chave', 'segredo_cron').maybeSingle(); if ((data as any)?.valor) segredos.push((data as any).valor); } catch { /* sem SQL 24 */ }
  if (!segredos.length) return NextResponse.json({ error: 'sem senha da rotina (rode o SQL 24)' }, { status: 503 });
  const key = new URL(req.url).searchParams.get('key') || '';
  const auth = req.headers.get('authorization') || '';
  if (!segredos.some((s) => key === s || auth === `Bearer ${s}`)) return NextResponse.json({ error: 'sem permissão' }, { status: 401 });

  const inicio = Date.now();
  let minutos = 15;
  try {
    const { data } = await admin.from('settings').select('value').eq('key', 'recuperacao_minutos').maybeSingle();
    if (data) minutos = minutosRecuperacao((data as any).value);
    await admin.from('settings').upsert({ key: 'cron_eventos_em', value: new Date().toISOString(), updated_at: new Date().toISOString() });
  } catch { /* segue com o padrão */ }
  const eventos = await processarEventos(admin, { limite: 40 }).catch((e) => ({ processados: 0, erro: String(e?.message || e) }));
  const lembretes = Date.now() - inicio < 18000 ? await lembrarPix(admin, minutos).catch(() => ({ enviados: 0 })) : { enviados: 0, adiado: true };
  // Fase B: carrinho abandonado (1 h e 24 h). Sem o SQL 19: não faz nada.
  const carrinhos = Date.now() - inicio < 22000 ? await lembrarCarrinhos(admin, minutos).catch(() => ({ enviados: 0 })) : { enviados: 0, adiado: true };
  return NextResponse.json({ ok: true, eventos, lembretes, carrinhos, ms: Date.now() - inicio }, { headers: { 'Cache-Control': 'no-store' } });
}
