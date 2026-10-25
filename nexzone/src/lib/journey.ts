/**
 * Jornada de faturamento "Rumo às estrelas" — selos por faturamento bruto da loja.
 * Faturamento = soma de `orders.total` dos pedidos PAGOS (status 'pago' ou 'entregue').
 * Pedidos 'pendente', 'reembolsado' e 'cancelado' não contam.
 */

export type TierId = 'estreia' | 'ignicao' | 'decolagem' | 'orbita' | 'constelacao' | 'galaxia' | 'lenda';

export type Tier = {
  id: TierId;
  nome: string;
  /** Meta em R$ (para 'estreia' é 0 — o critério é ter ao menos 1 venda). */
  meta: number;
  descricao: string;
  cores: { from: string; to: string; ink: string; edge: string; ribbon: string };
  placa: boolean;
  glyph: 'star' | 'rocket';
};

export const PAID_STATUSES = ['pago', 'entregue'] as const;

export const TIERS: Tier[] = [
  { id: 'estreia', nome: 'Estreia', meta: 0, placa: false, glyph: 'star',
    descricao: 'A primeira venda. Agora o mundo sabe que sua loja existe.',
    cores: { from: '#E4E8EE', to: '#8C96A6', ink: '#2E3440', edge: '#5F6877', ribbon: '#4A5262' } },
  { id: 'ignicao', nome: 'Ignição', meta: 1000, placa: false, glyph: 'rocket',
    descricao: 'Os motores acenderam. Constância é o combustível daqui pra frente.',
    cores: { from: '#FFB36B', to: '#E25A00', ink: '#4A1D00', edge: '#A94300', ribbon: '#B84A00' } },
  { id: 'decolagem', nome: 'Decolagem', meta: 10000, placa: true, glyph: 'rocket',
    descricao: 'Sua loja saiu do chão. Clientes voltam e indicam.',
    cores: { from: '#E8B07A', to: '#8A4B1F', ink: '#3A1C08', edge: '#6B3812', ribbon: '#7A3F15' } },
  { id: 'orbita', nome: 'Órbita', meta: 50000, placa: false, glyph: 'star',
    descricao: 'Vendas em ritmo próprio. Seu negócio gira sozinho.',
    cores: { from: '#7FE0D4', to: '#0E7C74', ink: '#05302C', edge: '#0A5B55', ribbon: '#0B635C' } },
  { id: 'constelacao', nome: 'Constelação', meta: 100000, placa: true, glyph: 'star',
    descricao: 'Você virou referência. Outros vendedores olham para o seu brilho.',
    cores: { from: '#FFE58A', to: '#C08A12', ink: '#3D2A00', edge: '#946A08', ribbon: '#9A6D05' } },
  { id: 'galaxia', nome: 'Galáxia', meta: 500000, placa: false, glyph: 'star',
    descricao: 'Um ecossistema inteiro gira em torno da sua marca.',
    cores: { from: '#C9A4FF', to: '#5B21B6', ink: '#1E0846', edge: '#43188A', ribbon: '#4C1D95' } },
  { id: 'lenda', nome: 'Lenda Comprei Barato', meta: 1000000, placa: true, glyph: 'star',
    descricao: 'Poucos chegam aqui. Seu nome entra para a história da plataforma.',
    cores: { from: '#3A3A44', to: '#0B0B10', ink: '#F5D77A', edge: '#D4A934', ribbon: '#B8891C' } },
];

export function getTier(id: string): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

function atingiu(t: Tier, faturamento: number, vendas: number) {
  return t.id === 'estreia' ? vendas >= 1 : faturamento >= t.meta;
}

export function computeJourney(faturamento: number, vendas: number) {
  const fat = Math.max(0, Number(faturamento) || 0);
  const v = Math.max(0, Number(vendas) || 0);
  const conquistados = TIERS.filter((t) => atingiu(t, fat, v));
  // conquista é sequencial: o atual é o último conquistado
  const atual = conquistados.length ? conquistados[conquistados.length - 1] : null;
  const proximo = TIERS.find((t) => !atingiu(t, fat, v)) ?? null;

  let progresso = 1;
  let falta = 0;
  if (proximo) {
    if (proximo.id === 'estreia') {
      progresso = 0;
      falta = 0;
    } else {
      const base = atual && atual.id !== 'estreia' ? atual.meta : 0;
      progresso = Math.min(1, Math.max(0, (fat - base) / (proximo.meta - base)));
      falta = Math.max(0, proximo.meta - fat);
    }
  }
  return { atual, proximo, progresso, falta, conquistados };
}

/**
 * Soma o faturamento bruto (orders.total) e conta os pedidos pagos da loja.
 * Também devolve a data em que cada selo foi conquistado (acumulado por created_at).
 * Use um client com permissão de leitura nos pedidos da loja (dono da loja ou admin).
 */
export async function getStoreRevenue(supabase: any, storeId: string) {
  const PAGE = 1000;
  const rows: { total: number; created_at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('orders')
      .select('total, created_at')
      .eq('store_id', storeId)
      .in('status', PAID_STATUSES as unknown as string[])
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    rows.push(...(data as any[]));
    if (data.length < PAGE) break;
  }

  let faturamento = 0;
  const marcos: Partial<Record<TierId, string>> = {};
  rows.forEach((o, i) => {
    faturamento += Number(o.total) || 0;
    for (const t of TIERS) {
      if (!marcos[t.id] && atingiu(t, faturamento, i + 1)) marcos[t.id] = o.created_at;
    }
  });
  return { faturamento, vendas: rows.length, marcos };
}

export const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const brlCompact = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toLocaleString('pt-BR')} mi` : v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR')} mil` : brl(v);
