import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verificarEscalonamento } from '@/lib/escalonamento';

// Varre pedidos pagos sem alerta e escalona os que passaram do prazo.
// Pode ser chamado por um cron externo. Protegido por ?key= se CRON_SECRET existir.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const key = new URL(req.url).searchParams.get('key');
    if (key !== secret) return NextResponse.json({ error: 'sem permissão' }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: orders } = await admin.from('orders')
    .select('id').in('status', ['pago', 'entregue']).is('vendedor_alerta_em', null).limit(500);
  let checados = 0;
  for (const o of (orders ?? [])) { await verificarEscalonamento(admin, (o as any).id); checados++; }
  return NextResponse.json({ ok: true, checados });
}
