// ============================================================
// Alterações do anúncio para a Fila de Aprovação (SQL 09: tabela product_edicoes).
// O banco grava { campo: { antes, depois } } a cada edição. Aqui juntamos as edições
// ainda não revisadas (o "antes" da primeira e o "depois" da última) e preparamos a lista.
// ============================================================

export type EdicaoBruta = {
  tipo?: string | null;
  alteracoes?: Record<string, { antes: any; depois: any }> | null;
  created_at?: string | null;
};

export type ItemAlteracao =
  | { campo: string; rotulo: string; tipo: 'texto' | 'valor'; antes: string; depois: string }
  | { campo: string; rotulo: string; tipo: 'linhas'; linhas: { op: '=' | '-' | '+'; t: string }[]; antes: string; depois: string }
  | { campo: string; rotulo: string; tipo: 'sensivel'; antes: string; depois: string }
  | { campo: string; rotulo: string; tipo: 'imagens'; adicionadas: string[]; removidas: string[]; capaTrocada: boolean; ordemMudou: boolean; capaAntes: string | null; capaDepois: string | null };

export type ResumoAlteracoes = {
  edicoes: number;            // quantas edições pendentes
  reativacao: boolean;        // houve reativação (pausado/reprovado → revisão)
  ultima: string | null;      // data da última edição
  itens: ItemAlteracao[];
};

const ROTULO: Record<string, string> = {
  titulo: 'Título', categoria: 'Categoria', preco: 'Preço', preco_promo: 'Preço promocional',
  descricao: 'Descrição', tipo_entrega: 'Tipo de entrega', conteudo_entrega: 'Conteúdo entregue ao comprador',
  garantia_dias: 'Garantia', arquivo: 'Arquivo do produto', imagens: 'Fotos', emoji: 'Ícone',
};
const ORDEM = ['titulo', 'preco', 'preco_promo', 'categoria', 'imagens', 'descricao', 'tipo_entrega', 'conteudo_entrega', 'arquivo', 'garantia_dias', 'emoji'];
const ENTREGA: Record<string, string> = { arquivo: 'Arquivo para download', chave: 'Chave / código', link: 'Link de acesso', acesso: 'Acesso / instrução' };

const vazio = (v: any) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const igual = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function dinheiro(v: any): string {
  if (vazio(v)) return '(sem)';
  const n = Number(v);
  return Number.isFinite(n) ? 'R$ ' + n.toFixed(2).replace('.', ',') : String(v);
}

function texto(v: any): string {
  if (vazio(v)) return '(vazio)';
  return String(v);
}

function lista(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x);
  if (typeof v === 'string' && v.trim().startsWith('[')) { try { return lista(JSON.parse(v)); } catch { return []; } }
  return [];
}

/** Diferença por linhas (LCS). Devolve linhas mantidas (=), removidas (-) e adicionadas (+). */
export function diffLinhas(antes: string, depois: string, limite = 400): { op: '=' | '-' | '+'; t: string }[] {
  const a = String(antes ?? '').split(/\r?\n/).slice(0, limite);
  const b = String(depois ?? '').split(/\r?\n/).slice(0, limite);
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: { op: '=' | '-' | '+'; t: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: '=', t: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ op: '-', t: a[i++] });
    else out.push({ op: '+', t: b[j++] });
  }
  while (i < n) out.push({ op: '-', t: a[i++] });
  while (j < m) out.push({ op: '+', t: b[j++] });
  return out;
}

