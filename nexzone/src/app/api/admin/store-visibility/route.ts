import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Liga/desliga "Vender como Comprei Barato" (stores.ocultar_vendedor). SÓ ADMIN.
// A gravação usa service_role: é o único papel que o trigger do banco deixa mudar esse campo.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const storeId = typeof body.store_id === 'string' ? body.store_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return NextResponse.json({ error: 'store_id inválido' }, { status: 400 });
  if (typeof body.ocultar !== 'boolean') return NextResponse.json({ error: 'ocultar deve ser true ou false' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('stores')
    .update({ ocultar_vendedor: body.ocultar })
    .eq('id', storeId)
    .select('id, ocultar_vendedor')
    .maybeSingle();
  if (error) {
    console.error('[store-visibility]', error.message);
    return NextResponse.json({ error: 'falha ao atualizar (a migração 0005 já foi aplicada?)' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'loja não encontrada' }, { status: 404 });
  return NextResponse.json({ ok: true, ocultar_vendedor: (data as any).ocultar_vendedor === true });
}
