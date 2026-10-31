// ============================================================
// Moderação de anúncios pelo admin (SQL 14).
//
//   correcao       → sai do ar; o vendedor vê "O que corrigir", corrige e reenvia para a fila
//   pausado_admin  → sai do ar e fica TRAVADO: só o admin reativa
//   cancelado      → sai do site de vez (fica só como histórico no admin)
//   reativar       → volta ao ar e limpa a moderação
// ============================================================

export type AcaoModeracao = 'correcao' | 'pausar' | 'cancelar' | 'reativar';
export type EstadoModeracao = 'correcao' | 'pausado_admin' | 'cancelado' | null;

export const ITENS_MODERACAO: { id: string; rotulo: string; orientacao: string }[] = [
  { id: 'foto', rotulo: 'Foto ruim ou com marca d’água', orientacao: 'Troque as fotos por imagens nítidas, sem marca d’água de outros sites.' },
  { id: 'titulo', rotulo: 'Título enganoso', orientacao: 'Ajuste o título para dizer exatamente o que o comprador recebe.' },
  { id: 'descricao', rotulo: 'Descrição incompleta', orientacao: 'Complete a descrição: o que é, o que está incluso, como é entregue e para quem serve.' },
  { id: 'categoria', rotulo: 'Categoria errada', orientacao: 'Escolha a categoria que corresponde ao produto.' },
  { id: 'preco', rotulo: 'Preço inconsistente', orientacao: 'Revise o preço e o preço promocional (o promocional precisa ser real e menor).' },
  { id: 'entrega', rotulo: 'Entrega não cadastrada ou link quebrado', orientacao: 'Cadastre o arquivo ou um link de entrega que funcione.' },
  { id: 'proibido', rotulo: 'Produto proibido ou revenda não autorizada', orientacao: 'Este tipo de produto não pode ser vendido na plataforma sem autorização do dono dos direitos.' },
  { id: 'contato_externo', rotulo: 'Link, contato ou outro site', orientacao: 'Retire links, @, WhatsApp, telefone e nomes de outros sites do título, da descrição e das imagens. A conversa e o pagamento acontecem só pelo Comprei Barato.' },
  { id: 'promessa', rotulo: 'Promessa irreal', orientacao: 'Remova promessas de resultado garantido, ganhos ou curas que não possam ser comprovadas.' },
];
const IDS = new Set(ITENS_MODERACAO.map((i) => i.id));
export const rotuloItem = (id: string) => ITENS_MODERACAO.find((i) => i.id === id)?.rotulo ?? id;
export const orientacaoItem = (id: string) => ITENS_MODERACAO.find((i) => i.id === id)?.orientacao ?? '';

export const TEXTO_MAX = 1500;

export type PedidoModeracao = { acao: AcaoModeracao; itens: string[]; texto: string };

/** Valida o que o admin enviou. Correção precisa de pelo menos um item ou texto; pausar e cancelar precisam de motivo. */
export function validarModeracao(raw: any): { ok: true; pedido: PedidoModeracao } | { ok: false; erro: string } {
  const acao = raw?.acao;
  if (!['correcao', 'pausar', 'cancelar', 'reativar'].includes(acao)) return { ok: false, erro: 'Ação inválida.' };
  const itens: string[] = Array.from(new Set((Array.isArray(raw?.itens) ? raw.itens : []).map(String).filter((i: string) => IDS.has(i))));
  const texto = typeof raw?.texto === 'string' ? raw.texto.replace(/\r\n?/g, '\n').trim().slice(0, TEXTO_MAX) : '';
  if (acao === 'correcao' && !itens.length && !texto) return { ok: false, erro: 'Marque pelo menos um item ou escreva o que precisa ser corrigido.' };
  if ((acao === 'pausar' || acao === 'cancelar') && !itens.length && !texto) return { ok: false, erro: 'Informe o motivo (marque um item ou escreva).' };
  return { ok: true, pedido: { acao, itens: acao === 'reativar' ? [] : itens, texto } };
}

/** Novo status e estado de moderação para cada ação. */
export function efeitoModeracao(acao: AcaoModeracao): { status: 'ativo' | 'pausado' | 'reprovado'; moderacao: EstadoModeracao } {
  switch (acao) {
    case 'correcao': return { status: 'reprovado', moderacao: 'correcao' };
    case 'pausar': return { status: 'pausado', moderacao: 'pausado_admin' };
    case 'cancelar': return { status: 'reprovado', moderacao: 'cancelado' };
    default: return { status: 'ativo', moderacao: null };
  }
}

/** Texto do aviso enviado ao vendedor (sino, e-mail). */
export function avisoParaVendedor(acao: AcaoModeracao, titulo: string, itens: string[], texto: string): { assunto: string; corpo: string } {
  const lista = itens.map((i) => `• ${rotuloItem(i)}: ${orientacaoItem(i)}`).join('\n');
  const obs = texto ? `\n\nObservação da equipe:\n${texto}` : '';
  switch (acao) {
    case 'correcao':
      return {
        assunto: `Seu anúncio "${titulo}" precisa de ajustes`,
        corpo: `O anúncio "${titulo}" saiu do ar até ser corrigido.${lista ? `\n\nO que corrigir:\n${lista}` : ''}${obs}\n\nEm Meus produtos, clique em Editar, faça os ajustes e salve. Ele volta para a revisão da equipe.`,
      };
    case 'pausar':
      return {
        assunto: `Seu anúncio "${titulo}" foi pausado pela equipe`,
        corpo: `O anúncio "${titulo}" foi pausado pela equipe do Comprei Barato e não aparece no site.${lista ? `\n\nMotivo:\n${lista}` : ''}${obs}\n\nSe tiver dúvidas, fale com o suporte.`,
      };
    case 'cancelar':
      return {
        assunto: `Seu anúncio "${titulo}" foi cancelado`,
        corpo: `O anúncio "${titulo}" foi cancelado pela equipe do Comprei Barato e saiu do site.${lista ? `\n\nMotivo:\n${lista}` : ''}${obs}\n\nOs pedidos já feitos continuam disponíveis para os compradores. Se tiver dúvidas, fale com o suporte.`,
      };
    default:
      return { assunto: `Seu anúncio "${titulo}" voltou ao ar`, corpo: `O anúncio "${titulo}" foi liberado pela equipe e já aparece no site.` };
  }
}

export const ROTULO_ESTADO: Record<string, string> = {
  correcao: 'Correção pedida', pausado_admin: 'Pausado pela equipe', cancelado: 'Cancelado pela equipe',
};
export const ROTULO_ACAO: Record<string, string> = {
  correcao: 'Pediu correção', pausar: 'Pausou (travado)', cancelar: 'Cancelou o anúncio', reativar: 'Reativou / aprovou', aprovar: 'Aprovou', reprovar: 'Reprovou',
};
