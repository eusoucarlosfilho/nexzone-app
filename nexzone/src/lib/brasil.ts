// UFs do Brasil e auxiliares de localização DECLARADA pelo usuário (V3).
// Localização declarada ≠ localização aproximada por IP. Nunca usamos GPS nem coordenadas.

export const UFS: { sigla: string; nome: string }[] = [
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' }, { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' }, { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' }, { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' }, { sigla: 'TO', nome: 'Tocantins' },
];

export const SIGLAS_UF = UFS.map((u) => u.sigla);

export function ufValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  return SIGLAS_UF.includes(s) ? s : null;
}

/** Nome de cidade declarado: texto curto, sem números longos, sem e-mail. */
export function cidadeValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 60) return null;
  if (/@|\d{3,}/.test(s)) return null;
  if (!/^[\p{L}\s'.\-]+$/u.test(s)) return null;
  return s;
}

/** Busca os municípios de uma UF na API pública do IBGE (no navegador). Lista vazia se falhar. */
export async function municipiosDaUf(uf: string): Promise<string[]> {
  const sigla = ufValida(uf);
  if (!sigla) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios?orderBy=nome`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    const arr = await r.json();
    return Array.isArray(arr) ? arr.map((m: any) => String(m?.nome || '')).filter(Boolean) : [];
  } catch { return []; }
}
