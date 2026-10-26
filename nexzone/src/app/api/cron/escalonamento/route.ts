import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verificarEscalonamento } from '@/lib/escalonamento';

// Varre pedidos pagos sem alerta e escalona os que passaram do prazo.
// Agendado no vercel.json (1x por dia). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
// Também aceita ?key=<CRON_SECRET> para um cron externo.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const key = new URL(req.url).searchParams.get('key');
    const auth = req.headers.get('authorization') || '';
    if (key !== secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'sem permissão' }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: orders } = await admin.from('orders')
    .select('id').in('status', ['pago', 'entregue']).is('vendedor_alerta_em', null).limit(500);
  let checados = 0;
  for (const o of (orders ?? [])) { await verificarEscalonamento(admin, (o as any).id); checados++; }
  return NextResponse.json({ ok: true, checados });
}
