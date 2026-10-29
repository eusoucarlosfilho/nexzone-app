// ============================================================
// Central de notificações (SQL 23) — o que cada pessoa escolhe receber na tela do celular.
// O sino do site sempre guarda tudo; aqui se escolhe o que TOCA no celular. Partes puras (testáveis).
// ============================================================
export type Publico = 'admin' | 'vendedor' | 'todos';
export type OpcaoNotif = { id: string; rotulo: string; descricao: string; tipos: string[]; publico: Publico; fixo?: boolean };

export const GRUPOS: { id: string; titulo: string; publico: Publico; opcoes: OpcaoNotif[] }[] = [
  { id: 'plataforma', titulo: 'Plataforma inteira', publico: 'admin', opcoes: [
    { id: 'adm_pix', rotulo: 'Pix gerado em qualquer loja', descricao: 'Alguém gerou um Pix e ainda não pagou. Bom para acompanhar e recuperar.', tipos: ['adm_pix'], publico: 'admin' },
    { id: 'adm_venda', rotulo: 'Venda paga em qualquer loja', descricao: 'Pagamento confirmado no Pix ou no cartão, com valor e loja.', tipos: ['adm_venda'], publico: 'admin' },
  ] },
  { id: 'vendas', titulo: 'Suas vendas', publico: 'vendedor', opcoes: [
    { id: 'pix_gerado', rotulo: 'Pix gerado (aguardando pagamento)', descricao: 'Um cliente gerou o Pix de um produto seu. Se não pagar, chame em Vendas.', tipos: ['pix_gerado'], publico: 'vendedor' },
    { id: 'venda', rotulo: 'Venda paga', descricao: 'O pagamento caiu e o valor entrou no seu saldo a liberar.', tipos: ['venda'], publico: 'vendedor' },
    { id: 'pergunta', rotulo: 'Pergunta em anúncio', descricao: 'Alguém perguntou algo em um produto seu.', tipos: ['pergunta'], publico: 'vendedor' },
    { id: 'saque', rotulo: 'Saques', descricao: 'Saque pago ou recusado.', tipos: ['saque'], publico: 'vendedor' },
    { id: 'anuncio', rotulo: 'Anúncio aprovado ou reprovado', descricao: 'Resultado da revisão dos seus anúncios.', tipos: ['anuncio'], publico: 'vendedor' },
  ] },
  { id: 'compras', titulo: 'Suas compras', publico: 'todos', opcoes: [
    { id: 'pagamento', rotulo: 'Pix gerado nas suas compras', descricao: 'Lembrete do Pix que você gerou e ainda não pagou.', tipos: ['pagamento'], publico: 'todos' },
    { id: 'compra', rotulo: 'Compra aprovada', descricao: 'Pagamento confirmado e acesso liberado.', tipos: ['compra'], publico: 'todos' },
    { id: 'resposta', rotulo: 'Resposta a uma pergunta sua', descricao: 'O vendedor respondeu sua pergunta no anúncio.', tipos: ['resposta'], publico: 'todos' },
  ] },
  { id: 'geral', titulo: 'Conversas e avisos', publico: 'todos', opcoes: [
    { id: 'mensagem', rotulo: 'Mensagens nos pedidos', descricao: 'Nova mensagem no chat de um pedido (cliente, vendedor ou suporte).', tipos: ['mensagem'], publico: 'todos' },
    { id: 'reembolso', rotulo: 'Reembolsos', descricao: 'Reembolso registrado em uma compra ou venda sua.', tipos: ['reembolso'], publico: 'todos' },
    { id: 'aviso', rotulo: 'Avisos e novidades do Comprei Barato', descricao: 'Comunicados da plataforma e, para admins, lojistas novos e alertas da operação.', tipos: ['aviso', 'novidade'], publico: 'todos' },
    { id: 'advertencia', rotulo: 'Avisos importantes da sua conta', descricao: 'Sempre ligado: segurança e situação da conta.', tipos: ['advertencia'], publico: 'todos', fixo: true },
  ] },
];

export const TODOS_TIPOS = Array.from(new Set(GRUPOS.flatMap((g) => g.opcoes.flatMap((o) => o.tipos))));
const TIPOS_FIXOS = new Set(GRUPOS.flatMap((g) => g.opcoes.filter((o) => o.fixo).flatMap((o) => o.tipos)));

/** Grupos que a pessoa vê: admin vê tudo; quem tem loja vê vendas; todos veem compras e avisos. */
export function gruposPara(p: { admin: boolean; vendedor: boolean }) {
  return GRUPOS.filter((g) => g.publico === 'todos' || (g.publico === 'admin' && p.admin) || (g.publico === 'vendedor' && (p.vendedor || p.admin)));
}

/** Tipos que podem ser gravados (nada fora da lista; os fixos nunca desligam). */
export function tiposValidos(lista: unknown): string[] {
  const arr = Array.isArray(lista) ? lista : [];
  return Array.from(new Set(arr.map(String))).filter((t) => TODOS_TIPOS.includes(t) && !TIPOS_FIXOS.has(t));
}

/** Uma opção está ligada se nenhum dos seus tipos foi desligado (sem linha = ligado). */
export const opcaoLigada = (o: OpcaoNotif, desligados: Set<string>) => o.fixo || !o.tipos.some((t) => desligados.has(t));
