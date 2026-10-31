// ============================================================
// Inteligência Comercial (Admin) e métricas de divulgação (vendedor). PURO: testado em testes/inteligencia.test.js.
//
// Unidades (nunca misturadas):
//  • funil = SESSÕES (uma visita de um navegador; 30 min parado = nova sessão);
//  • visitantes únicos = navegadores anônimos (visitor_id), não pessoas;
//  • compras = PEDIDOS com pagamento confirmado pelo gateway (status pago/entregue: só o processarPedido,
//    com o valor conferido, chega nesse estado). Página de obrigado NUNCA conta como compra.
//  • compra ligada à sessão = o checkout grava o id da sessão em orders.origem.sid (pedidos novos).
//    Pedido sem sid (antigos ou criados fora do checkout) entra nos totais, mas não no funil.
// ============================================================

export type SessaoBI = {
  id: string; visitor_id: string; started_at: string; landing_path: string | null; referrer: string | null;
  utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; utm_content?: string | null;
};
export type PageviewBI = { session_id: string; path: string; created_at: string };
export type EventoBI = { session_id: string; nome: string; props: any; path: string | null; created_at: string };
export type PedidoBI = {
  id: string; status: string; total: number; created_at: string; product_id: string | null; store_id: string | null; origem: any;
};
export type ProdutoBI = { id: string; titulo: string; store_id: string | null; categoria: string | null; status?: string | null };
export type LojaBI = { id: string; nome: string; slug?: string | null };

export const STATUS_APROVADO = ['pago', 'entregue'];
export const aprovado = (status: string) => STATUS_APROVADO.includes(status);

// ---------- Origem do tráfego ----------
export const FONTES = ['Meta Ads', 'Instagram', 'Facebook', 'WhatsApp', 'Google Ads', 'Google', 'TikTok', 'E-mail', 'Indicação', 'Link de vendedor', 'Direto', 'Outras'] as const;
export type Fonte = (typeof FONTES)[number];
export const NOTA_FONTE: Partial<Record<Fonte, string>> = {
  Instagram: 'Veio do Instagram sem UTM de anúncio: orgânico ou anúncio sem UTM.',
  Facebook: 'Veio do Facebook sem UTM de anúncio: orgânico ou anúncio sem UTM.',
  Direto: 'Sem UTM e sem site de origem (digitou o endereço, favorito, app que esconde a origem).',
  Outras: 'Origem identificada, mas fora das categorias acima.',
};

