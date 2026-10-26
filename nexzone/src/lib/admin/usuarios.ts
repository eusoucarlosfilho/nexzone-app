// Inteligência de usuários (Admin > Usuários, V3).
// Só para rotas de servidor protegidas por adminSeguro (C1). Nunca importar em componente de cliente.
//
// Fontes (todas reais):
// - Auth (service role): e-mail, data/hora do cadastro, último login, metadados do cadastro
//   (localização DECLARADA e origem da visita, gravados a partir da V3).
// - profiles: papel, situação, nome; e, depois do SQL V3 02, uf/cidade/origem/vendedor_desde.
// - stores / products: loja, produtos publicados e, depois do SQL V3 03, data de publicação.
// - site_sessions: localização APROXIMADA por rede (cidade/UF), só de quem navegou logado.
import { canalDe, type Utm } from '../eventos';
import { chaveDia, variacao } from './tempo';

export type LinhaUsuario = {
  id: string;
  nome: string;
  email: string | null;
  tipo: 'comprador' | 'vendedor' | 'admin';
  papel: string;
  situacao: string;
  criadoEm: string | null;
  ultimoLogin: string | null;
  ultimaAtividade: string | null;
  uf: string | null;
  cidade: string | null;
  pais: string | null;
  localizacaoFonte: 'declarada' | 'aproximada' | null;
  origemCanal: string | null;
  origemCampanha: string | null;
  origemFonte: string | null;
  provedor: string | null;
  loja: null | { id: string; nome: string; slug: string; status: string; criadaEm: string; ocultarVendedor: boolean };
  produtosPublicados: number;
  produtosTotal: number;
  vendedorAtivadoEm: string | null;
  vendedorAtivadoFonte: 'registro' | 'loja' | null;
  primeiraPublicacao: string | null;
  primeiraPublicacaoAproximada: boolean;
};

export type Fontes = {
  authUsers: any[];
  perfis: any[];
  lojas: any[];
  produtos: any[]; // { store_id, status, created_at, publicado_em? }
  sessoesLogadas: any[]; // { user_id, city, region, country, last_seen }
  temPublicadoEm: boolean;
};

const txt = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function montarLinhas(f: Fontes): LinhaUsuario[] {
  const authPor = new Map<string, any>(f.authUsers.map((u) => [u.id, u]));
  const lojaPor = new Map<string, any>();
  f.lojas.forEach((s) => { if (!lojaPor.has(s.owner)) lojaPor.set(s.owner, s); });
  const prodPorLoja = new Map<string, { pub: number; tot: number; primeira: string | null; aprox: boolean }>();
  f.produtos.forEach((p) => {
    const a = prodPorLoja.get(p.store_id) || { pub: 0, tot: 0, primeira: null, aprox: false };
    a.tot++;
    if (p.status === 'ativo') a.pub++;
    // Data real de publicação (SQL V3 03) ou, sem ela, criação de um produto hoje ativo (aproximado).
    const real = f.temPublicadoEm && p.publicado_em ? p.publicado_em : null;
    const marco = real || (p.status === 'ativo' ? p.created_at : null);
    if (marco && (!a.primeira || marco < a.primeira)) { a.primeira = marco; a.aprox = !real; }
    prodPorLoja.set(p.store_id, a);
  });
  const sessPor = new Map<string, any>();
  f.sessoesLogadas.forEach((s) => {
    const cur = sessPor.get(s.user_id);
    if (!cur || (s.last_seen || '') > (cur.last_seen || '')) sessPor.set(s.user_id, s);
  });

  const ids = new Set<string>([...f.perfis.map((p) => p.id), ...f.authUsers.map((u) => u.id)]);
  const perfilPor = new Map<string, any>(f.perfis.map((p) => [p.id, p]));
  const linhas: LinhaUsuario[] = [];
  ids.forEach((id) => {
    const p = perfilPor.get(id) || {};
    const u = authPor.get(id) || {};
    const meta = u.user_metadata || u.raw_user_meta_data || {};
    const loja = lojaPor.get(id) || null;
    const prod = loja ? prodPorLoja.get(loja.id) : undefined;
    const papel = p.role || 'comprador';
    const tipo: LinhaUsuario['tipo'] = papel === 'admin' ? 'admin' : (loja || papel === 'vendedor' || papel === 'ambos') ? 'vendedor' : 'comprador';

    // Localização: perfil (SQL V3) > metadados declarados > aproximada por rede
    let uf = txt(p.uf) || txt(meta.uf);
    let cidade = txt(p.cidade) || (uf ? txt(meta.cidade) : null);
    let pais = txt(p.pais) || txt(meta.pais);
    let fonte: LinhaUsuario['localizacaoFonte'] = uf ? 'declarada' : null;
    const sess = sessPor.get(id);
    if (!uf && sess && (sess.region || sess.city)) {
      uf = sess.country === 'BR' ? txt(sess.region) : null;
      cidade = txt(sess.city);
      pais = txt(sess.country);
      fonte = 'aproximada';
    }

    const origem: (Utm & { ref?: string }) | null = (p.origem && typeof p.origem === 'object') ? p.origem : (meta.origem && typeof meta.origem === 'object' ? meta.origem : null);
    const vendedorDesde = txt(p.vendedor_desde);

    linhas.push({
      id,
      nome: txt(p.nome) || txt(meta.nome) || txt(meta.full_name) || (u.email ? String(u.email).split('@')[0] : 'Usuário'),
      email: u.email || null,
      tipo,
      papel,
      situacao: p.status || 'ativo',
      criadoEm: u.created_at || p.created_at || null,
      ultimoLogin: u.last_sign_in_at || null,
      ultimaAtividade: sess?.last_seen || null,
      uf, cidade, pais,
      localizacaoFonte: fonte,
      origemCanal: origem ? canalDe(origem, origem.ref || null) : null,
      origemCampanha: origem?.utm_campaign || null,
      origemFonte: origem?.utm_source || origem?.ref || null,
      provedor: u.app_metadata?.provider || null,
      loja: loja ? { id: loja.id, nome: loja.nome, slug: loja.slug, status: loja.status, criadaEm: loja.created_at, ocultarVendedor: loja.ocultar_vendedor === true } : null,
      produtosPublicados: prod?.pub || 0,
      produtosTotal: prod?.tot || 0,
      vendedorAtivadoEm: vendedorDesde || (loja ? loja.created_at : null),
      vendedorAtivadoFonte: vendedorDesde ? 'registro' : loja ? 'loja' : null,
      primeiraPublicacao: prod?.primeira || null,
      primeiraPublicacaoAproximada: prod ? prod.aprox : false,
    });
  });
  return linhas.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
}

