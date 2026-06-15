import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const PRIORIDADES = ['importante', 'mediano', 'depois'] as const;

// Confere se quem chamou é admin. Retorna o user, ou null + resposta de erro.
async function exigirAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { user: null, erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user, erro: null };
}

// GET — lista todas as observações (mais recentes primeiro)
export async function GET() {
  const { user, erro } = await exigirAdmin();
  if (!user) return erro!;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('admin_notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('[notes] list falhou:', error); return NextResponse.json({ notes: [] }); }
  return NextResponse.json({ notes: data ?? [] });
}

// POST — { action: 'create' | 'toggle' | 'delete', ... }
export async function POST(req: Request) {
  const { user, erro } = await exigirAdmin();
  if (!user) return erro!;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '');
  const admin = createAdminClient();

  if (action === 'create') {
    const texto = String(body?.texto || '').trim();
    if (!texto) return NextResponse.json({ error: 'escreva algo' }, { status: 400 });
    let prioridade = String(body?.prioridade || 'mediano');
    if (!PRIORIDADES.includes(prioridade as any)) prioridade = 'mediano';

    const { data, error } = await admin.from('admin_notes').insert({
      autor_admin: user.id,
      autor_email: user.email || null,
      texto: texto.slice(0, 4000),
      prioridade,
      feito: false,
    }).select('*').single();

    if (error) { console.error('[notes] create falhou:', error); return NextResponse.json({ error: 'falha ao salvar' }, { status: 500 }); }
    return NextResponse.json({ ok: true, note: data });
  }

  if (action === 'toggle') {
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'sem id' }, { status: 400 });
    const { data: atual } = await admin.from('admin_notes').select('feito').eq('id', id).single();
    const { error } = await admin.from('admin_notes').update({ feito: !atual?.feito }).eq('id', id);
    if (error) { console.error('[notes] toggle falhou:', error); return NextResponse.json({ error: 'falha' }, { status: 500 }); }
    return NextResponse.json({ ok: true, feito: !atual?.feito });
  }

  if (action === 'delete') {
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'sem id' }, { status: 400 });
    const { error } = await admin.from('admin_notes').delete().eq('id', id);
    if (error) { console.error('[notes] delete falhou:', error); return NextResponse.json({ error: 'falha' }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
