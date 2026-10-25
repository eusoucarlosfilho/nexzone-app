// Mistura de produtos nativos e ofertas parceiras numa mesma seção da vitrine.
// Regra: nativos primeiro e na ordem original; parceiros só COMPLETAM, com teto de participação
// e sem blocos longos de ofertas externas. Nenhum número de vendas é usado aqui.

export type ConfigMix = {
  ativo: boolean;          // liga/desliga a exibição de ofertas parceiras no site
  maxPct: number;          // participação máxima de parceiros numa seção com nativos (0 a 100)
  maxSemNativos: number;   // quantas ofertas mostrar quando a seção não tem nenhum nativo
  maxSeguidos: number;     // máximo de parceiros em sequência enquanto ainda há nativos
  homeQtd: number;         // ofertas na seção "Ofertas de parceiros" da página inicial (0 = esconde)
};

export const MIX_PADRAO: ConfigMix = { ativo: true, maxPct: 30, maxSemNativos: 12, maxSeguidos: 1, homeQtd: 8 };

export function normalizarMix(v: any): ConfigMix {
  const n = (x: any, min: number, max: number, def: number) => {
    const k = Number(x);
    return Number.isFinite(k) ? Math.min(max, Math.max(min, Math.round(k))) : def;
  };
  const o = v && typeof v === 'object' ? v : {};
  return {
    ativo: o.ativo === undefined ? MIX_PADRAO.ativo : o.ativo === true,
    maxPct: n(o.maxPct, 0, 100, MIX_PADRAO.maxPct),
    maxSemNativos: n(o.maxSemNativos, 0, 48, MIX_PADRAO.maxSemNativos),
    maxSeguidos: n(o.maxSeguidos, 1, 4, MIX_PADRAO.maxSeguidos),
    homeQtd: n(o.homeQtd, 0, 24, MIX_PADRAO.homeQtd),
  };
}

/** Quantas ofertas parceiras cabem numa seção com `nativos` itens e `vagas` livres. */
export function limiteParceiros(nativos: number, disponiveis: number, cfg: ConfigMix, vagas = Infinity) {
  if (!cfg.ativo || disponiveis <= 0 || vagas <= 0) return 0;
  if (nativos === 0) return Math.min(disponiveis, cfg.maxSemNativos, vagas);
  if (cfg.maxPct >= 100) return Math.min(disponiveis, vagas);
  // parceiros / (nativos + parceiros) <= maxPct
  const teto = Math.floor((nativos * cfg.maxPct) / (100 - cfg.maxPct));
  return Math.max(0, Math.min(disponiveis, teto, vagas));
}

export type ItemMix<N, P> = { tipo: 'nativo'; item: N } | { tipo: 'parceiro'; item: P };

/** Intercala respeitando o limite e o máximo de parceiros seguidos. */
export function intercalar<N, P>(nativos: N[], parceiros: P[], cfg: ConfigMix, vagas = Infinity): ItemMix<N, P>[] {
  const qtd = limiteParceiros(nativos.length, parceiros.length, cfg, vagas);
  const usados = parceiros.slice(0, qtd);
  const out: ItemMix<N, P>[] = [];
  if (!usados.length) return nativos.map((item) => ({ tipo: 'nativo', item }));
  if (!nativos.length) return usados.map((item) => ({ tipo: 'parceiro', item }));
  // um bloco de parceiros a cada `passo` nativos, começando depois do primeiro bloco de nativos
  const blocos = Math.ceil(usados.length / cfg.maxSeguidos);
  const passo = Math.max(1, Math.floor(nativos.length / blocos));
  let p = 0;
  nativos.forEach((item, i) => {
    out.push({ tipo: 'nativo', item });
    if ((i + 1) % passo === 0) {
      for (let k = 0; k < cfg.maxSeguidos && p < usados.length; k++) out.push({ tipo: 'parceiro', item: usados[p++] });
    }
  });
  while (p < usados.length) out.push({ tipo: 'parceiro', item: usados[p++] });
  return out;
}
