// Central de notificações do usuário (SQL 17) — partes que o navegador também usa.
export type TipoNotificacao =
  | 'venda' | 'compra' | 'pagamento' | 'reembolso' | 'mensagem' | 'pergunta' | 'resposta'
  | 'saque' | 'anuncio' | 'aviso' | 'advertencia' | 'novidade'
  | 'pix_gerado' | 'adm_pix' | 'adm_venda'; // SQL 23

export type Notificacao = {
  id: number;
  tipo: TipoNotificacao;
  titulo: string;
  texto: string | null;
  link: string | null;
  lida_em: string | null;
  created_at: string;
};

export const ICONE_TIPO: Record<TipoNotificacao, string> = {
  venda: 'money', compra: 'bag', pagamento: 'clock', reembolso: 'receipt', mensagem: 'chat',
  pergunta: 'help', resposta: 'chat', saque: 'wallet', anuncio: 'package', aviso: 'megaphone',
  advertencia: 'alert', novidade: 'sparkles',
  pix_gerado: 'bolt', adm_pix: 'bolt', adm_venda: 'money',
};

/** Filtros da página /notificacoes → tipos do banco */
export const FILTROS: { id: string; rotulo: string; tipos: TipoNotificacao[] | null }[] = [
  { id: 'todas', rotulo: 'Todas', tipos: null },
  { id: 'vendas', rotulo: 'Vendas', tipos: ['venda', 'pix_gerado', 'adm_venda', 'adm_pix', 'saque', 'anuncio', 'pergunta'] },
  { id: 'compras', rotulo: 'Compras', tipos: ['compra', 'pagamento', 'reembolso', 'resposta'] },
  { id: 'mensagens', rotulo: 'Mensagens', tipos: ['mensagem'] },
  { id: 'avisos', rotulo: 'Avisos', tipos: ['aviso', 'advertencia', 'novidade'] },
];

export const PUBLICOS = [
  { id: 'todos', rotulo: 'Todos os usuários' },
  { id: 'vendedores', rotulo: 'Só vendedores (quem tem loja)' },
  { id: 'compradores', rotulo: 'Só quem já comprou' },
] as const;

/** Link interno seguro: só caminhos do próprio site ("/..."), nunca "//outro-site" ou "javascript:". */
export function linkInterno(l: unknown): string | null {
  const s = String(l ?? '').trim();
  if (!s) return null;
  if (!/^\/(?!\/)[A-Za-z0-9\-._~/?#=&%+:@!$'()*,;]*$/.test(s) || s.length > 300) return null;
  return s;
}

/** "agora", "há 5 min", "há 3 h", "ontem", "12/10" */
export function quandoFoi(iso: string, agora = Date.now()): string {
  const t = new Date(iso).getTime();
  const min = Math.floor((agora - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Erro do Supabase por falta da tabela (SQL 17 ainda não rodou) */
export const semTabela = (e: any) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /notificacoes/i.test(String(e.message || '')) && /exist|find|schema cache/i.test(String(e.message || '')));
