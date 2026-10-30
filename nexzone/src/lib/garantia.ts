// Garantia e reembolso pelo site (SQL 18) — regras puras.
// Compra pela internet tem pelo menos 7 dias de arrependimento (CDC, art. 49). O produtor pode oferecer mais.

export const GARANTIA_MINIMA = 7;
export const MOTIVOS: { id: string; rotulo: string }[] = [
  { id: 'nao_recebi', rotulo: 'Não recebi o acesso ou o arquivo' },
  { id: 'nao_era_o_esperado', rotulo: 'O conteúdo não é o que foi anunciado' },
  { id: 'problema_tecnico', rotulo: 'Problema técnico (não abre, link quebrado)' },
  { id: 'comprei_sem_querer', rotulo: 'Comprei sem querer ou em dobro' },
  { id: 'arrependimento', rotulo: 'Me arrependi da compra' },
  { id: 'outro', rotulo: 'Outro motivo' },
];
export const rotuloMotivo = (id: string) => (id === 'cancelado_vendedor' ? 'Vendedor cancelou a venda' : MOTIVOS.find((m) => m.id === id)?.rotulo ?? 'Outro motivo');

/** Dias de garantia do produto (nunca menos que 7, no máximo 365) */
export function diasDeGarantia(garantiaProduto: unknown): number {
  const n = Math.floor(Number(garantiaProduto));
  if (!Number.isFinite(n)) return GARANTIA_MINIMA;
  return Math.min(365, Math.max(GARANTIA_MINIMA, n));
}

/** Até quando o comprador pode pedir reembolso (data do pagamento + dias de garantia) */
export function fimDaGarantia(pagoEm: string | Date | null, dias: number): Date | null {
  if (!pagoEm) return null;
  const t = new Date(pagoEm).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + dias * 86400000);
}

export type Elegibilidade = { pode: true; ate: Date } | { pode: false; motivo: string; ate: Date | null };

export function podePedirReembolso(o: { status: string; pagoEm: string | null; garantiaDias: unknown; pedidoAberto?: boolean; jaDecidido?: 'aprovado' | 'recusado' | null }, agora = Date.now()): Elegibilidade {
  const dias = diasDeGarantia(o.garantiaDias);
  const ate = fimDaGarantia(o.pagoEm, dias);
  if (o.status === 'reembolsado') return { pode: false, motivo: 'Este pedido já foi reembolsado.', ate };
  if (o.status !== 'pago' && o.status !== 'entregue') return { pode: false, motivo: 'O reembolso só vale para compras pagas.', ate };
  if (o.pedidoAberto) return { pode: false, motivo: 'Já existe um pedido de reembolso em análise.', ate };
  if (o.jaDecidido === 'recusado') return { pode: false, motivo: 'O pedido de reembolso desta compra já foi analisado.', ate };
  if (!ate) return { pode: false, motivo: 'Não encontramos a data do pagamento. Fale com o suporte.', ate };
  if (ate.getTime() < agora) return { pode: false, motivo: `A garantia de ${dias} dias terminou em ${ate.toLocaleDateString('pt-BR')}.`, ate };
  return { pode: true, ate };
}

export function diasRestantes(ate: Date | null, agora = Date.now()): number {
  if (!ate) return 0;
  return Math.max(0, Math.ceil((ate.getTime() - agora) / 86400000));
}
