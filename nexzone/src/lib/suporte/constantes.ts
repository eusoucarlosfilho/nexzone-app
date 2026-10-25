// ============================================================
// Central de Suporte — listas e rótulos (usado no site, no admin e no servidor).
// Os valores (chaves) precisam bater com os CHECKs da migração 0008.
// ============================================================

export const CATEGORIAS_SUPORTE = [
  { id: 'compra_entrega', nome: 'Problema com compra/entrega' },
  { id: 'pagamento_pix', nome: 'Pagamento/Pix' },
  { id: 'reembolso', nome: 'Reembolso' },
  { id: 'saque_saldo', nome: 'Saque/Saldo do vendedor' },
  { id: 'cadastro_login', nome: 'Cadastro/Login' },
  { id: 'publicar_produto', nome: 'Publicar ou editar produto' },
  { id: 'destaque', nome: 'Destaque/Impulsionamento' },
  { id: 'denuncia', nome: 'Denúncia de produto ou vendedor' },
  { id: 'sugestao', nome: 'Sugestão' },
  { id: 'outro', nome: 'Outro' },
] as const;
export type CategoriaSuporte = (typeof CATEGORIAS_SUPORTE)[number]['id'];

// Pagamento/Pix e Reembolso entram como urgentes automaticamente.
export const CATEGORIAS_URGENTES: CategoriaSuporte[] = ['pagamento_pix', 'reembolso'];

export const STATUS_SUPORTE = [
  { id: 'aberto', nome: 'Aberto', cor: '#E25A00' },
  { id: 'em_atendimento', nome: 'Em atendimento', cor: '#2563EB' },
  { id: 'aguardando_cliente', nome: 'Aguardando cliente', cor: '#B7791F' },
  { id: 'resolvido', nome: 'Resolvido', cor: '#00875A' },
  { id: 'fechado', nome: 'Fechado', cor: '#6B7280' },
] as const;
export type StatusSuporte = (typeof STATUS_SUPORTE)[number]['id'];

export const PRIORIDADES_SUPORTE = [
  { id: 'baixa', nome: 'Baixa', cor: '#6B7280' },
  { id: 'normal', nome: 'Normal', cor: '#2563EB' },
  { id: 'alta', nome: 'Alta', cor: '#E25A00' },
  { id: 'urgente', nome: 'Urgente', cor: '#C62828' },
] as const;
export type PrioridadeSuporte = (typeof PRIORIDADES_SUPORTE)[number]['id'];

export const EVENTOS_SUPORTE: Record<string, string> = {
  aberto: 'Chamado aberto',
  status_alterado: 'Status alterado',
  prioridade_alterada: 'Prioridade alterada',
  atribuido: 'Responsável alterado',
  respondido: 'Resposta enviada',
  nota_interna: 'Nota interna',
  reaberto: 'Chamado reaberto',
};

export const nomeCategoria = (id?: string | null) => CATEGORIAS_SUPORTE.find((c) => c.id === id)?.nome || id || '—';
export const nomeStatus = (id?: string | null) => STATUS_SUPORTE.find((s) => s.id === id)?.nome || id || '—';
export const corStatus = (id?: string | null) => STATUS_SUPORTE.find((s) => s.id === id)?.cor || '#6B7280';
export const nomePrioridade = (id?: string | null) => PRIORIDADES_SUPORTE.find((p) => p.id === id)?.nome || id || '—';
export const corPrioridade = (id?: string | null) => PRIORIDADES_SUPORTE.find((p) => p.id === id)?.cor || '#6B7280';

// Limites
export const ANEXO_MAX_BYTES = 5 * 1024 * 1024;
export const ANEXO_TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'] as const;
export const MENSAGEM_MIN = 20;
export const MENSAGEM_MAX = 5000;
export const ASSUNTO_MAX = 160;
export const REABRIR_DIAS = 7;            // cliente pode reabrir até 7 dias depois de "resolvido"
export const FECHAR_AGUARDANDO_DIAS = 5;  // "aguardando_cliente" sem resposta por 5 dias fecha sozinho
export const LIMITE_CHAMADOS_HORA = 3;    // por e-mail ou por IP

export const BUCKET_ANEXOS = 'suporte-anexos';
