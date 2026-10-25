import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/suporte/auth';

export const dynamic = 'force-dynamic';

// Admin → Configurações → Suporte
//   avisarMe:     aviso por e-mail de chamado novo / cliente respondeu, SÓ para o e-mail deste admin
//   emailCliente: enviar por e-mail ao cliente cada resposta nossa (vale para todos)
export async function POST(req: Request) {
  const ctx = await exigirAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { admin, user } = ctx;
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'dados inválidos' }, { status: 400 }); }
  const agora = new Date().toISOString();

  if (typeof b.avisarMe === 'boolean') {
    const { data } = await admin.from('settings').select('value').eq('key', 'suporte_aviso_admins').maybeSingle();
    const atual = (data as any)?.value;
    const mapa = atual && typeof atual === 'object' && !Array.isArray(atual) ? { ...atual } : {};
    mapa[user.id] = b.avisarMe;
    const { error } = await admin.from('settings').upsert({ key: 'suporte_aviso_admins', value: mapa, updated_at: agora });
    if (error) return NextResponse.json({ error: 'falha ao salvar' }, { status: 500 });
  }
  if (typeof b.emailCliente === 'boolean') {
    const { error } = await admin.from('settings').upsert({ key: 'suporte_email_cliente', value: b.emailCliente, updated_at: agora });
    if (error) return NextResponse.json({ error: 'falha ao salvar' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
