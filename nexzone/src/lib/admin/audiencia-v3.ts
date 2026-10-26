// Audiência V3 e Crescimento (Admin). Cálculos puros sobre linhas já carregadas: testáveis sem banco.
// Regras: visitante único = navegador anônimo (não é pessoa identificada); ninguém "saiu do site" só porque
// parou de mandar sinais; "compra confirmada" fica indisponível enquanto a K2 estiver aberta.
import { areaDe, canalDe, hostDe, produtoIdDe, type AreaPagina } from '../eventos';
import { agruparMinimo, MINIMO_GRUPO, type LinhaUsuario } from './usuarios';
import { chaveDia, diasEntre, variacao } from './tempo';

export type Sessao = {
  id: string; visitor_id: string; started_at: string; last_seen: string; device: string | null;
  landing_path: string | null; current_path?: string | null; region: string | null; city: string | null; country: string | null;
  referrer: string | null; user_id: string | null; pageviews?: number | null;
  utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; utm_content?: string | null; canal?: string | null;
};
export type Pageview = { session_id: string; path: string; created_at: string };
export type Evento = { session_id: string; nome: string; props: any; device: string | null; created_at: string };

export type Dados = {
  de: Date; ate: Date; anteriorDe: Date;
  sessoes: Sessao[]; pageviews: Pageview[]; eventos: Evento[] | null; cliquesExternos: { created_at: string }[] | null;
  usuarios: LinhaUsuario[];
  categoriaDoProduto: Record<string, string>;
  temUtm: boolean;
  cortes: { sessoes: boolean; pageviews: boolean; eventos: boolean };
};

/** Chave para achar a categoria de uma página de produto (/produto/<id>) ou oferta externa (/oferta/<slug>). */
export function chaveCategoria(path: string | null | undefined): string | null {
  const p = (path || '').split('?')[0];
  const id = produtoIdDe(p);
  if (id) return id;
  const m = /^\/oferta\/([a-z0-9-]{1,90})$/i.exec(p);
  return m ? 'o:' + m[1].toLowerCase() : null;
}

const dentro = (iso: string, a: Date, b: Date) => { const t = new Date(iso).getTime(); return t >= a.getTime() && t < b.getTime(); };

function canalSessao(s: Sessao): string {
  if (s.canal) return s.canal;
  return canalDe({ utm_source: s.utm_source || undefined, utm_medium: s.utm_medium || undefined }, hostDe(s.referrer));
}

type Recorte = ReturnType<typeof recortar>;

function recortar(d: Dados, a: Date, b: Date) {
  const sessoes = d.sessoes.filter((s) => dentro(s.started_at, a, b));
  const ids = new Set(sessoes.map((s) => s.id));
  const pv = d.pageviews.filter((p) => dentro(p.created_at, a, b));
  const ev = d.eventos ? d.eventos.filter((e) => dentro(e.created_at, a, b)) : null;
  const areasPorSessao = new Map<string, Set<AreaPagina>>();
  pv.forEach((p) => {
    const set = areasPorSessao.get(p.session_id) || new Set<AreaPagina>();
    set.add(areaDe(p.path)); areasPorSessao.set(p.session_id, set);
  });
  sessoes.forEach((s) => { // a página de entrada também conta (sessões antigas sem pageview carregado)
    const set = areasPorSessao.get(s.id) || new Set<AreaPagina>();
    set.add(areaDe(s.landing_path)); areasPorSessao.set(s.id, set);
  });
  const comArea = (...areas: AreaPagina[]) => sessoes.filter((s) => { const set = areasPorSessao.get(s.id); return !!set && areas.some((x) => set.has(x)); }).length;
  const sessoesComEvento = (nome: string, filtro?: (e: Evento) => boolean) => ev ? new Set(ev.filter((e) => e.nome === nome && (!filtro || filtro(e))).map((e) => e.session_id)).size : null;
  const contaEvento = (nome: string, filtro?: (e: Evento) => boolean) => ev ? ev.filter((e) => e.nome === nome && (!filtro || filtro(e))).length : null;
  const novosUsuarios = d.usuarios.filter((u) => u.criadoEm && dentro(u.criadoEm, a, b));
  const pvPorSessao = new Map<string, number>();
  pv.forEach((p) => pvPorSessao.set(p.session_id, (pvPorSessao.get(p.session_id) || 0) + 1));
  const umaPagina = sessoes.filter((s) => Math.max(pvPorSessao.get(s.id) || 0, Number(s.pageviews || 0)) <= 1).length;
  return { sessoes, ids, pv, ev, areasPorSessao, comArea, sessoesComEvento, contaEvento, novosUsuarios, umaPagina };
}

