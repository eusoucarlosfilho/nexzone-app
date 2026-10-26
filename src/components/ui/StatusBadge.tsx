// Badges de status padronizados (produtos, pedidos, lojas).
// Só traduz o status recebido para rótulo e cor; não decide nenhuma regra.
type Tom = 'ok' | 'warn' | 'bad' | 'neutral' | 'info' | 'hot';

const MAPAS: Record<string, Record<string, [Tom, string]>> = {
  produto: {
    ativo: ['ok', 'Ativo'],
    em_revisao: ['warn', 'Em revisão'],
    reprovado: ['bad', 'Reprovado'],
    pausado: ['neutral', 'Pausado'],
    rascunho: ['neutral', 'Rascunho'],
  },
  pedido: {
    pendente: ['warn', 'Aguardando pagamento'],
    pago: ['info', 'Pago'],
    entregue: ['ok', 'Entregue'],
    reembolsado: ['neutral', 'Reembolsado'],
    cancelado: ['bad', 'Cancelado'],
  },
  loja: {
    pendente: ['warn', 'Em análise'],
    verificado: ['ok', 'Verificada'],
    suspenso: ['bad', 'Suspensa'],
  },
};

export function rotuloStatus(tipo: keyof typeof MAPAS, status: string | null | undefined): string {
  return MAPAS[tipo]?.[status ?? '']?.[1] ?? (status || '—');
}

export default function StatusBadge({ tipo, status }: { tipo: 'produto' | 'pedido' | 'loja'; status: string | null | undefined }) {
  const [tom, rotulo] = MAPAS[tipo]?.[status ?? ''] ?? ['neutral', status || '—'];
  return <span className={`ui-badge ${tom}`}>{rotulo}</span>;
}
