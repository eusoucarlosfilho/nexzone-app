// Telefone brasileiro para WhatsApp: normaliza para 55 + DDD + número (só dígitos) e valida.
// Função pura (roda no navegador para a máscara e no servidor antes de enviar).

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Devolve "55DDNNNNNNNNN" ou null se não for um celular/telefone brasileiro válido. */
export function normalizarTelefone(bruto: unknown): string | null {
  if (bruto === null || bruto === undefined) return null;
  let d = String(bruto).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1); // 0 + DDD + número
  else if (d.length === 12 || d.length === 13) { if (!d.startsWith('55')) return null; d = d.slice(2); }
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (!DDDS.has(ddd)) return null;
  const num = d.slice(2);
  if (num.length === 9 && num[0] !== '9') return null;               // celular com 9 dígitos começa com 9
  if (num.length === 8 && !/^[2-9]/.test(num)) return null;
  if (/^(\d)\1+$/.test(num)) return null;                             // 99999999 etc.
  return '55' + d;
}

/** Máscara de exibição: (63) 99999-9999 */
export function formatarTelefone(bruto: unknown): string {
  const n = normalizarTelefone(bruto);
  const d = n ? n.slice(2) : String(bruto ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  const ddd = d.slice(0, 2), r = d.slice(2);
  if (r.length <= 4) return `(${ddd}) ${r}`;
  if (r.length <= 8) return `(${ddd}) ${r.slice(0, r.length - 4)}-${r.slice(-4)}`;
  return `(${ddd}) ${r.slice(0, 5)}-${r.slice(5, 9)}`;
}

/** Para mostrar no admin sem expor o número inteiro: 55 63 9****-1234 */
export function mascararTelefone(n: string | null | undefined) {
  if (!n) return '—';
  const d = n.replace(/\D/g, '');
  if (d.length < 8) return '••••';
  return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 5)}****-${d.slice(-4)}`;
}
