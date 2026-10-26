// Só para uso no servidor (rotas de API): usa o cliente administrativo.
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { CHUNK_CAMINHOS, MAX_PRODUTOS, caminhosDoVendedor } from '@/lib/audiencia';

// Contexto do vendedor para as rotas de audiência.
// A loja e os produtos vêm do cliente do USUÁRIO (sessão + RLS): o vendedor só obtém os próprios.
// As tabelas site_* (sem políticas de RLS) são lidas com o cliente administrativo,
// SEMPRE filtradas pelos caminhos obtidos acima. Nenhum parâmetro do navegador escolhe loja ou produto.

export type ContextoVendedor = {
  userId: string; // só para EXCLUIR as visitas do próprio vendedor; nunca vai na resposta
  storeId: string;
  slug: string | null;
  produtos: { id: string; titulo: string; status: string; destaque_ate: string | null }[];
  caminhos: string[];
  blocos: string[][];
  limitado: boolean;
};

export async function contextoVendedor(): Promise<{ erro: 401 | 404 } | { ctx: ContextoVendedor }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: 401 };
  const { data: store } = await supabase.from('stores').select('id, slug').eq('owner', user.id).maybeSingle();
  if (!store) return { erro: 404 };

  const { data: prods } = await supabase.from('products')
    .select('id, titulo, status, destaque_ate')
    .eq('store_id', (store as any).id)
    .order('created_at', { ascending: false })
    .limit(MAX_PRODUTOS + 1);
  const lista = ((prods ?? []) as ContextoVendedor['produtos']);
  const limitado = lista.length > MAX_PRODUTOS;
  const produtos = lista.slice(0, MAX_PRODUTOS);

  const caminhos = caminhosDoVendedor((store as any).slug ?? null, produtos.map((p) => p.id));
  const blocos: string[][] = [];
  for (let i = 0; i < caminhos.length; i += CHUNK_CAMINHOS) blocos.push(caminhos.slice(i, i + CHUNK_CAMINHOS));
  return { ctx: { userId: user.id, storeId: (store as any).id, slug: (store as any).slug ?? null, produtos, caminhos, blocos, limitado } };
}

export const PAGINA_PG = 1000;

/** Lê páginas de uma consulta até o teto. Erros viram lista vazia (tabela pode não existir). */
export async function lerTudo<T>(montar: (de: number, ate: number) => any, teto: number): Promise<{ linhas: T[]; cortado: boolean }> {
  const linhas: T[] = [];
  for (let de = 0; de < teto; de += PAGINA_PG) {
    const ate = Math.min(de + PAGINA_PG, teto) - 1;
    const { data, error } = await montar(de, ate);
    if (error || !data) break;
    linhas.push(...(data as T[]));
    if (data.length < ate - de + 1) return { linhas, cortado: false };
  }
  return { linhas, cortado: linhas.length >= teto };
}

export function admin() {
  return createAdminClient();
}
