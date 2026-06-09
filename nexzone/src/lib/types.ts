export type Role = 'comprador' | 'vendedor' | 'ambos' | 'admin';
export type ProductStatus = 'rascunho' | 'em_revisao' | 'ativo' | 'pausado' | 'reprovado';

export interface Product {
  id: string;
  store_id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  categoria: string | null;
  preco: number;
  preco_promo: number | null;
  tipo_entrega: 'arquivo' | 'chave' | 'link' | 'acesso';
  conteudo_entrega: string | null;
  garantia_dias: number;
  status: ProductStatus;
  emoji: string;
  capa_url?: string | null;
  destaque_ate?: string | null;
  vendas: number;
  nota: number;
  created_at: string;
  stores?: { nome: string; nivel: string; slug?: string } | null;
}