const hostDeRef = (r: string | null | undefined) => {
  if (!r) return '';
  try { return new URL(r.includes('://') ? r : `https://${r}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return String(r).toLowerCase(); }
};
const PAGO = /(^|[^a-z])(cpc|ppc|paid|pago|ads?|anuncio|anuncios|paid_social|trafego)([^a-z]|$)/;

/** Classifica a origem com o que foi realmente gravado (UTM + domínio de origem). Sem evidência = Direto/Outras. */
export function fonteDe(o: { utm_source?: string | null; utm_medium?: string | null; src?: string | null; ref?: string | null; referrer?: string | null } | null | undefined): Fonte {
  if (!o) return 'Direto';
  const s = String(o.utm_source || o.src || '').toLowerCase().trim();
  const m = String(o.utm_medium || '').toLowerCase().trim();
  const h = hostDeRef(o.ref || o.referrer);
  if (s === 'indicacao') return 'Indicação';
  if (s === 'vendedor') return 'Link de vendedor';
  const pago = PAGO.test(m) || /^(meta|metaads|meta_ads|fb_ads|facebook_ads|ig_ads|instagram_ads|googleads|google_ads|tiktok_ads)$/.test(s);
  if (pago) {
    if (/meta|fb|facebook|instagram|ig/.test(s) || (!s && /facebook|instagram/.test(h))) return 'Meta Ads';
    if (/google|gads|adwords/.test(s) || (!s && /google/.test(h))) return 'Google Ads';
    if (/tiktok/.test(s)) return 'TikTok';
    return 'Outras';
  }
  const tudo = `${s} ${m}`;
  if (/whats|wpp|zap/.test(tudo) || /whatsapp|wa\.me/.test(h)) return 'WhatsApp';
  if (/instagram|^ig$/.test(s) || /instagram/.test(h)) return 'Instagram';
  if (/facebook|^fb$/.test(s) || /(^|\.)facebook\.com$|fb\.com$|fb\.me$/.test(h)) return 'Facebook';
  if (/google/.test(s) || /(^|\.)google\./.test(h)) return 'Google';
  if (/tiktok/.test(s) || /tiktok/.test(h)) return 'TikTok';
  if (/email|e-mail|newsletter/.test(tudo) || /mail\.|outlook|gmail/.test(h)) return 'E-mail';
  if (!s && !h) return 'Direto';
  return 'Outras';
}

// ---------- Recortes ----------
const PROD = /^\/produto\/([0-9a-f-]{36})/i;
const CHECK = /^\/checkout\/([0-9a-f-]{36})/i;
export const produtoDoCaminho = (p: string | null | undefined) => ((PROD.exec(String(p || '')) || [])[1] || '').toLowerCase() || null;
export const produtoDoCheckout = (p: string | null | undefined) => ((CHECK.exec(String(p || '')) || [])[1] || '').toLowerCase() || null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const sidDoPedido = (o: PedidoBI) => (o.origem && typeof o.origem.sid === 'string' && UUID.test(o.origem.sid) ? o.origem.sid : null);

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const r2 = (n: number) => Math.round(n * 100) / 100;
const FUSO = 3 * 3600000;
const diaBR = (iso: string) => new Date(Date.parse(iso) - FUSO).toISOString().slice(0, 10);

export type EntradaBI = {
  de: number; ate: number;
  sessoes: SessaoBI[]; pageviews: PageviewBI[]; eventos: EventoBI[] | null; pedidos: PedidoBI[];
  produtos: ProdutoBI[]; lojas: LojaBI[];
  cortes?: string[];
};

/** Relatório completo do período. */
export function calcularInteligencia(e: EntradaBI) {
  const noPeriodo = (iso: string) => { const t = Date.parse(iso); return t >= e.de && t < e.ate; };
  const sessoes = e.sessoes.filter((s) => noPeriodo(s.started_at));
  const ids = new Set(sessoes.map((s) => s.id));
  const pv = e.pageviews.filter((p) => noPeriodo(p.created_at));
  const ev = e.eventos ? e.eventos.filter((x) => noPeriodo(x.created_at)) : null;
  const pedidos = e.pedidos.filter((o) => noPeriodo(o.created_at));
  const aprov = pedidos.filter((o) => aprovado(o.status));
  const receita = r2(aprov.reduce((s, o) => s + (Number(o.total) || 0), 0));
  const visitorDe = new Map(e.sessoes.map((s) => [s.id, s.visitor_id]));
  const prodMap = new Map(e.produtos.map((p) => [p.id, p]));
  const lojaMap = new Map(e.lojas.map((l) => [l.id, l]));

  // conjuntos de sessões por etapa (só sessões iniciadas no período)
  const comProduto = new Set<string>(); const comCheckout = new Set<string>();
  const viewsProd = new Map<string, number>(); const uniqProd = new Map<string, Set<string>>(); const checkProd = new Map<string, Set<string>>();
  for (const p of pv) {
    const prod = produtoDoCaminho(p.path); const chk = produtoDoCheckout(p.path);
    if (prod) {
      if (ids.has(p.session_id)) comProduto.add(p.session_id);
      viewsProd.set(prod, (viewsProd.get(prod) || 0) + 1);
      const v = visitorDe.get(p.session_id) || p.session_id;
      if (!uniqProd.has(prod)) uniqProd.set(prod, new Set()); uniqProd.get(prod)!.add(v);
    }
    if (chk) {
      if (ids.has(p.session_id)) comCheckout.add(p.session_id);
      if (!checkProd.has(chk)) checkProd.set(chk, new Set()); checkProd.get(chk)!.add(p.session_id);
    }
  }
  const comClique = new Set<string>(); const cliqueProd = new Map<string, Set<string>>();
  if (ev) for (const x of ev) if (x.nome === 'compra_clique') {
    if (ids.has(x.session_id)) comClique.add(x.session_id);
    const prod = produtoDoCaminho(x.path);
    if (prod) { if (!cliqueProd.has(prod)) cliqueProd.set(prod, new Set()); cliqueProd.get(prod)!.add(x.session_id); }
  }
  const comCompra = new Set<string>();
  let semSessao = 0;
  for (const o of aprov) { const sid = sidDoPedido(o); if (sid && ids.has(sid)) comCompra.add(sid); else semSessao++; }

  const visitantes = new Set(sessoes.map((s) => s.visitor_id)).size;
  const geral = {
    visitantes, sessoes: sessoes.length, pageviews: pv.length,
    viewsProduto: pv.filter((p) => produtoDoCaminho(p.path)).length,
    cliquesComprar: ev ? ev.filter((x) => x.nome === 'compra_clique').length : null,
    checkouts: comCheckout.size,
    pedidosCriados: pedidos.length, comprasAprovadas: aprov.length, receita,
    ticketMedio: aprov.length ? r2(receita / aprov.length) : null,
    conversao: pct(comCompra.size, sessoes.length), // sessões com compra / sessões
    reembolsados: pedidos.filter((o) => o.status === 'reembolsado').length,
  };

  const etapas = [
    { etapa: 'Visitou o site', valor: sessoes.length },
    { etapa: 'Viu um produto', valor: comProduto.size },
    { etapa: 'Clicou em comprar', valor: ev ? comClique.size : null },
    { etapa: 'Abriu o checkout', valor: comCheckout.size },
    { etapa: 'Compra aprovada', valor: comCompra.size },
  ];
  const funil = etapas.map((x, i) => {
    const ant = i === 0 ? null : [...etapas.slice(0, i)].reverse().find((y) => y.valor !== null)?.valor ?? null;
    return { ...x, deAnterior: x.valor !== null && ant !== null ? pct(x.valor, ant) : null, doTopo: x.valor !== null ? pct(x.valor, sessoes.length) : null };
  });

  // origem: sessões, visitantes e compras ligadas por fonte; compras sem sessão usam a UTM gravada no pedido
  const porFonte = new Map<Fonte, { sessoes: number; visitantes: Set<string>; compras: number; receita: number }>();
  const lin = (f: Fonte) => { if (!porFonte.has(f)) porFonte.set(f, { sessoes: 0, visitantes: new Set(), compras: 0, receita: 0 }); return porFonte.get(f)!; };
  const fonteSessao = new Map<string, Fonte>();
  for (const s of sessoes) { const f = fonteDe(s); fonteSessao.set(s.id, f); const l = lin(f); l.sessoes++; l.visitantes.add(s.visitor_id); }
  for (const o of aprov) {
    const sid = sidDoPedido(o);
    const f = (sid && fonteSessao.get(sid)) || fonteDe(o.origem);
    const l = lin(f); l.compras++; l.receita += Number(o.total) || 0;
  }
  const origens = FONTES.filter((f) => porFonte.has(f)).map((f) => {
    const l = porFonte.get(f)!;
    return { fonte: f, sessoes: l.sessoes, visitantes: l.visitantes.size, compras: l.compras, receita: r2(l.receita), conversao: pct(l.compras, l.sessoes), nota: NOTA_FONTE[f] || null };
  }).sort((a, b) => b.sessoes - a.sessoes || b.compras - a.compras);

  // produtos
  const vendasProd = new Map<string, { n: number; v: number }>();
  for (const o of aprov) if (o.product_id) { const a = vendasProd.get(o.product_id) || { n: 0, v: 0 }; a.n++; a.v += Number(o.total) || 0; vendasProd.set(o.product_id, a); }
  const idsProd = new Set<string>([...Array.from(viewsProd.keys()), ...Array.from(vendasProd.keys()), ...Array.from(checkProd.keys())]);
  const produtos = Array.from(idsProd).map((id) => {
    const p = prodMap.get(id); const vend = vendasProd.get(id) || { n: 0, v: 0 }; const uniq = uniqProd.get(id)?.size || 0;
    return {
      id, titulo: p?.titulo || 'Produto removido', categoria: p?.categoria || null, loja: (p?.store_id && lojaMap.get(p.store_id)?.nome) || '—', storeId: p?.store_id || null,
      views: viewsProd.get(id) || 0, visitantes: uniq, cliques: ev ? cliqueProd.get(id)?.size || 0 : null,
      checkouts: checkProd.get(id)?.size || 0, compras: vend.n, receita: r2(vend.v), conversao: pct(vend.n, uniq),
    };
  }).sort((a, b) => b.views - a.views || b.compras - a.compras);

  // vendedores
  const porLoja = new Map<string, any>();
  const L = (sid: string) => { if (!porLoja.has(sid)) porLoja.set(sid, { storeId: sid, loja: lojaMap.get(sid)?.nome || 'Loja', produtos: 0, views: 0, cliques: ev ? 0 : null, compras: 0, receita: 0, visitasLinks: 0 }); return porLoja.get(sid); };
  for (const p of e.produtos) if (p.store_id && (p.status ?? 'ativo') === 'ativo') L(p.store_id).produtos++;
  for (const x of produtos) if (x.storeId) { const l = L(x.storeId); l.views += x.views; if (l.cliques !== null && x.cliques !== null) l.cliques += x.cliques; l.compras += x.compras; l.receita = r2(l.receita + x.receita); }
  const lojaPorSlug = new Map(e.lojas.filter((l) => l.slug).map((l) => [String(l.slug).toLowerCase(), l.id]));
  for (const s of sessoes) if ((s.utm_source || '').toLowerCase() === 'vendedor') { const id = lojaPorSlug.get(String(s.utm_content || '').toLowerCase()); if (id) L(id).visitasLinks++; }
  const vendedores = Array.from(porLoja.values()).filter((l) => l.views || l.compras || l.visitasLinks)
    .map((l) => ({ ...l, conversao: pct(l.compras, l.views) })).sort((a, b) => b.receita - a.receita || b.views - a.views);

  // série diária (para a evolução)
  const dias = new Map<string, { dia: string; sessoes: number; compras: number; receita: number }>();
  for (let t = e.de; t < e.ate && dias.size < 400; t += 86400000) { const d = new Date(t - FUSO).toISOString().slice(0, 10); dias.set(d, { dia: d, sessoes: 0, compras: 0, receita: 0 }); }
  for (const s of sessoes) { const d = dias.get(diaBR(s.started_at)); if (d) d.sessoes++; }
  for (const o of aprov) { const d = dias.get(diaBR(o.created_at)); if (d) { d.compras++; d.receita = r2(d.receita + (Number(o.total) || 0)); } }

  return {
    geral, funil, origens, produtos: produtos.slice(0, 100), vendedores: vendedores.slice(0, 100), serie: Array.from(dias.values()),
    comprasSemSessao: semSessao, eventosLigados: ev !== null, cortes: e.cortes || [],
  };
}

// ---------- Divulgação do vendedor ----------
export const CANAIS_DIVULGACAO = ['whatsapp', 'instagram', 'facebook', 'stories', 'outro'] as const;
export type CanalDivulgacao = (typeof CANAIS_DIVULGACAO)[number];

/** Link rastreável: só UTM (o site já entende e grava na sessão e no pedido). */
export function linkDivulgacao(site: string, produtoId: string, lojaSlug: string, canal: CanalDivulgacao): string {
  const q = new URLSearchParams({ utm_source: 'vendedor', utm_medium: canal, utm_campaign: 'divulgacao', utm_content: String(lojaSlug || '').toLowerCase().slice(0, 60) });
  return `${site.replace(/\/+$/, '')}/produto/${produtoId}?${q.toString()}`;
}

const moeda = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

/** Textos de divulgação com dados REAIS do anúncio (sem inventar avaliação, venda ou desconto). */
export function textosDivulgacao(p: { titulo: string; preco: number; precoPromo?: number | null; loja: string; nota?: number | null; avaliacoes?: number | null }, links: Record<CanalDivulgacao, string>) {
  const temPromo = p.precoPromo != null && Number(p.precoPromo) > 0 && Number(p.precoPromo) < Number(p.preco);
  const preco = temPromo ? `de ${moeda(p.preco)} por ${moeda(Number(p.precoPromo))}` : moeda(p.preco);
  const avaliacao = p.nota && p.avaliacoes && p.avaliacoes >= 3 ? ` Nota ${String(Math.round(p.nota * 10) / 10).replace('.', ',')} de 5 em ${p.avaliacoes} avaliações.` : '';
  const t = p.titulo.trim();
  return {
    whatsapp: `*${t}*\n${preco}\n\nCompra pelo Comprei Barato: pagamento por Pix e o seu dinheiro fica protegido até a entrega.${avaliacao}\n\n👉 ${links.whatsapp}`,
    instagram: `${t} ✨\n\n${preco}, vendido pela ${p.loja} no Comprei Barato.${avaliacao}\nPix na hora e dinheiro protegido até a entrega.\n\nLink: ${links.instagram}\n(ou toque no link da bio)`,
    facebook: `Olha o que eu tenho no Comprei Barato: ${t}.\n\n${preco}. O pagamento é por Pix e o valor fica protegido pela plataforma até você receber.${avaliacao}\n\nVeja os detalhes: ${links.facebook}`,
    stories: `${t.length > 60 ? t.slice(0, 57).trimEnd() + '…' : t}\n${temPromo ? `Por ${moeda(Number(p.precoPromo))}` : moeda(p.preco)} 👆 toque no link`,
  };
}

/** Métricas dos links de um vendedor (sessões com utm_source=vendedor e utm_content=slug da loja). */
export function metricasDivulgacao(slug: string, sessoes: SessaoBI[], pedidos: PedidoBI[], idsProdutosDaLoja: Set<string>) {
  const s = String(slug || '').toLowerCase();
  const minhas = sessoes.filter((x) => (x.utm_source || '').toLowerCase() === 'vendedor' && (x.utm_content || '').toLowerCase() === s);
  const sids = new Set(minhas.map((x) => x.id));
  const porCanal = new Map<string, { canal: string; cliques: number; visitantes: Set<string>; compras: number }>();
  const porProduto = new Map<string, number>();
  for (const x of minhas) {
    const c = (x.utm_medium || 'outro').toLowerCase();
    if (!porCanal.has(c)) porCanal.set(c, { canal: c, cliques: 0, visitantes: new Set(), compras: 0 });
    const a = porCanal.get(c)!; a.cliques++; a.visitantes.add(x.visitor_id);
    const prod = produtoDoCaminho(x.landing_path); if (prod) porProduto.set(prod, (porProduto.get(prod) || 0) + 1);
  }
  // compra atribuída = pedido pago de um produto DESTA loja cuja sessão (ou origem gravada) veio do link desta loja
  let compras = 0; let receita = 0;
  for (const o of pedidos) {
    if (!aprovado(o.status) || !o.product_id || !idsProdutosDaLoja.has(o.product_id)) continue;
    const sid = sidDoPedido(o);
    const veio = (sid && sids.has(sid)) || (String(o.origem?.utm_source || '').toLowerCase() === 'vendedor' && String(o.origem?.utm_content || '').toLowerCase() === s);
    if (!veio) continue;
    compras++; receita += Number(o.total) || 0;
    const ses = sid ? minhas.find((x) => x.id === sid) : null;
    const c = String(ses?.utm_medium || o.origem?.utm_medium || 'outro').toLowerCase();
    if (porCanal.has(c)) porCanal.get(c)!.compras++;
  }
  const visitantes = new Set(minhas.map((x) => x.visitor_id)).size;
  return {
    cliques: minhas.length, visitantes, compras, receita: r2(receita), conversao: pct(compras, visitantes),
    canais: Array.from(porCanal.values()).map((c) => ({ canal: c.canal, cliques: c.cliques, visitantes: c.visitantes.size, compras: c.compras })).sort((a, b) => b.cliques - a.cliques),
    produtos: Array.from(porProduto.entries()).map(([id, n]) => ({ id, cliques: n })).sort((a, b) => b.cliques - a.cliques),
  };
}
