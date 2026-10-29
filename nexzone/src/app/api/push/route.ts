import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { chavesPush } from '@/lib/push-servidor';
import { validarInscricao } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Notificação no celular (SQL 22)
//   GET              → chave pública (o navegador precisa dela para se inscrever)
//   POST {endpoint, keys}  → liga neste aparelho (precisa estar logado)
//   DELETE {endpoint}      → desliga neste aparelho
const semSql22 = (e: any) => /push_(config|inscricoes)|42P01|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);

export async function GET() {
  try {
    const k = await chavesPush(createAdminClient());
    return NextResponse.json({ ativo: true, publica: k.publica }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ ativo: false, sql22: !semSql22(e) }, { status: 200 });
  }
}

async function usuario() {
  const { data: { user } } = await createClient().auth.getUser();
  return user;
}

export async function POST(req: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta para ativar.' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const v = validarInscricao(b);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  const admin = createAdminClient();
  const { count } = await admin.from('push_inscricoes').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) >= 10) {
    // mais de 10 aparelhos: apaga o mais antigo
    const { data: velho } = await admin.from('push_inscricoes').select('id').eq('user_id', user.id).order('criado_em', { ascending: true }).limit(1);
    if (velho?.[0]) await admin.from('push_inscricoes').delete().eq('id', (velho[0] as any).id);
  }
  const aparelho = (req.headers.get('user-agent') || '').slice(0, 200) || null;
  const { error } = await admin.from('push_inscricoes').upsert(
    { user_id: user.id, endpoint: v.endpoint, p256dh: v.p256dh, auth: v.auth, aparelho, falhas: 0 },
    { onConflict: 'endpoint' },
  );
  if (error) return NextResponse.json({ error: semSql22(error) ? 'Notificação no celular ainda não está ativa (falta o SQL 22).' : 'Não foi possível ativar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const endpoint = String(b?.endpoint || '');
  if (endpoint) await createAdminClient().from('push_inscricoes').delete().eq('user_id', user.id).eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
