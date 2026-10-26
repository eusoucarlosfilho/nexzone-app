// ============================================================
// Como o vendedor aparece no site público.
// Quando o admin liga "Vender como Comprei Barato" (stores.ocultar_vendedor),
// o comprador vê "Comprei Barato" no lugar da loja: nome, link, logo e cor.
// O Admin continua vendo o nome real; pagamento e repasse não mudam.
//
// Regra de ouro: aplique ANTES de entregar os dados para a página/componente,
// para o nome real nunca chegar ao navegador.
// ============================================================

export const COMPREI_BARATO = {
  nome: 'Comprei Barato',
  slug: null as string | null,
  nivel: 'oficial',
  logo_url: '/logo.png',
  cor: '#FF6B00',
  oficial: true,
  verificada: true,
};

export type VendedorPublico = {
  nome: string;
  slug: string | null;
  nivel: string;
  logo_url: string | null;
  cor: string | null;
  oficial: boolean;
  /** true só quando a loja está com status 'verificado' (ou é a loja oficial). Sem o status, false. */
  verificada: boolean;
};

/** Dados públicos do vendedor: Comprei Barato se a loja estiver oculta; senão, os dados reais. */
export function vendedorPublico(store: any): VendedorPublico {
  if (store?.ocultar_vendedor === true || store?.oficial === true) return { ...COMPREI_BARATO };
  return {
    nome: store?.nome ?? 'Loja',
    slug: store?.slug ?? null,
    nivel: store?.nivel ?? '',
    logo_url: store?.logo_url ?? null,
    cor: store?.cor ?? null,
    oficial: false,
    // status vem da consulta; verificada já vem quando o objeto passou por aqui antes (produtosPublicos + ProductCard)
    verificada: store?.status === 'verificado' || store?.verificada === true,
  };
}

/** Troca o `stores` de um produto pela versão pública. Não altera o objeto original. */
export function produtoPublico<T extends { stores?: any }>(p: T): T {
  if (!p) return p;
  return { ...p, stores: p.stores ? vendedorPublico(p.stores) : p.stores };
}

/** Versão para listas de produtos. */
export function produtosPublicos<T extends { stores?: any }>(lista: T[] | null | undefined): T[] {
  return (lista ?? []).map(produtoPublico);
}
