// ============================================================
// Prova social da página inicial — SEMPRE com números reais.
// USO EXCLUSIVO NO SERVIDOR (recebe o client admin / service_role).
// Não existe aqui nenhum "número extra", multiplicador ou crescimento automático.
// ============================================================

export type ProvaSocialNumeros = {
  lojas: number;     // lojas com pelo menos 1 produto ativo à venda (loja suspensa não conta)
  produtos: number;  // produtos com status 'ativo'
  vendas: number;    // pedidos com status 'pago' ou 'entregue'
};

export type VendaRecente = {
  uf: string | null; // UF aproximada do comprador (da sessão do site); null quando não se sabe
  produto: string;
  em: string;        // data/hora do pedido (ISO)
};

export async function numerosReais(admin: any): Promise<ProvaSocialNumeros> {
  const [prodRes, vendasRes, suspRes] = await Promise.all([
    admin.from('products').select('store_id').eq('status', 'ativo'),
    admin.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pago', 'entregue']),
    admin.from('stores').select('id').eq('status', 'suspenso'),
  ]);
  const prods = (prodRes.data ?? []) as { store_id: string | null }[];
  const suspensas = new Set(((suspRes.data ?? []) as { id: string }[]).map((s) => s.id));
  const lojas = new Set(prods.map((p) => p.store_id).filter((id): id is string => !!id && !suspensas.has(id)));
  return { lojas: lojas.size, produtos: prods.length, vendas: vendasRes.count ?? 0 };
}

// Pedidos reais pagos/entregues dos últimos 7 dias. Nunca devolve nome, e-mail nem id do comprador.
export async function vendasRecentes(admin: any, limite = 8): Promise<VendaRecente[]> {
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: pedidos } = await admin.from('orders')
    .select('comprador, created_at, products(titulo)')
    .in('status', ['pago', 'entregue'])
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(limite);
  const lista = (pedidos ?? []) as any[];
  if (!lista.length) return [];

  // UF aproximada: última sessão do site do comprador no Brasil (headers de geolocalização da Vercel).
  const ids = Array.from(new Set(lista.map((p) => p.comprador).filter(Boolean)));
  const ufPor: Record<string, string> = {};
  if (ids.length) {
    const { data: sess } = await admin.from('site_sessions')
      .select('user_id, region, last_seen')
      .in('user_id', ids).eq('country', 'BR').not('region', 'is', null)
      .order('last_seen', { ascending: false }).limit(200);
    for (const s of (sess ?? []) as any[]) {
      const uf = String(s.region || '').toUpperCase();
      if (s.user_id && !ufPor[s.user_id] && /^[A-Z]{2}$/.test(uf)) ufPor[s.user_id] = uf;
    }
  }

  return lista
    .filter((p) => p.products?.titulo)
    .map((p) => ({ uf: ufPor[p.comprador] ?? null, produto: String(p.products.titulo), em: p.created_at }));
}
