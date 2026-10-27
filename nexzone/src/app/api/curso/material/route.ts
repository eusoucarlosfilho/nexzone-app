import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { acessoAoCurso } from '@/lib/curso-servidor';
import { aulaLiberada } from '@/lib/curso';

export const dynamic = 'force-dynamic';

// Baixa um material da aula: ?aula=<id>&i=<posição>. Arquivo enviado → link temporário (1 h) do bucket privado.
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const u = new URL(req.url);
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(u.pathname + u.search)}`, req.url));
  const aulaId = u.searchParams.get('aula') || '';
  const i = Math.floor(Number(u.searchParams.get('i')));
  if (!/^[0-9a-f-]{36}$/i.test(aulaId) || !(i >= 0)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });

  const admin = createAdminClient();
  const { data: aula } = await admin.from('curso_aulas').select('product_id, materiais, publicada, previa, liberar_apos_dias, curso_modulos(liberar_apos_dias)').eq('id', aulaId).maybeSingle();
  if (!aula || !(aula as any).publicada) return NextResponse.json({ error: 'aula não encontrada' }, { status: 404 });
  const ac = await acessoAoCurso(admin, user.id, (aula as any).product_id);
  const previa = (aula as any).previa === true;
  if (!ac && !previa) return NextResponse.json({ error: 'sem acesso' }, { status: 403 });
  if (ac && !aulaLiberada(ac.compradoEm, (aula as any).curso_modulos?.liberar_apos_dias || 0, (aula as any).liberar_apos_dias || 0, Date.now(), ac.papel !== 'aluno')) {
    return NextResponse.json({ error: 'aula ainda não liberada' }, { status: 403 });
  }
  const m = ((aula as any).materiais ?? [])[i];
  if (!m) return NextResponse.json({ error: 'material não encontrado' }, { status: 404 });
  if (m.url) return NextResponse.redirect(m.url);
  if (!m.path) return NextResponse.json({ error: 'material não encontrado' }, { status: 404 });
  const { data, error } = await admin.storage.from('entregaveis').createSignedUrl(m.path, 3600, { download: m.nome || true });
  if (error || !data) return NextResponse.json({ error: 'falha ao gerar link' }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
