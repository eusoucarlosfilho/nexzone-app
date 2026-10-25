import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { redirect } from 'next/navigation';
import ProductManager from './ProductManager';

export const dynamic = 'force-dynamic';

// Colunas que o painel do vendedor usa (lista + edição do PRÓPRIO produto).
// O conteúdo de entrega entra porque o formulário de edição mostra o valor atual ao dono;
// esta página só é acessível ao dono da loja (RLS de products por loja do usuário).
const COLUNAS_VENDEDOR =
  'id, titulo, descricao, categoria, preco, preco_promo, tipo_entrega, conteudo_entrega, garantia_dias, status, emoji, capa_url, imagens, arquivo_path, arquivo_nome, destaque_ate, vendas, nota, created_at';

export default async function ProdutosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  const { boost_plans } = await getSettings();
  const { data: produtos } = store
    ? await supabase.from('products').select(COLUNAS_VENDEDOR).eq('store_id', store.id).order('created_at', { ascending: false })
    : { data: [] as any[] };

  return (
    <div>
      <div className="pm-head">
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Meus produtos</h1>
          <p className="muted">Gerencie seus anúncios, acompanhe a revisão e destaque os produtos ativos.</p>
        </div>
        <Link href="/vender/produtos/novo" className="btn btn-pri">+ Cadastrar novo produto</Link>
      </div>
      <ProductManager products={(produtos ?? []) as any[]} userId={user.id} planos={boost_plans} />
    </div>
  );
}
