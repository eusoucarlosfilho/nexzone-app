import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { avisarProdutoModerado } from '@/lib/whatsapp/avisos';
import { tornarFundador } from '@/lib/campanhas-servidor';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const { id, action } = await req.json();
  const status = action === 'aprovar' ? 'ativo' : 'reprovado';
  const { error } = await supabase.from('products').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: 'falha' }, { status: 500 });
  // Marca as alterações pendentes como revisadas (SQL 09). Sem a tabela: ignora.
  try {
    await createAdminClient().from('product_edicoes')
      .update({ revisado_em: new Date().toISOString(), revisado_por: user.id, decisao: status === 'ativo' ? 'aprovado' : 'reprovado' })
      .eq('product_id', id).is('revisado_em', null);
  } catch { /* sem SQL 09 */ }
  // Moderação (SQL 14): aprovar limpa a correção pedida e registra no histórico. Sem o SQL 14: ignora.
  try {
    const adm = createAdminClient();
    if (status === 'ativo') await adm.from('products').update({ moderacao: null, moderacao_itens: [], moderacao_texto: null, moderacao_em: null }).eq('id', id).neq('moderacao', 'cancelado');
    await adm.from('product_moderacao').insert({ product_id: id, admin_id: user.id, acao: status === 'ativo' ? 'aprovar' : 'reprovar', itens: [], status_depois: status });
  } catch { /* sem SQL 14 */ }
  // Lojista Fundador (SQL 28): 1º produto aprovado garante a vaga (enquanto houver) + destaque grátis nele
  if (status === 'ativo') {
    const { data: pr } = await createAdminClient().from('products').select('store_id').eq('id', id).maybeSingle();
    if ((pr as any)?.store_id) await tornarFundador(createAdminClient(), (pr as any).store_id, String(id));
  }
  await avisarProdutoModerado(String(id), status === 'ativo'); // WhatsApp (se ligado); nunca lança erro
  await registrarAcao({ adminId: user.id, acao: status === 'ativo' ? 'produto_aprovado' : 'produto_reprovado', alvoTipo: 'produto', alvoId: String(id) }); // quem aprovou (SQL 34)
  return NextResponse.json({ ok: true, status });
}
