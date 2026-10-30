// Central de ajuda do pedido (puro, testado em testes/pos-compra.test.js).
export type OpcaoAjuda = 'nao_recebi' | 'nao_funciona' | 'diferente' | 'duvida' | 'desistir';

export const OPCOES_AJUDA: { id: OpcaoAjuda; rotulo: string; dica: string; icone: string }[] = [
  { id: 'nao_recebi', rotulo: 'Não recebi o produto', dica: 'O acesso, o arquivo ou a entrega não chegou', icone: 'package' },
  { id: 'nao_funciona', rotulo: 'O acesso não funciona', dica: 'Link quebrado, senha errada, não abre', icone: 'alert' },
  { id: 'diferente', rotulo: 'É diferente do anunciado', dica: 'O que recebi não bate com o anúncio', icone: 'search' },
  { id: 'duvida', rotulo: 'Tenho uma dúvida', dica: 'Como usar, prazo de entrega, outra pergunta', icone: 'help' },
  { id: 'desistir', rotulo: 'Quero desistir da compra', dica: 'Direito de arrependimento dentro da garantia', icone: 'undo' },
];

/** Motivo do formulário de reembolso já marcado conforme o que a pessoa escolheu. */
export function motivoReembolsoDe(op: OpcaoAjuda | 'reembolso' | null): string {
  switch (op) {
    case 'nao_recebi': return 'nao_recebi';
    case 'nao_funciona': return 'problema_tecnico';
    case 'diferente': return 'nao_era_o_esperado';
    case 'desistir': return 'arrependimento';
    default: return '';
  }
}