export type Filtro = {
  de?: Date | null; ate?: Date | null;
  tipo?: 'compradores' | 'vendedores' | 'admins' | null;
  uf?: string | null; cidade?: string | null; canal?: string | null; situacao?: string | null;
  produtos?: 'com' | 'sem' | null;
  q?: string | null;
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrar(linhas: LinhaUsuario[], f: Filtro): LinhaUsuario[] {
  const q = f.q ? norm(f.q.trim()).slice(0, 80) : '';
  const cid = f.cidade ? norm(f.cidade) : '';
  return linhas.filter((l) => {
    if (f.de || f.ate) {
      const t = l.criadoEm ? new Date(l.criadoEm).getTime() : NaN;
      if (!Number.isFinite(t)) return false;
      if (f.de && t < f.de.getTime()) return false;
      if (f.ate && t >= f.ate.getTime()) return false;
    }
    if (f.tipo === 'compradores' && l.tipo !== 'comprador') return false;
    if (f.tipo === 'vendedores' && l.tipo !== 'vendedor') return false;
    if (f.tipo === 'admins' && l.tipo !== 'admin') return false;
    if (f.uf && l.uf !== f.uf) return false;
    if (cid && norm(l.cidade || '') !== cid) return false;
    if (f.canal && (l.origemCanal || 'Sem registro') !== f.canal) return false;
    if (f.situacao && l.situacao !== f.situacao) return false;
    if (f.produtos === 'com' && !(l.tipo === 'vendedor' && l.produtosPublicados > 0)) return false;
    if (f.produtos === 'sem' && !(l.tipo === 'vendedor' && l.produtosPublicados === 0)) return false;
    if (q && !norm(`${l.nome} ${l.email || ''} ${l.id}`).includes(q)) return false;
    return true;
  });
}

export function paginar<T>(lista: T[], pagina: number, tamanho: number) {
  const tam = Math.min(Math.max(1, Math.floor(tamanho) || 20), 50);
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / tam));
  const pag = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  return { itens: lista.slice((pag - 1) * tam, pag * tam), pagina: pag, paginas, total, tamanho: tam };
}

/** Agrupa e esconde grupos pequenos (proteção contra identificação). */
export function agruparMinimo(pares: [string, number][], minimo: number, top = 27) {
  const grandes = pares.filter(([, n]) => n >= minimo).sort((a, b) => b[1] - a[1]);
  const pequenos = pares.filter(([, n]) => n < minimo).reduce((s, [, n]) => s + n, 0);
  return { grupos: grandes.slice(0, top).map(([chave, valor]) => ({ chave, valor })), ocultos: pequenos + grandes.slice(top).reduce((s, [, n]) => s + n, 0) };
}

