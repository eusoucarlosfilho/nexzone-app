// ============================================================
// Colunas usadas nas consultas PÚBLICAS de produtos.
// Regra: páginas públicas pedem só o que a vitrine mostra.
// NUNCA incluir conteudo_entrega, arquivo_path, arquivo_nome, checkout_config,
// bump_*, bumps ou qualquer dado interno — eles não podem chegar ao navegador.
//
// Isso reduz a exposição na interface, mas NÃO substitui a correção de
// permissões no banco (achado K1: a política de leitura de products ainda
// libera essas colunas pela API). Ver INVENTARIO_COMPREI_BARATO.md.
// ============================================================

// Loja: o que a vitrine precisa para mostrar nome, link, selo e "vendido por Comprei Barato".
// status entra só para decidir o selo de verificada (a RLS só devolve lojas verificadas ao público).
export const LOJA_PUBLICA = 'stores(nome, nivel, slug, status, ocultar_vendedor)';

// Card de produto (vitrines, listagens, busca, relacionados).
export const PRODUTO_CARD =
  `id, store_id, titulo, categoria, preco, preco_promo, capa_url, destaque_ate, vendas, nota, created_at, ${LOJA_PUBLICA}`;

// Página do produto: card + descrição, entrega (só o TIPO), garantia e galeria.
export const PRODUTO_PAGINA =
  `id, store_id, titulo, descricao, categoria, preco, preco_promo, tipo_entrega, garantia_dias, status, capa_url, imagens, destaque_ate, vendas, nota, created_at, ${LOJA_PUBLICA}`;

// Escapa os curingas do LIKE/ILIKE para a busca do usuário ser literal ("%" não traz tudo).
export function termoBusca(q: string | null | undefined): string {
  return String(q ?? '').trim().slice(0, 100).replace(/[\\%_]/g, (c) => '\\' + c);
}