/** Junta as edições pendentes (em ordem cronológica) e monta a lista para o admin. */
export function resumirAlteracoes(edicoes: EdicaoBruta[]): ResumoAlteracoes {
  const ord = [...(edicoes ?? [])].sort((x, y) => String(x.created_at ?? '').localeCompare(String(y.created_at ?? '')));
  const junto: Record<string, { antes: any; depois: any }> = {};
  for (const e of ord) {
    for (const [campo, v] of Object.entries(e.alteracoes ?? {})) {
      if (!v || typeof v !== 'object') continue;
      if (campo in junto) junto[campo].depois = (v as any).depois;
      else junto[campo] = { antes: (v as any).antes, depois: (v as any).depois };
    }
  }
  // arquivo_path + arquivo_nome viram um item só; capa_url só aparece se as fotos não mudaram
  if (junto.arquivo_path || junto.arquivo_nome) {
    const nomeA = junto.arquivo_nome?.antes, nomeD = junto.arquivo_nome?.depois;
    const pathA = junto.arquivo_path?.antes, pathD = junto.arquivo_path?.depois;
    junto.arquivo = {
      antes: vazio(nomeA) ? (vazio(pathA) ? null : 'arquivo enviado') : nomeA,
      depois: vazio(nomeD) ? (vazio(pathD) ? null : 'arquivo enviado') : nomeD,
    };
    if (!igual(pathA, pathD) && igual(junto.arquivo.antes, junto.arquivo.depois)) junto.arquivo.depois = `${texto(junto.arquivo.depois)} (arquivo substituído)`;
    delete junto.arquivo_path; delete junto.arquivo_nome;
  }
  if (junto.capa_url) {
    if (!junto.imagens) junto.imagens = { antes: vazio(junto.capa_url.antes) ? [] : [junto.capa_url.antes], depois: vazio(junto.capa_url.depois) ? [] : [junto.capa_url.depois] };
    delete junto.capa_url;
  }

  const itens: ItemAlteracao[] = [];
  const rank = (c: string) => (ORDEM.indexOf(c) < 0 ? 999 : ORDEM.indexOf(c));
  const campos = Object.keys(junto).sort((x, y) => rank(x) - rank(y));
  for (const campo of campos) {
    const { antes, depois } = junto[campo];
    const rotulo = ROTULO[campo] ?? campo;
    if (campo === 'imagens') {
      const A = lista(antes), D = lista(depois);
      const adicionadas = D.filter((u) => !A.includes(u));
      const removidas = A.filter((u) => !D.includes(u));
      const capaTrocada = (A[0] ?? null) !== (D[0] ?? null);
      const comuns = D.filter((u) => A.includes(u));
      const ordemMudou = !adicionadas.length && !removidas.length && !capaTrocada && comuns.join('|') !== A.filter((u) => D.includes(u)).join('|');
      if (!adicionadas.length && !removidas.length && !capaTrocada && !ordemMudou) continue;
      itens.push({ campo, rotulo, tipo: 'imagens', adicionadas, removidas, capaTrocada, ordemMudou, capaAntes: A[0] ?? null, capaDepois: D[0] ?? null });
      continue;
    }
    if (igual(antes, depois) || (vazio(antes) && vazio(depois))) continue;
    if (campo === 'preco' || campo === 'preco_promo') {
      if (Number(antes) === Number(depois) && !vazio(antes) && !vazio(depois)) continue;
      itens.push({ campo, rotulo, tipo: 'valor', antes: dinheiro(antes), depois: dinheiro(depois) });
    } else if (campo === 'garantia_dias') {
      itens.push({ campo, rotulo, tipo: 'valor', antes: vazio(antes) ? '(sem)' : `${antes} dias`, depois: vazio(depois) ? '(sem)' : `${depois} dias` });
    } else if (campo === 'tipo_entrega') {
      itens.push({ campo, rotulo, tipo: 'texto', antes: ENTREGA[antes] ?? texto(antes), depois: ENTREGA[depois] ?? texto(depois) });
    } else if (campo === 'conteudo_entrega') {
      itens.push({ campo, rotulo, tipo: 'sensivel', antes: texto(antes), depois: texto(depois) });
    } else if (campo === 'descricao') {
      itens.push({ campo, rotulo, tipo: 'linhas', linhas: diffLinhas(String(antes ?? ''), String(depois ?? '')), antes: texto(antes), depois: texto(depois) });
    } else {
      itens.push({ campo, rotulo, tipo: 'texto', antes: texto(antes), depois: texto(depois) });
    }
  }

  return {
    edicoes: ord.filter((e) => e.tipo !== 'reativacao').length,
    reativacao: ord.some((e) => e.tipo === 'reativacao'),
    ultima: ord.length ? (ord[ord.length - 1].created_at ?? null) : null,
    itens,
  };
}