function indicadores(d: Dados, r: Recorte, agora: Date) {
  const visitantes = new Set(r.sessoes.map((s) => s.visitor_id)).size;
  const externos = d.cliquesExternos ? d.cliquesExternos.filter((c) => dentro(c.created_at, d.de, d.ate)).length : null;
  return {
    ativos5min: d.sessoes.filter((s) => new Date(s.last_seen).getTime() > agora.getTime() - 5 * 60e3).length,
    sessoes: r.sessoes.length,
    visitantesUnicos: visitantes,
    pageviews: r.pv.length,
    produtosVisualizados: r.pv.filter((p) => { const ar = areaDe(p.path); return ar === 'produto' || ar === 'oferta'; }).length,
    cliquesProdutos: r.contaEvento('produto_clique'),
    buscas: r.contaEvento('busca'),
    visitasCadastro: r.comArea('cadastro'),
    cadastrosIniciados: r.sessoesComEvento('cadastro_iniciado'),
    cadastrosConcluidos: r.novosUsuarios.length,
    acessosVendedor: r.comArea('vendedor'),
    acessosComprador: r.comArea('comprador'),
    acessosCheckout: r.comArea('checkout'),
    cliquesCheckoutExterno: externos,
    taxaCadastro: visitantes ? Math.round((r.novosUsuarios.length / visitantes) * 1000) / 10 : null,
    sessoesUmaPagina: r.sessoes.length ? Math.round((r.umaPagina / r.sessoes.length) * 1000) / 10 : null,
  };
}

function funil(r: Recorte) {
  const interesse = r.ev ? new Set(r.ev.filter((e) => e.nome === 'produto_clique' || e.nome === 'compra_clique').map((e) => e.session_id)).size : null;
  return [
    { etapa: 'Visitou a plataforma', valor: r.sessoes.length, nota: 'sessões' },
    { etapa: 'Visualizou produtos', valor: r.comArea('produto', 'oferta'), nota: 'sessões' },
    { etapa: 'Demonstrou interesse', valor: interesse, nota: interesse === null ? 'Depende dos eventos de funil (desligados ou SQL V3 04 não aplicado).' : 'sessões com clique em produto ou em Comprar' },
    { etapa: 'Iniciou cadastro', valor: r.sessoesComEvento('cadastro_iniciado'), nota: r.ev ? 'sessões' : 'Depende dos eventos de funil (desligados ou SQL V3 04 não aplicado).' },
    { etapa: 'Concluiu cadastro', valor: r.novosUsuarios.length, nota: 'contas criadas (não sessões)' },
    { etapa: 'Visitou checkout', valor: r.comArea('checkout'), nota: 'sessões' },
    { etapa: 'Compra confirmada', valor: null as number | null, nota: 'Indisponível: o status do pedido ainda não comprova pagamento (K2). Sem fonte confiável do gateway, não contamos compras.' },
  ];
}

