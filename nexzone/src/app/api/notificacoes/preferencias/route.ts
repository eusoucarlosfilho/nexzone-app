import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { tiposValidos } from '@/lib/notifPreferencias';

export const dynamic = 'force-dynamic';

// Central de notificações (SQL 23) da pessoa logada.
//   GET  → { sql23, admin, vendedor, desligados: [tipos] }
//   POST { tipos: [...], celular: true|false } → liga ou desliga esses tipos no celular
const semSql23 = (e: any) => /notificacao_prefs|42P01|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const admin = createAdminClient();
  const [perfil, loja, prefs] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    admin.from('stores').select('id').eq('owner', user.id).maybeSingle(),
    admin.from('notificacao_prefs').select('tipo, celular').eq('user_id', user.id),
  ]);
  const desligados = prefs.error ? [] : ((prefs.data ?? []) as any[]).filter((r) => r.celular === false).map((r) => r.tipo);
  return NextResponse.json({
    sql23: !prefs.error || !semSql23(prefs.error),
    admin: (perfil.data as any)?.role === 'admin',
    vendedor: !!loja.data,
    desligados,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const tipos = tiposValidos(b.tipos);
  if (!tipos.length || typeof b.celular !== 'boolean') return NextResponse.json({ error: 'Escolha inválida.' }, { status: 400 });
  const agora = new Date().toISOString();
  const { error } = await createAdminClient().from('notificacao_prefs')
    .upsert(tipos.map((tipo) => ({ user_id: user.id, tipo, celular: b.celular, atualizado_em: agora })), { onConflict: 'user_id,tipo' });
  if (error) return NextResponse.json({ error: semSql23(error) ? 'A central de notificações ainda não está ativa (falta o SQL 23).' : 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
