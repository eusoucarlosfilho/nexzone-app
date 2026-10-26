import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { redirect } from 'next/navigation';
import ProductManager from './ProductManager';
import OcultarMinhaLoja from './OcultarMinhaLoja';
import { idsAdminConfigurados } from '@/lib/ofertas/adminSeguro';
import { termoBusca } from '@/lib/consultas';
import { extrasDe, EXTRAS_VAZIO } from '@/lib/estoque';

export const dynamic = 'force-dynamic';

// Lista de Meus produtos: só o que a listagem mostra.
// Conteúdo de entrega, arquivo e descrição NÃO vão para o navegador aqui:
// a edição busca esses campos sob demanda em GET /api/seller/product?id= (com checagem de dono).
const COLUNAS_LISTA = 'id, titulo, categoria, preco, preco_promo, status, capa_url, destaque_ate, vendas, nota, created_at';
const POR_PAGINA = 10;

const ORDENS: Record<string, { col: string; asc: boolean }> = {
  recentes: { col: 'created_at', asc: false },
  antigos: { col: 'created_at', asc: true },
  preco_menor: { col: 'preco', asc: true },
  preco_maior: { col: 'preco', asc: false },
  vendas: { col: 'vendas', asc: false },
  nota: { col: 'nota', asc: false },
};
const FILTROS = ['todos', 'ativo', 'em_revisao', 'parados', 'destaque'] as const;

type SP = { q?: string; status?: string; cat?: string; ordem?: string; page?: string };

export default async function ProdutosPage({ searchParams }: { searchParams: SP }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vender/produtos');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();

  // Admin que também é lojista: pode ocultar o nome da própria loja (mesma regra do Admin: papel admin + ADMIN_USER_IDS)
  let lojaAdmin: { id: string; nome: string; oculto: boolean } | null = null;
  if (store) {
    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if ((perfil as any)?.role === 'admin' && idsAdminConfigurados().includes(user.id.toLowerCase())) {
      const { data: vis } = await supabase.from('stores').select('nome, ocultar_vendedor').eq('id', store.id).maybeSingle();
      if (vis) lojaAdmin = { id: store.id, nome: (vis as any).nome || 'Minha loja', oculto: (vis as any).ocultar_vendedor === true };
    }
  }
  const { boost_plans } = await getSettings();

  const filtro = (FILTROS as readonly string[]).includes(searchParams.status || '') ? (searchParams.status as string) : 'todos';
  const ordemKey = searchParams.ordem && ORDENS[searchParams.ordem] ? searchParams.ordem : 'recentes';
  const ordem = ORDENS[ordemKey];
  const termo = termoBusca(searchParams.q);
  const cat = (searchParams.cat || '').slice(0, 80);
  const pagina = Math.max(1, Math.floor(Number(searchParams.page) || 1));
  const agoraIso = new Date().toISOString();

  let produtos: any[] = [];
  let total = 0;
  let estoqueAtivo = false;
  let stats = { total: 0, ativo: 0, em_revisao: 0, parados: 0, destaque: 0 };
  let categorias: string[] = [];

  if (store) {
    const base = () => supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id);
    // Indicadores: contagens no banco (não dependem de carregar a lista inteira)
    const [cTotal, cAtivo, cRev, cParados, cDest, cats] = await Promise.all([
      base(),
      base().eq('status', 'ativo'),
      base().eq('status', 'em_revisao'),
      base().in('status', ['reprovado', 'pausado']),
      base().gt('destaque_ate', agoraIso),
      // categorias usadas pelo vendedor (só a coluna, com teto)
      supabase.from('products').select('categoria').eq('store_id', store.id).not('categoria', 'is', null).limit(1000),
    ]);
    stats = {
      total: cTotal.count ?? 0, ativo: cAtivo.count ?? 0, em_revisao: cRev.count ?? 0,
      parados: cParados.count ?? 0, destaque: cDest.count ?? 0,
    };
    categorias = Array.from(new Set(((cats.data ?? []) as { categoria: string }[]).map((c) => c.categoria).filter(Boolean))).sort();

    // Página atual da lista: filtro, busca, ordem e intervalo no SERVIDOR
    let q = supabase.from('products').select(COLUNAS_LISTA, { count: 'exact' }).eq('store_id', store.id);
    if (filtro === 'ativo') q = q.eq('status', 'ativo');
    if (filtro === 'em_revisao') q = q.eq('status', 'em_revisao');
    if (filtro === 'parados') q = q.in('status', ['reprovado', 'pausado']);
    if (filtro === 'destaque') q = q.gt('destaque_ate', agoraIso);
    if (termo) q = q.ilike('titulo', `%${termo}%`);
    if (cat) q = q.eq('categoria', cat);
    q = q.order(ordem.col, { ascending: ordem.asc }).order('id', { ascending: true });
    const de = (pagina - 1) * POR_PAGINA;
    const { data, count } = await q.range(de, de + POR_PAGINA - 1);
    produtos = (data ?? []) as any[];
    total = count ?? produtos.length;
    // Estoque (SQL 07). Sem o SQL 07: estoqueAtivo = false e o campo não aparece.
    const extras = await extrasDe(supabase, produtos.map((p) => p.id));
    estoqueAtivo = Object.keys(extras).length > 0;
    produtos = produtos.map((p) => ({ ...p, ...(extras[p.id] ?? EXTRAS_VAZIO) }));
  }

  return (
    <div>
      <div className="pm-head">
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Meus produtos</h1>
          <p className="muted">Gerencie seus anúncios, acompanhe a revisão e destaque os produtos ativos.</p>
        </div>
        <Link href="/vender/produtos/novo" className="btn btn-pri">+ Cadastrar novo produto</Link>
      </div>
      {lojaAdmin && <OcultarMinhaLoja storeId={lojaAdmin.id} nomeLoja={lojaAdmin.nome} ocultoInicial={lojaAdmin.oculto} />}
      <ProductManager
        products={produtos}
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        stats={stats}
        categorias={categorias}
        filtros={{ q: searchParams.q || '', status: filtro, cat, ordem: ordemKey }}
        userId={user.id}
        planos={boost_plans}
        estoqueAtivo={estoqueAtivo}
      />
    </div>
  );
}
