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
  { chave: 'compra_aprovada', rotulo: 'Pagamento confirmado (com o link do chat com o vendedor)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Olá, {nome}! Pagamento confirmado ✅ Obrigado pela compra!\n{produto} ({valor}) | Pedido #{pedido}\n\nPara receber o seu produto, fale com o vendedor no chat do pedido:\n{link}\n\nOs detalhes também foram enviados para o seu e-mail.' },
  { chave: 'pix_gerado', rotulo: 'Pix gerado: 1ª mensagem, imagem do QR Code com este texto (na hora)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Oi, {nome}! Seu pedido de {produto} ({valor}) está reservado. ✅\nPedido #{pedido}\n\nPara pagar, abra o app do seu banco, escolha Pix e leia este QR Code. A confirmação é automática.' },
  { chave: 'pix_codigo_aviso', rotulo: 'Pix: 2ª mensagem, aviso de que o código copia e cola vem logo abaixo', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido'],
    padrao: 'Prefere copiar e colar? 👇\nA próxima mensagem é o código Pix copia e cola. Copie a mensagem inteira e cole no app do seu banco, em Pix › Pix Copia e Cola.' },
  { chave: 'pix_codigo', rotulo: 'Pix: 3ª mensagem, só o código copia e cola', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['pix'],
    padrao: '{pix}' },
  { chave: 'aviso_numero', rotulo: 'Aviso: este número é só de notificações (última mensagem do Pix e da confirmação)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'pedido', 'link'],
    padrao: 'ℹ️ Este número envia apenas notificações automáticas do Comprei Barato e não lê respostas.\nPara falar com o vendedor ou com o nosso atendimento, use o site: {link}' },
  { chave: 'pix_lembrete', rotulo: 'Lembrete de Pix não pago: reenvia o QR Code com este texto e o código (tempo em Pedidos › Recuperação)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Oi, {nome}! Seu pedido de {produto} ({valor}) continua reservado, só falta o Pix. ⏳\nPedido #{pedido}\n\nÉ só ler este QR Code no app do seu banco ou usar o código copia e cola logo abaixo. Assim que você pagar, a confirmação é automática.' },
  { chave: 'pix_lembrete_24h', rotulo: 'Lembrete de compra não concluída (24 h)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'valor', 'pedido', 'link'],
    padrao: 'Oi, {nome}! Você ainda quer {produto}? Gere um novo Pix em menos de 1 minuto e receba o acesso na hora: {link}' },
  { chave: 'carrinho_1h', rotulo: 'Carrinho abandonado (1º lembrete)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'cupom', 'link'],
    padrao: 'Oi, {nome}! Você deixou {produto} no carrinho. 🛒\nTermine em menos de 1 minuto: {link}' },
  { chave: 'carrinho_24h', rotulo: 'Carrinho abandonado (24 h)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'cupom', 'link'],
    padrao: 'Oi, {nome}! Ainda pensando em {produto}? Seu acesso sai na hora depois do pagamento: {link}' },
  { chave: 'pedir_avaliacao', rotulo: 'Pedido de avaliação (1 a 3 dias depois da entrega)', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'pedido', 'link'],
    padrao: 'Oi, {nome}! Deu tudo certo com {produto}? ⭐\nSua avaliação leva 1 minuto e ajuda outras pessoas a comprar com segurança: {link}\n\nSe algo não saiu como esperado, fale com o vendedor no mesmo link.' },
  { chave: 'pedido_entregue', rotulo: 'Pedido marcado como entregue pelo vendedor', para: 'comprador', grupo: 'Compras e vendas', variaveis: ['nome', 'produto', 'pedido', 'link'],
    padrao: 'Oi, {nome}! O vendedor marcou seu pedido de {produto} como entregue. 📦\nConfira aqui: {link}\n\nNão recebeu ou algo não funciona? Avise no chat do pedido, no mesmo link.' },
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
    return v === null || v === undefined ? '' : textoLimpo(v).slice(0, k === 'pix' ? 600 : 300);
  });
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, LIMITE_TEXTO);
}

export const RODAPE_PROMO = '\n\nPara não receber mais ofertas por WhatsApp: {link_preferencias}';

/** Chave de cada mensagem de uma sequência: "pix_gerado:<pedido>" → "pix_gerado.1:<pedido>".
 *  O id continua depois do 1º ":" (é assim que a fila de recuperação acha o pedido). */
export const chavePasso = (base: string, i: number) => { const [ini, ...resto] = base.split(':'); return `${ini}.${i + 1}:${resto.join(':')}`.slice(0, 200); };
