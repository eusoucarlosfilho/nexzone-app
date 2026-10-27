import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { acessoAoCurso, carregarCurso } from '@/lib/curso-servidor';
import { aulaLiberada, liberaEm } from '@/lib/curso';
import { vendedorPublico } from '@/lib/vendedorPublico';
import PlayerCurso, { type AulaAluno, type ModuloAluno } from './PlayerCurso';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Área de membros · Comprei Barato', robots: { index: false } };

// Área do aluno. Quem comprou (produto ou item extra), o dono da loja e o admin veem tudo que já foi liberado.
// Sem compra: só as aulas marcadas como "prévia grátis".
export default async function CursoPage({ params, searchParams }: { params: { id: string }; searchParams?: { aula?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: prod } = await admin.from('products').select('id, titulo, capa_url, categoria, store_id, stores(nome, ocultar_vendedor, slug)').eq('id', params.id).maybeSingle();
  if (!prod) notFound();
  const curso = await carregarCurso(admin, params.id);
  const ac = user ? await acessoAoCurso(admin, user.id, params.id) : null;
  const dono = !!ac && ac.papel !== 'aluno';
  if (!curso.sql18 || (!curso.config.ativo && !dono)) {
    if (ac) redirect(ac.pedidoId ? `/pedido/${ac.pedidoId}` : '/minhas-compras');
    redirect(`/produto/${params.id}`);
  }
  const temPrevia = curso.modulos.some((m) => m.aulas.some((a) => a.previa && a.publicada));
  if (!ac) {
    if (!temPrevia) redirect(user ? `/produto/${params.id}` : `/login?next=${encodeURIComponent(`/curso/${params.id}`)}`);
  }

  // Progresso do aluno
  let concluidas: string[] = [];
  let certificado: string | null = null;
  if (user && ac) {
    const [{ data: pr }, { data: cert }] = await Promise.all([
      admin.from('curso_progresso').select('aula_id').eq('user_id', user.id).eq('product_id', params.id).limit(10000),
      admin.from('curso_certificados').select('codigo').eq('user_id', user.id).eq('product_id', params.id).maybeSingle(),
    ]);
    concluidas = ((pr ?? []) as any[]).map((r) => r.aula_id);
    certificado = (cert as any)?.codigo ?? null;
  }
  const { data: perfil } = user ? await admin.from('profiles').select('nome').eq('id', user.id).maybeSingle() : { data: null };

  // Só manda para o navegador o conteúdo que a pessoa pode ver (aula bloqueada vai sem vídeo/texto/materiais)
  const agora = Date.now();
  const modulos: ModuloAluno[] = curso.modulos.map((m) => ({
    id: m.id, titulo: m.titulo,
    aulas: m.aulas.filter((a) => a.publicada || dono).map((a): AulaAluno => {
      const liberada = ac ? aulaLiberada(ac.compradoEm, m.liberar_apos_dias, a.liberar_apos_dias, agora, dono) : a.previa;
      const pode = liberada || (!ac && a.previa);
      const quando = ac && !liberada ? liberaEm(ac.compradoEm, m.liberar_apos_dias, a.liberar_apos_dias) : null;
      return {
        id: a.id, titulo: a.titulo, duracao_min: a.duracao_min, previa: a.previa, publicada: a.publicada,
        liberada: pode, liberaEm: quando ? quando.toISOString() : null,
        video_url: pode ? a.video_url : null, conteudo: pode ? a.conteudo : null,
        materiais: pode ? a.materiais.map((x) => ({ titulo: x.titulo, tipo: x.path ? 'arquivo' as const : 'link' as const })) : [],
      };
    }),
  })).filter((m) => m.aulas.length || dono);

  const loja = vendedorPublico((prod as any).stores);
  return (
    <>
      <Nav />
      <PlayerCurso
        productId={params.id}
        titulo={(prod as any).titulo}
        capa={(prod as any).capa_url}
        loja={loja.nome}
        config={curso.config}
        modulos={modulos}
        concluidasIniciais={concluidas}
        aulaInicial={searchParams?.aula ?? null}
        papel={ac?.papel ?? 'visitante'}
        pedidoId={ac?.pedidoId ?? null}
        certificado={certificado}
        nomeAluno={(perfil as any)?.nome || ''}
      />
    </>
  );
}
