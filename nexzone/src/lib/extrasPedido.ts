// Itens extras (order bumps) de um pedido, no formato que a página do pedido mostra.
// Só devolve conteúdo quando o pedido está pago/entregue. Caminho do arquivo nunca sai daqui:
// o download passa por /api/download?which=bump&i=<posição>, que confere o comprador e o pagamento.
export type ExtraPedido = { i: number; titulo: string; conteudo: string | null; temArquivo: boolean };

export function extrasDoPedido(order: any): ExtraPedido[] {
  if (!order) return [];
  const pago = order.status === 'pago' || order.status === 'entregue';
  const lista: any[] = Array.isArray(order.bumps) && order.bumps.length
    ? order.bumps
    : order.bump_titulo || order.bump_product_id
      ? [{ titulo: order.bump_titulo, conteudo: order.bump_conteudo, arquivo_path: order.bump_arquivo_path }]
      : [];
  return lista.slice(0, 4).map((b, i) => ({
    i,
    titulo: String(b?.titulo || 'Item extra'),
    conteudo: pago && b?.conteudo ? String(b.conteudo) : null,
    temArquivo: pago && !!b?.arquivo_path,
  }));
}

/** Caminho do arquivo do extra na posição i (uso exclusivo no servidor). */
export function arquivoDoExtra(order: any, i: number): string | null {
  const n = Number.isInteger(i) && i >= 0 && i < 4 ? i : 0;
  if (Array.isArray(order?.bumps) && order.bumps.length) return order.bumps[n]?.arquivo_path || null;
  return n === 0 ? order?.bump_arquivo_path || null : null;
}
