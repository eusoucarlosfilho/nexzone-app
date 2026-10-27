import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { acessoAoCurso, carregarCurso } from '@/lib/curso-servidor';
import { codigoCertificado, progresso } from '@/lib/curso';

export const dynamic = 'force-dynamic';

// Emite (ou devolve) o certificado do aluno que concluiu 100% das aulas. { productId, nome? }
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const productId = String(b.productId || '');
  const admin = createAdminClient();
  const ac = await acessoAoCurso(admin, user.id, productId);
  if (!ac || ac.papel !== 'aluno') return NextResponse.json({ error: 'O certificado é só para alunos que compraram o curso.' }, { status: 403 });

  const { data: ja } = await admin.from('curso_certificados').select('codigo').eq('user_id', user.id).eq('product_id', productId).maybeSingle();
  if (ja) return NextResponse.json({ ok: true, codigo: (ja as any).codigo });

  const c = await carregarCurso(admin, productId);
  if (!c.config.ativo || !c.config.certificado) return NextResponse.json({ error: 'Este curso não emite certificado.' }, { status: 400 });
  const { data: feitas } = await admin.from('curso_progresso').select('aula_id').eq('user_id', user.id).eq('product_id', productId).limit(10000);
  const p = progresso(c.modulos, ((feitas ?? []) as any[]).map((r) => r.aula_id));
  if (!p.completo) return NextResponse.json({ error: `Conclua todas as aulas para liberar o certificado (${p.feitas} de ${p.total}).` }, { status: 400 });

  const nome = String(b.nome || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!/\S+\s+\S+/.test(nome)) return NextResponse.json({ error: 'Informe seu nome completo, como deve aparecer no certificado.' }, { status: 400 });
  const { data: prod } = await admin.from('products').select('titulo').eq('id', productId).maybeSingle();
  const horas = c.config.carga_horaria ?? (p.minutos ? Math.max(1, Math.round(p.minutos / 60)) : null);

  for (let t = 0; t < 5; t++) {
    const codigo = codigoCertificado();
    const { error } = await admin.from('curso_certificados').insert({
      codigo, user_id: user.id, product_id: productId, nome_aluno: nome, titulo_curso: (prod as any)?.titulo || 'Curso', carga_horaria: horas,
    });
    if (!error) return NextResponse.json({ ok: true, codigo });
    if (!/duplicate|unique/i.test(error.message || '')) { console.error('[certificado]', error.message); break; }
    const { data: outra } = await admin.from('curso_certificados').select('codigo').eq('user_id', user.id).eq('product_id', productId).maybeSingle();
    if (outra) return NextResponse.json({ ok: true, codigo: (outra as any).codigo });
  }
  return NextResponse.json({ error: 'Não foi possível emitir agora. Tente de novo.' }, { status: 500 });
}