export const MINIMO_GRUPO = 3;

export function resumir(linhas: LinhaUsuario[], janelas: { hoje: Date; d7: Date; d14: Date; d30: Date; d60: Date; agora: Date }, minimo = MINIMO_GRUPO) {
  const t = (l: LinhaUsuario) => (l.criadoEm ? new Date(l.criadoEm).getTime() : NaN);
  const entre = (a: Date, b: Date) => linhas.filter((l) => { const x = t(l); return x >= a.getTime() && x < b.getTime(); });
  const fim = new Date(janelas.agora.getTime() + 1);
  const n7 = entre(janelas.d7, fim).length; const n7ant = entre(janelas.d14, janelas.d7).length;
  const n30 = entre(janelas.d30, fim).length; const n30ant = entre(janelas.d60, janelas.d30).length;
  const vendedores = linhas.filter((l) => l.tipo === 'vendedor');
  const kpis = {
    total: linhas.length,
    hoje: entre(janelas.hoje, fim).length,
    d7: n7, d7Anterior: n7ant, d7Variacao: variacao(n7, n7ant),
    d30: n30, d30Anterior: n30ant, d30Variacao: variacao(n30, n30ant),
    compradores: linhas.filter((l) => l.tipo === 'comprador').length,
    vendedores: vendedores.length,
    admins: linhas.filter((l) => l.tipo === 'admin').length,
    vendedoresComProduto: vendedores.filter((l) => l.produtosPublicados > 0).length,
    vendedoresSemProduto: vendedores.filter((l) => l.produtosPublicados === 0).length,
    comLocalizacaoDeclarada: linhas.filter((l) => l.localizacaoFonte === 'declarada').length,
    comLocalizacaoAproximada: linhas.filter((l) => l.localizacaoFonte === 'aproximada').length,
    comOrigem: linhas.filter((l) => !!l.origemCanal).length,
  };

  // Série diária (30 dias) por tipo atual da conta
  const dias: { dia: string; compradores: number; vendedores: number }[] = [];
  const idx = new Map<string, number>();
  for (let tt = janelas.d30.getTime() + 12 * 3600e3; tt <= janelas.agora.getTime() + 12 * 3600e3; tt += 24 * 3600e3) {
    const k = chaveDia(new Date(Math.min(tt, janelas.agora.getTime())));
    if (idx.has(k)) continue;
    idx.set(k, dias.length); dias.push({ dia: k, compradores: 0, vendedores: 0 });
  }
  entre(janelas.d30, fim).forEach((l) => {
    const i = idx.get(chaveDia(new Date(l.criadoEm!)));
    if (i === undefined) return;
    if (l.tipo === 'vendedor') dias[i].vendedores++; else dias[i].compradores++;
  });

  const conta = (f: (l: LinhaUsuario) => string | null, base = linhas) => {
    const m = new Map<string, number>();
    base.forEach((l) => { const k = f(l); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries());
  };
  const porUf = agruparMinimo(conta((l) => (l.pais === 'BR' || l.uf) ? l.uf : null), minimo);
  const porUfDeclarada = agruparMinimo(conta((l) => l.localizacaoFonte === 'declarada' ? l.uf : null), minimo);
  const porCidade = agruparMinimo(conta((l) => l.cidade ? `${l.cidade}${l.uf ? ' · ' + l.uf : ''}` : null), minimo, 15);
  const novos30 = entre(janelas.d30, fim);
  const origens = agruparMinimo(conta((l) => l.origemCanal || 'Sem registro', novos30), 1, 12);
  const campanhas = agruparMinimo(conta((l) => l.origemCampanha, novos30), minimo, 12);

  const comLoja = vendedores.length;
  const comProduto = vendedores.filter((l) => l.produtosTotal > 0).length;
  const publicaram = kpis.vendedoresComProduto;
  const funilVendedor = [
    { etapa: 'Contas criadas', valor: linhas.length },
    { etapa: 'Ativaram perfil de vendedor / criaram loja', valor: comLoja },
    { etapa: 'Cadastraram produto', valor: comProduto },
    { etapa: 'Têm produto publicado', valor: publicaram },
  ];

  return { kpis, serie: dias, porUf, porUfDeclarada, porCidade, origens, campanhas, funilVendedor, minimoGrupo: minimo };
}