function abandonoCadastro(r: Recorte, agora: Date) {
  if (!r.ev) return null;
  const evs = r.ev.filter((e) => e.nome.startsWith('cadastro_'));
  const por = (nome: string, etapa?: string) => new Set(evs.filter((e) => e.nome === nome && (!etapa || e.props?.etapa === etapa)).map((e) => e.session_id)).size;
  const etapas = [
    { etapa: 'Abriu o cadastro', valor: por('cadastro_aberto') },
    { etapa: 'Começou a preencher', valor: por('cadastro_iniciado') },
    { etapa: 'Chegou à senha', valor: por('cadastro_etapa', 'senha') },
    { etapa: 'Enviou o formulário', valor: por('cadastro_etapa', 'enviado') },
    { etapa: 'Concluiu', valor: por('cadastro_concluido') },
  ];
  const grupo = (campo: 'device' | 'tipo') => {
    const m = new Map<string, { iniciados: Set<string>; concluidos: Set<string> }>();
    evs.forEach((e) => {
      const k = campo === 'device' ? (e.device || 'desconhecido') : (e.props?.tipo || 'comprador');
      const g = m.get(k) || { iniciados: new Set<string>(), concluidos: new Set<string>() };
      if (e.nome === 'cadastro_iniciado') g.iniciados.add(e.session_id);
      if (e.nome === 'cadastro_concluido') g.concluidos.add(e.session_id);
      m.set(k, g);
    });
    return Array.from(m.entries()).map(([chave, g]) => ({
      chave, iniciados: g.iniciados.size, concluidos: g.concluidos.size,
      conclusao: g.iniciados.size ? Math.round((g.concluidos.size / g.iniciados.size) * 1000) / 10 : null,
    }));
  };
  const erros = new Map<string, number>();
  evs.filter((e) => e.nome === 'cadastro_erro').forEach((e) => erros.set(e.props?.codigo || 'outro', (erros.get(e.props?.codigo || 'outro') || 0) + 1));
  // Interrompido: iniciou há mais de 30 min e não concluiu na mesma sessão
  const limite = agora.getTime() - 30 * 60e3;
  const inicio = new Map<string, number>();
  evs.filter((e) => e.nome === 'cadastro_iniciado').forEach((e) => { const t = new Date(e.created_at).getTime(); if (!inicio.has(e.session_id) || t < inicio.get(e.session_id)!) inicio.set(e.session_id, t); });
  const concluiu = new Set(evs.filter((e) => e.nome === 'cadastro_concluido').map((e) => e.session_id));
  let interrompidos = 0;
  inicio.forEach((t, sid) => { if (t < limite && !concluiu.has(sid)) interrompidos++; });
  let pior: { etapa: string; perda: number } | null = null;
  for (let i = 1; i < etapas.length; i++) {
    const perda = etapas[i - 1].valor - etapas[i].valor;
    if (etapas[i - 1].valor > 0 && (!pior || perda > pior.perda)) pior = { etapa: `${etapas[i - 1].etapa} → ${etapas[i].etapa}`, perda };
  }
  return {
    etapas, porDispositivo: grupo('device'), porTipo: grupo('tipo'),
    erros: Array.from(erros.entries()).map(([chave, valor]) => ({ chave, valor })).sort((a, b) => b.valor - a.valor),
    interrompidos, maiorPerda: pior,
  };
}

