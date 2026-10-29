// Eventos que geram aviso por WhatsApp, com modelo padrão (texto curto, sem HTML) e variáveis.
// Os modelos podem ser editados no Admin; aqui ficam os padrões e a montagem do texto.

export type Destinatario = 'comprador' | 'vendedor' | 'admin' | 'cliente' | 'usuario';

export type DefEvento = {
  chave: string;
  rotulo: string;
  para: Destinatario;
  grupo: 'Compras e vendas' | 'Mensagens' | 'Suporte' | 'Vendedor' | 'Admin';
  variaveis: string[];
  padrao: string;
};

export const EVENTOS: DefEvento[] = [
  { chave: 'compra_aprovada', rotulo: 'Compra aprovada (acesso liberado)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Olá, {nome}! Pagamento confirmado ✅\n{produto} — {valor}\nSeu acesso já está liberado: {link}\n\nPrecisa de ajuda com a entrega? Fale direto com o vendedor no chat do pedido, no mesmo link.' },
  { chave: 'pix_gerado', rotulo: 'Pix gerado: link e código para pagar (na hora)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link', 'pix'],
    padrao: 'Oi, {nome}! Você está a um passo de garantir {produto} ({valor}). 🎮\nPara terminar, pague o Pix pelo link: {link}\n\nOu copie o código Pix abaixo e cole no app do seu banco:' },
  { chave: 'pix_codigo', rotulo: 'Código Pix copia e cola (mensagem só com o código, logo depois da anterior)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['pix'],
    padrao: '{pix}' },
  { chave: 'pix_lembrete', rotulo: 'Lembrete de Pix não pago (tempo em Pedidos › Recuperação)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Oi, {nome}! Seu pedido de {produto} ({valor}) está reservado, só falta o Pix. ⏳\nO código continua aqui: {link}' },
  { chave: 'pix_lembrete_24h', rotulo: 'Lembrete de compra não concluída (24 h)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Oi, {nome}! Você ainda quer {produto}? Gere um novo Pix em menos de 1 minuto e receba o acesso na hora: {link}' },
  { chave: 'carrinho_1h', rotulo: 'Carrinho abandonado (1º lembrete)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'cupom', 'link'],
    padrao: 'Oi, {nome}! Você deixou {produto} no carrinho. 🛒\nTermine em menos de 1 minuto: {link}' },
  { chave: 'carrinho_24h', rotulo: 'Carrinho abandonado (24 h)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'cupom', 'link'],
    padrao: 'Oi, {nome}! Ainda pensando em {produto}? Seu acesso sai na hora depois do pagamento: {link}' },
  { chave: 'nova_venda', rotulo: 'Nova venda (vendedor)', para: 'vendedor', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Nova venda na sua loja! 🎉\n{produto} — {valor}\nVeja os detalhes: {link}' },
  { chave: 'nova_mensagem', rotulo: 'Nova mensagem no chat do pedido', para: 'usuario', grupo: 'Mensagens', variaveis: ['nome', 'produto', 'pedido', 'link'],
    padrao: 'Você tem uma nova mensagem no pedido de {produto}.\nResponda por aqui: {link}' },
  { chave: 'escalonamento', rotulo: 'Cliente aguardando resposta (vendedor)', para: 'vendedor', grupo: 'Mensagens', variaveis: ['nome', 'produto', 'horas', 'pedido', 'link'],
    padrao: 'Um cliente está aguardando sua resposta há mais de {horas}h no pedido de {produto}.\nResponda agora: {link}' },
  { chave: 'suporte_novo', rotulo: 'Chamado de suporte novo (admin)', para: 'admin', grupo: 'Suporte', variaveis: ['protocolo', 'assunto', 'link'],
    padrao: 'Novo chamado {protocolo}: {assunto}\n{link}' },
  { chave: 'suporte_cliente_respondeu', rotulo: 'Cliente respondeu o chamado (admin)', para: 'admin', grupo: 'Suporte', variaveis: ['protocolo', 'assunto', 'link'],
    padrao: 'O cliente respondeu o chamado {protocolo} ({assunto}).\n{link}' },
  { chave: 'suporte_confirmacao', rotulo: 'Chamado recebido (cliente)', para: 'cliente', grupo: 'Suporte', variaveis: ['nome', 'protocolo', 'assunto', 'link'],
    padrao: 'Olá, {nome}! Recebemos seu chamado {protocolo} ({assunto}). Vamos responder em breve.\nAcompanhe: {link}' },
  { chave: 'suporte_resposta', rotulo: 'Resposta do suporte (cliente)', para: 'cliente', grupo: 'Suporte', variaveis: ['nome', 'protocolo', 'assunto', 'link'],
    padrao: 'Olá, {nome}! O suporte respondeu seu chamado {protocolo}.\nVeja a resposta: {link}' },
  { chave: 'suporte_resolvido', rotulo: 'Chamado resolvido (cliente)', para: 'cliente', grupo: 'Suporte', variaveis: ['nome', 'protocolo', 'assunto', 'link'],
    padrao: 'Seu chamado {protocolo} foi marcado como resolvido. Se precisar, responda pelo link: {link}' },
  { chave: 'suporte_encerrado', rotulo: 'Chamado encerrado automaticamente (cliente)', para: 'cliente', grupo: 'Suporte', variaveis: ['nome', 'protocolo', 'assunto', 'link'],
    padrao: 'Seu chamado {protocolo} foi encerrado por falta de resposta. Se ainda precisar de ajuda, abra outro: {link}' },
  { chave: 'produto_aprovado', rotulo: 'Produto aprovado', para: 'vendedor', grupo: 'Vendedor', variaveis: ['nome', 'produto', 'link'],
    padrao: 'Seu produto "{produto}" foi aprovado e já está à venda no Comprei Barato! ✅\n{link}' },
  { chave: 'produto_reprovado', rotulo: 'Produto reprovado', para: 'vendedor', grupo: 'Vendedor', variaveis: ['nome', 'produto', 'link'],
    padrao: 'Seu produto "{produto}" não foi aprovado. Revise as informações e envie de novo: {link}' },
  { chave: 'saque_solicitado', rotulo: 'Saque solicitado', para: 'vendedor', grupo: 'Vendedor', variaveis: ['nome', 'valor', 'link'],
    padrao: 'Recebemos seu pedido de saque de {valor}. Avisaremos quando for pago.\n{link}' },
  { chave: 'saque_pago', rotulo: 'Saque pago', para: 'vendedor', grupo: 'Vendedor', variaveis: ['nome', 'valor', 'link'],
    padrao: 'Seu saque de {valor} foi pago via Pix. 💸\n{link}' },
  { chave: 'saque_recusado', rotulo: 'Saque recusado', para: 'vendedor', grupo: 'Vendedor', variaveis: ['nome', 'valor', 'link'],
    padrao: 'Seu saque de {valor} não foi aprovado. Fale com o suporte para entender: {link}' },
  { chave: 'reclamacao_aberta', rotulo: 'Reclamação aberta (vendedor)', para: 'vendedor', grupo: 'Vendedor', variaveis: ['nome', 'produto', 'pedido', 'link'],
    padrao: 'Um cliente abriu uma reclamação no pedido de {produto}. Converse com ele para resolver: {link}' },
  { chave: 'reclamacao_resolvida', rotulo: 'Reclamação resolvida (cliente e vendedor)', para: 'usuario', grupo: 'Vendedor', variaveis: ['nome', 'produto', 'pedido', 'link'],
    padrao: 'A reclamação do pedido de {produto} foi marcada como resolvida pelo suporte.\n{link}' },
  { chave: 'avaliacao_recebida', rotulo: 'Avaliação recebida (vendedor)', para: 'vendedor', grupo: 'Vendedor', variaveis: ['nome', 'produto', 'nota', 'link'],
    padrao: 'Você recebeu uma avaliação de {nota} estrela(s) em {produto}. ⭐\n{link}' },
  { chave: 'aviso_admin', rotulo: 'Aviso do admin para um usuário', para: 'usuario', grupo: 'Admin', variaveis: ['nome', 'mensagem', 'link'],
    padrao: 'Comprei Barato: {mensagem}\n{link}' },
];

export const CHAVES_EVENTOS = EVENTOS.map((e) => e.chave);
export const acharEvento = (k: string) => EVENTOS.find((e) => e.chave === k) || null;

export const LIMITE_TEXTO = 1000;

/** Remove HTML e excesso de espaços; mantém quebras de linha. */
export function textoLimpo(s: unknown): string {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Monta o texto: troca {variavel}; variável sem valor vira vazio; limita o tamanho. */
export function montarTexto(modelo: string, vars: Record<string, string | number | null | undefined>): string {
  const t = textoLimpo(modelo).replace(/\{([a-z_]+)\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : textoLimpo(v).slice(0, 300);
  });
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, LIMITE_TEXTO);
}

export const RODAPE_PROMO = '\n\nPara não receber mais ofertas por WhatsApp: {link_preferencias}';
