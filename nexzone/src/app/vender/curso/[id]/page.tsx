import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { donoDoProduto } from '@/lib/curso-servidor';
import EditorCurso from './EditorCurso';

export const dynamic = 'force-dynamic';

export default async function CursoEditorPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/vender/curso/${params.id}`);
  const d = await donoDoProduto(createAdminClient(), user.id, params.id);
  if (!d.ok) notFound();
  return (
    <div>
      <Link href="/vender/produtos" className="muted" style={{ fontSize: 13 }}>‹ Voltar aos produtos</Link>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, margin: '8px 0 4px' }}>Área de membros</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Monte as aulas de <strong>{d.titulo}</strong>. Quem compra (inclusive como item extra) entra direto na área do aluno, com progresso e certificado.</p>
      <EditorCurso productId={params.id} userId={user.id} />
    </div>
  );
}