function trafego(d: Dados, r: Recorte) {
  const conta = (f: (s: Sessao) => string | null | undefined, n = 12) => {
    const m = new Map<string, number>();
    r.sessoes.forEach((s) => { const k = f(s); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).map(([chave, valor]) => ({ chave, valor })).sort((a, b) => b.valor - a.valor).slice(0, n);
  };
  const ufs = new Map<string, number>(); const cids = new Map<string, number>();
  r.sessoes.forEach((s) => {
    if (s.country === 'BR' && s.region) ufs.set(s.region, (ufs.get(s.region) || 0) + 1);
    if (s.city) cids.set(`${s.city}${s.region ? ' · ' + s.region : ''}`, (cids.get(`${s.city}${s.region ? ' · ' + s.region : ''}`) || 0) + 1);
  });
  // Campanhas: visitantes → cadastros → vendedores ativados (atribuição aproximada, primeiro toque)
  const camp = new Map<string, { visitantes: Set<string>; cadastros: number; vendedoresAtivos: number }>();
  r.sessoes.forEach((s) => { if (!s.utm_campaign) return; const c = camp.get(s.utm_campaign) || { visitantes: new Set<string>(), cadastros: 0, vendedoresAtivos: 0 }; c.visitantes.add(s.visitor_id); camp.set(s.utm_campaign, c); });
  r.novosUsuarios.forEach((u) => {
    if (!u.origemCampanha) return;
    const c = camp.get(u.origemCampanha) || { visitantes: new Set<string>(), cadastros: 0, vendedoresAtivos: 0 };
    c.cadastros++; if (u.tipo === 'vendedor' && u.produtosPublicados > 0) c.vendedoresAtivos++;
    camp.set(u.origemCampanha, c);
  });
  return {
    canais: conta((s) => canalSessao(s)),
    fontes: conta((s) => s.utm_source || hostDe(s.referrer) || 'Direto'),
    meios: conta((s) => s.utm_medium),
    campanhas: Array.from(camp.entries()).map(([chave, c]) => ({ chave, visitantes: c.visitantes.size, cadastros: c.cadastros, vendedoresAtivos: c.vendedoresAtivos }))
      .sort((a, b) => b.visitantes + b.cadastros - (a.visitantes + a.cadastros)).slice(0, 15),
    conteudos: conta((s) => s.utm_content),
    entradas: conta((s) => (s.landing_path || '/').slice(0, 80)),
    dispositivos: conta((s) => s.device || 'desconhecido', 3),
    estados: agruparMinimo(Array.from(ufs.entries()), MINIMO_GRUPO),
    cidades: agruparMinimo(Array.from(cids.entries()), MINIMO_GRUPO, 12),
    temUtm: d.temUtm,
  };
}

function categoriasVisitadas(d: Dados, pv: Pageview[]) {
  const m = new Map<string, number>();
  pv.forEach((p) => { const k = chaveCategoria(p.path); const c = k ? d.categoriaDoProduto[k] : null; if (c) m.set(c, (m.get(c) || 0) + 1); });
  return Array.from(m.entries()).map(([chave, valor]) => ({ chave, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
}

export function serieDiaria(d: Dados, r: Recorte) {
  const dias = diasEntre(d.de, d.ate, 120);
  const idx = new Map(dias.map((k, i) => [k, i]));
  const out = dias.map((k) => ({ dia: k, visitantes: 0, sessoes: 0, cadastros: 0 }));
  const vis = dias.map(() => new Set<string>());
  r.sessoes.forEach((s) => { const i = idx.get(chaveDia(new Date(s.started_at))); if (i === undefined) return; out[i].sessoes++; vis[i].add(s.visitor_id); });
  vis.forEach((set, i) => { out[i].visitantes = set.size; });
  r.novosUsuarios.forEach((u) => { const i = idx.get(chaveDia(new Date(u.criadoEm!))); if (i !== undefined) out[i].cadastros++; });
  return out;
}

export function calcularAudiencia(d: Dados, agora = new Date()) {
  const r = recortar(d, d.de, d.ate);
  const ant = recortar(d, d.anteriorDe, d.de);
  const ind = indicadores(d, r, agora);
  const indAnt = indicadores(d, ant, agora);
  const f = funil(r); const fAnt = funil(ant);
  return {
    indicadores: ind,
    comparacao: Object.fromEntries(Object.entries(ind).map(([k, v]) => [k, typeof v === 'number' && typeof (indAnt as any)[k] === 'number' ? variacao(v, (indAnt as any)[k]) : null])),
    funil: f.map((e, i) => ({ ...e, anterior: fAnt[i].valor })),
    abandono: abandonoCadastro(r, agora),
    trafego: trafego(d, r),
    categorias: categoriasVisitadas(d, r.pv),
    serie: serieDiaria(d, r),
    eventosDisponiveis: d.eventos !== null,
    cortes: d.cortes,
  };
}

/** Painel ao vivo: só contagens agregadas das sessões com sinal nos últimos 5 minutos. */
export function calcularAoVivo(sessoes: Sessao[], categoriaDoProduto: Record<string, string>, agora = new Date()) {
  const ativos = sessoes.filter((s) => new Date(s.last_seen).getTime() > agora.getTime() - 5 * 60e3);
  const por = (...areas: AreaPagina[]) => ativos.filter((s) => areas.includes(areaDe(s.current_path || s.landing_path))).length;
  const cats = new Map<string, number>();
  ativos.forEach((s) => { const k = chaveCategoria(s.current_path || s.landing_path); const c = k ? categoriaDoProduto[k] : null; if (c) cats.set(c, (cats.get(c) || 0) + 1); });
  return {
    ativos: ativos.length,
    emProdutos: por('produto', 'oferta'),
    emCadastro: por('cadastro'),
    emCheckout: por('checkout'),
    naAreaVendedor: por('vendedor'),
    naAreaComprador: por('comprador'),
    navegando: por('home', 'busca', 'categoria', 'outra'),
    categorias: Array.from(cats.entries()).map(([chave, valor]) => ({ chave, valor })).sort((a, b) => b.valor - a.valor).slice(0, 8),
    dispositivos: ['mobile', 'desktop', 'tablet'].map((k) => ({ chave: k, valor: ativos.filter((s) => (s.device || 'desktop') === k).length })),
    janelaMin: 5,
  };
}

// ---------- Crescimento (Parte D) ----------

const AMOSTRA_MINIMA = 30; // visitas/cadastros mínimos para gerar um insight

export function calcularCrescimento(d: Dados, publicacoes: { store_id: string; quando: string; aproximado: boolean }[], agora = new Date()) {
  const r = recortar(d, d.de, d.ate);
  const ant = recortar(d, d.anteriorDe, d.de);
  const bloco = (x: Recorte, a: Date, b: Date) => {
    const novos = x.novosUsuarios;
    const novosVendedores = d.usuarios.filter((u) => u.loja && dentro(u.loja.criadaEm, a, b));
    const pubs = publicacoes.filter((p) => dentro(p.quando, a, b));
    const lojasQuePublicaram = new Set(pubs.map((p) => p.store_id)).size;
    const visitantes = new Set(x.sessoes.map((s) => s.visitor_id)).size;
    const cliquesCompra = x.ev ? x.ev.filter((e) => e.nome === 'compra_clique').length : null;
    const cliquesExternos = d.cliquesExternos ? d.cliquesExternos.filter((c) => dentro(c.created_at, a, b)).length : null;
    return {
      visitantes,
      novosCadastros: novos.length,
      novosCompradores: novos.filter((u) => u.tipo === 'comprador').length,
      novosVendedores: novosVendedores.length,
      vendedoresQuePublicaram: lojasQuePublicaram,
      produtosPublicados: pubs.length,
      produtosVisualizados: x.pv.filter((p) => { const ar = areaDe(p.path); return ar === 'produto' || ar === 'oferta'; }).length,
      cliquesCompra,
      cliquesExternos,
      conversaoVisitanteCadastro: visitantes ? Math.round((novos.length / visitantes) * 1000) / 10 : null,
    };
  };
  const atual = bloco(r, d.de, d.ate);
  const anterior = bloco(ant, d.anteriorDe, d.de);
  const vendedores = d.usuarios.filter((u) => u.tipo === 'vendedor');
  const ativos = vendedores.filter((u) => u.produtosPublicados > 0).length;
  const conversaoVendedor = vendedores.length ? Math.round((ativos / vendedores.length) * 1000) / 10 : null;
  const trf = trafego(d, r);
  const ufs = new Map<string, number>(); const cids = new Map<string, number>();
  r.novosUsuarios.forEach((u) => { if (u.uf) ufs.set(u.uf, (ufs.get(u.uf) || 0) + 1); if (u.cidade) cids.set(`${u.cidade}${u.uf ? ' · ' + u.uf : ''}`, (cids.get(`${u.cidade}${u.uf ? ' · ' + u.uf : ''}`) || 0) + 1); });
  const cats = categoriasVisitadas(d, r.pv);

  // Insights: só com amostra suficiente
  const insights: { tipo: 'pos' | 'at' | 'info'; texto: string; base: string }[] = [];
  if (atual.novosCadastros + anterior.novosCadastros >= AMOSTRA_MINIMA && anterior.novosCadastros > 0) {
    const v = variacao(atual.novosCadastros, anterior.novosCadastros)!;
    if (Math.abs(v) >= 10) insights.push({ tipo: v > 0 ? 'pos' : 'at', texto: `Os cadastros ${v > 0 ? 'aumentaram' : 'caíram'} ${Math.abs(v).toLocaleString('pt-BR')}% em relação ao período anterior.`, base: `${atual.novosCadastros} agora vs. ${anterior.novosCadastros} antes` });
  }
  if (vendedores.length >= 10 && vendedores.length - ativos > vendedores.length / 2) {
    insights.push({ tipo: 'at', texto: 'A maioria dos vendedores cadastrados ainda não publicou um produto.', base: `${vendedores.length - ativos} de ${vendedores.length} vendedores sem produto publicado` });
  }
  const visitasCad = r.comArea('cadastro');
  if (visitasCad >= AMOSTRA_MINIMA) {
    const taxa = atual.novosCadastros / visitasCad;
    if (taxa < 0.2) insights.push({ tipo: 'at', texto: 'A página de cadastro recebe visitas, mas poucas viram conta.', base: `${visitasCad} sessões na página de cadastro e ${atual.novosCadastros} contas criadas` });
  }
  const totalCat = cats.reduce((s, c) => s + c.valor, 0);
  if (totalCat >= AMOSTRA_MINIMA && cats[0] && cats[0].valor / totalCat >= 0.4) {
    insights.push({ tipo: 'info', texto: `A categoria ${cats[0].chave} concentra ${Math.round((cats[0].valor / totalCat) * 100)}% das visualizações de produtos.`, base: `${cats[0].valor} de ${totalCat} visualizações` });
  }
  if (atual.visitantes >= AMOSTRA_MINIMA && trf.canais[0] && trf.canais[0].valor / Math.max(1, r.sessoes.length) >= 0.5) {
    insights.push({ tipo: 'info', texto: `Mais da metade das visitas vem de ${trf.canais[0].chave}.`, base: `${trf.canais[0].valor} de ${r.sessoes.length} sessões` });
  }

  return {
    atual, anterior,
    comparacao: Object.fromEntries(Object.entries(atual).map(([k, v]) => [k, typeof v === 'number' && typeof (anterior as any)[k] === 'number' ? variacao(v, (anterior as any)[k]) : null])),
    vendedoresCadastrados: vendedores.length, vendedoresAtivos: ativos, conversaoVendedor,
    fontes: trf.canais.slice(0, 8),
    estados: agruparMinimo(Array.from(ufs.entries()), MINIMO_GRUPO),
    cidades: agruparMinimo(Array.from(cids.entries()), MINIMO_GRUPO, 10),
    serie: serieDiaria(d, r),
    publicacoesAproximadas: publicacoes.some((p) => p.aproximado),
    insights,
    amostraMinima: AMOSTRA_MINIMA,
    eventosDisponiveis: d.eventos !== null,
  };
}
