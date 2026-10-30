// Dados de contato dos compradores de uma lista de pedidos (SÓ SERVIDOR, com o cliente administrativo).
// Quem chama já garantiu que os pedidos são do vendedor logado (ou que é admin).
export type ContatoCliente = { nome: string | null; whatsapp: string | null; avisos: boolean };

export async function contatosDosCompradores(admin: any, ids: string[]): Promise<Record<string, ContatoCliente>> {
  const unicos = Array.from(new Set(ids.filter(Boolean))).slice(0, 2000);
  if (!unicos.length) return {};
  let { data, error } = await admin.from('profiles').select('id, nome, whatsapp, whatsapp_avisos').in('id', unicos);
  if (error && /whatsapp/i.test(error.message || '')) ({ data } = await admin.from('profiles').select('id, nome').in('id', unicos));
  const out: Record<string, ContatoCliente> = {};
  for (const p of (data ?? []) as any[]) out[p.id] = { nome: p.nome ?? null, whatsapp: p.whatsapp ?? null, avisos: p.whatsapp_avisos !== false };
  return out;
}

export type CarrinhoAbandonado = {
  id: number; product_id: string; titulo: string; loja: string | null; capa_url: string | null; categoria: string | null; preco: number | null;
  user_id: string | null; email: string; nome: string | null; whatsapp: string | null; avisos: boolean;
  quando: string; lembretes: string[];
};

/**
 * Quem preencheu os dados no checkout e saiu SEM gerar o Pix (SQL 19), nos últimos `dias`.
 * Sai da lista quem depois gerou Pix ou pagou aquele produto (esse aparece em "Aguardando pagamento" ou em Vendas).
 * productIds = só os produtos de uma loja (painel do lojista); sem ele = plataforma inteira (admin).
 */
export async function carrinhosAbandonados(admin: any, opt: { productIds?: string[]; dias?: number } = {}): Promise<CarrinhoAbandonado[]> {
  const dias = opt.dias ?? 30;
  if (opt.productIds && !opt.productIds.length) return [];
  let q = admin.from('carrinhos_abandonados')
    .select('id, product_id, user_id, email, nome, criado_em, atualizado_em, lembrete_1h, lembrete_24h, products(titulo, capa_url, categoria, preco, preco_promo, stores(nome))')
    .is('convertido_em', null)
    .gte('atualizado_em', new Date(Date.now() - dias * 86400000).toISOString())
    .order('atualizado_em', { ascending: false }).limit(500);
  if (opt.productIds) q = q.in('product_id', opt.productIds.slice(0, 1000));
  const { data, error } = await q;
  if (error || !data?.length) return [];
  const carts = data as any[];

  // quem gerou Pix ou comprou o mesmo produto depois de abrir o checkout não é "abandono"
  const prods = Array.from(new Set(carts.map((c) => c.product_id)));
  const desde = new Date(Math.min(...carts.map((c) => new Date(c.criado_em || c.atualizado_em).getTime())) - 10 * 60000).toISOString();
  const { data: pedidos } = await admin.from('orders').select('comprador, comprador_email, product_id, created_at')
    .in('product_id', prods).in('status', ['pendente', 'pago', 'entregue']).gte('created_at', desde).limit(5000);
  const seguiu = (c: any) => ((pedidos ?? []) as any[]).some((o) => o.product_id === c.product_id
    && (o.comprador === c.user_id || String(o.comprador_email || '').toLowerCase() === String(c.email).toLowerCase())
    && new Date(o.created_at).getTime() >= new Date(c.atualizado_em).getTime() - 10 * 60000);

  const abertos = carts.filter((c) => !seguiu(c));
  const contatos = await contatosDosCompradores(admin, abertos.map((c) => c.user_id));
  return abertos.map((c) => {
    const k = c.user_id ? contatos[c.user_id] : undefined;
    const p = c.products || {};
    return {
      id: c.id, product_id: c.product_id, titulo: p.titulo || 'Produto', loja: p.stores?.nome ?? null, capa_url: p.capa_url ?? null, categoria: p.categoria ?? null,
      preco: p.preco_promo ?? p.preco ?? null, user_id: c.user_id, email: c.email, nome: c.nome || k?.nome || null,
      whatsapp: k?.whatsapp ?? null, avisos: k ? k.avisos : false, quando: c.atualizado_em,
      lembretes: [c.lembrete_1h && '1º lembrete', c.lembrete_24h && 'lembrete de 24 h'].filter(Boolean) as string[],
    };
  });
}
