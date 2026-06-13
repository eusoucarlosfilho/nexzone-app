export const PLANOS_DESTAQUE = [
  { dias: 7, valor: 19.90, label: '7 dias' },
  { dias: 15, valor: 34.90, label: '15 dias' },
  { dias: 30, valor: 59.90, label: '30 dias' },
];
export function planoPorDias(dias: number) {
  return PLANOS_DESTAQUE.find((p) => p.dias === dias) || null;
}
