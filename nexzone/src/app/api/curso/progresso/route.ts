import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { acessoAoCurso } from '@/lib/curso-servidor';
import { aulaLiberada } from '@/lib/curso';

export const dynamic = 'force-dynamic';

// Marca/desmarca aula como concluída e registra o último acesso. { aulaId, concluida?: boolean, visita?: true }
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const aulaId = String(b.aulaId || '');
  if (!/^[0-9a-f-]{36}$/i.test(aulaId)) return NextResponse.json({ error: 'aula inválida' }, { status: 400 });

  const admin = createAdminClient();
  const { data: aula } = await admin.from('curso_aulas').select('id, product_id, publicada, liberar_apos_dias, curso_modulos(liberar_apos_dias)').eq('id', aulaId).maybeSingle();
  if (!aula || !(aula as any).publicada) return NextResponse.json({ error: 'aula não encontrada' }, { status: 404 });
  const ac = await acessoAoCurso(admin, user.id, (aula as any).product_id);
  if (!ac) return NextResponse.json({ error: 'sem acesso' }, { status: 403 });
  const dono = ac.papel !== 'aluno';
  if (!aulaLiberada(ac.compradoEm, (aula as any).curso_modulos?.liberar_apos_dias || 0, (aula as any).liberar_apos_dias || 0, Date.now(), dono)) {
    return NextResponse.json({ error: 'Esta aula ainda não foi liberada.' }, { status: 403 });
  }
  const productId = (aula as any).product_id;
  await admin.from('curso_acessos').upsert({ user_id: user.id, product_id: productId, ultima_aula: aulaId, ultimo_acesso: new Date().toISOString() });
  if (b.visita === true) return NextResponse.json({ ok: true });

  if (b.concluida === false) {
    await admin.from('curso_progresso').delete().eq('user_id', user.id).eq('aula_id', aulaId);
  } else {
    const { error } = await admin.from('curso_progresso').upsert({ user_id: user.id, aula_id: aulaId, product_id: productId }, { onConflict: 'user_id,aula_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
