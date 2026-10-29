import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { enviarNotificacao, segredoDisparo } from '@/lib/push-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Chamado pelo próprio banco (gatilho do SQL 22) quando entra uma notificação no sino.
// Protegido por uma senha interna que só o banco e o servidor conhecem.
const igual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export async function POST(req: Request) {
  const admin = createAdminClient();
  let segredo = '';
  try { segredo = await segredoDisparo(admin); } catch {}
  const recebido = req.headers.get('x-push-segredo') || '';
  if (!segredo || !recebido || !igual(segredo, recebido)) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const id = Number(b?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  try {
    const r = await enviarNotificacao(admin, id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    console.error('[push/disparar]', e?.message || e);
    return NextResponse.json({ error: 'falha no envio' }, { status: 500 });
  }
}
