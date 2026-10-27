// CPF e CNPJ: limpeza, validação dos dígitos e máscara (sem consultar nada fora).

export const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

export function cpfValido(v: unknown): boolean {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dig = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(c[9]) && dig(10) === Number(c[10]);
}

export function cnpjValido(v: unknown): boolean {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((t, p, i) => t + Number(c[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function formatarDocumento(v: unknown): string {
  const c = soDigitos(v);
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return c;
}

/** "•••.•••.•••-12" — para mostrar sem expor o número */
export function mascararDocumento(tipo: 'pf' | 'pj', final: string): string {
  return tipo === 'pf' ? `•••.•••.•••-${final.slice(-2)}` : `••.•••.•••/••••-${final.slice(-2)}`;
}

/** Idade em anos completos numa data */
export function idade(nascimento: string, agora = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento || '');
  if (!m) return null;
  const n = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(n.getTime())) return null;
  let a = agora.getFullYear() - n.getFullYear();
  if (agora.getMonth() < n.getMonth() || (agora.getMonth() === n.getMonth() && agora.getDate() < n.getDate())) a--;
  return a;
}
