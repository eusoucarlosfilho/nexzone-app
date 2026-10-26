// Aplica uma ação de moderação (servidor, service_role) e avisa o vendedor.
// Usado pelo Admin → Produtos → Gerenciar e pela Fila de Aprovação.
import { efeitoModeracao, avisoParaVendedor, type PedidoModeracao } from './moderacao';
import { sendEmail, layoutEmail, textoParaHtml, emailDoUsuario, SITE_URL } from './email';
import { avisarProdutoModerado } from './whatsapp/avisos';

export async function aplicarModeracao(admin: any, adminId: string, productId: string, pedido: PedidoModeracao):
  Promise<{ ok: true; status: string; moderacao: string | null } | { ok: false; erro: string; status?: number }> {
  const { data: p } = await admin.from('products').select('id, titulo, status, store_id, stores(owner)').eq('id', productId).maybeSingle();
  if (!p) return { ok: false, erro: 'Produto não encontrado.', status: 404 };

  const ef = efeitoModeracao(pedido.acao);
  const agora = new Date().toISOString();
  const { error } = await admin.from('products').update({
    status: ef.status,
    moderacao: ef.moderacao,
    moderacao_itens: ef.moderacao ? pedido.itens : [],
    moderacao_texto: ef.moderacao ? (pedido.texto || null) : null,
    moderacao_em: ef.moderacao ? agora : null,
  }).eq('id', productId);
  if (error) {
    console.error('[moderacao]', error.message);
    const semSql = /moderacao/i.test(error.message || '');
    return { ok: false, erro: semSql ? 'A moderação ainda não foi ativada no banco (rode o SQL 14).' : 'Não foi possível salvar.', status: 500 };
  }

  // Histórico e alterações pendentes (a decisão encerra a revisão das edições — SQL 09)
  await Promise.allSettled([
    admin.from('product_moderacao').insert({
      product_id: productId, admin_id: adminId, acao: pedido.acao, itens: pedido.itens,
      texto: pedido.texto || null, status_antes: (p as any).status, status_depois: ef.status,
    }),
    admin.from('product_edicoes')
      .update({ revisado_em: agora, revisado_por: adminId, decisao: ef.status === 'ativo' ? 'aprovado' : 'reprovado' })
      .eq('product_id', productId).is('revisado_em', null),
  ]);

  // Avisos ao vendedor: sino (aviso no site), e-mail e WhatsApp. Nenhum deles trava a ação.
  const owner = (p as any)?.stores?.owner as string | undefined;
  if (owner) {
    const { assunto, corpo } = avisoParaVendedor(pedido.acao, String((p as any).titulo || 'Produto'), pedido.itens, pedido.texto);
    await Promise.allSettled([
      admin.from('user_notices').insert({ user_id: owner, tipo: 'aviso', texto: `${assunto}\n\n${corpo}`.slice(0, 2000), autor_admin: adminId, lida: false }),
      (async () => {
        const to = await emailDoUsuario(admin, owner);
        if (!to) return;
        await sendEmail({
          to, subject: assunto, tag: 'outro',
          html: layoutEmail({
            titulo: assunto, preheader: assunto, texto: textoParaHtml(corpo),
            botaoTexto: pedido.acao === 'reativar' ? 'Ver anúncio' : 'Abrir Meus produtos',
            botaoUrl: pedido.acao === 'reativar' ? `${SITE_URL}/produto/${productId}` : `${SITE_URL}/vender/produtos`,
          }),
        });
      })(),
      avisarProdutoModerado(productId, pedido.acao === 'reativar'),
    ]);
  }
  return { ok: true, status: ef.status, moderacao: ef.moderacao };
}
