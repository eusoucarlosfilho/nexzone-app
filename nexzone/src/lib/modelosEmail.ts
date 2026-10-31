// ============================================================
// Modelos de e-mail do admin (puro, testado em testes/modelos-email.test.js).
// Todo botão "E-mail" do admin abre a Caixa de e-mail do site já com o assunto e a mensagem
// do tipo de ação (recuperar Pix, carrinho abandonado, boas-vindas do lojista…).
// Variáveis: {nome} {produto} {link} {loja} {atendente}
// ============================================================
export type IdModelo = 'pix_pendente' | 'carrinho_abandonado' | 'boas_vindas_vendedor' | 'lojista_sem_anuncio' | 'cliente' | 'generico';
export type Modelo = { id: IdModelo; rotulo: string; assunto: string; texto: string };

export const MODELOS: Record<IdModelo, Modelo> = {
  pix_pendente: {
    id: 'pix_pendente', rotulo: 'Pix gerado e não pago',
    assunto: 'Seu pedido de {produto} está te esperando',
    texto: 'Oi, {nome}! Tudo bem?\n\nVi que você gerou o Pix de "{produto}" no Comprei Barato, mas o pagamento ainda não caiu. Ficou alguma dúvida ou deu algum problema na hora de pagar?\n\nSe quiser finalizar, é só clicar aqui: {link}\n\nSeu dinheiro fica protegido pela plataforma até a entrega. Qualquer coisa, é só responder este e-mail.\n\nAbraço,\n{atendente}',
  },
  carrinho_abandonado: {
    id: 'carrinho_abandonado', rotulo: 'Saiu do checkout sem pagar',
    assunto: 'Ficou faltando pouco: {produto}',
    texto: 'Oi, {nome}! Tudo bem?\n\nVocê começou a compra de "{produto}" no Comprei Barato e não chegou a finalizar. Aconteceu alguma coisa? Se tiver dúvida sobre o produto ou sobre o pagamento, me responde aqui que eu te ajudo.\n\nPara continuar de onde parou: {link}\n\nO pagamento é pelo Pix e o seu dinheiro fica protegido até a entrega.\n\nAbraço,\n{atendente}',
  },
  boas_vindas_vendedor: {
    id: 'boas_vindas_vendedor', rotulo: 'Boas-vindas ao lojista',
    assunto: 'Bem-vindo ao Comprei Barato, {nome}!',
    texto: 'Oi, {nome}! Tudo bem?\n\nAqui é {atendente}, da equipe do Comprei Barato. Seja muito bem-vindo! Sua loja já está criada e pronta para receber os seus anúncios.\n\nPara começar a vender:\n1. Suba o seu primeiro anúncio (leva uns 2 minutos): https://www.compreibarato.com.br/vender/produtos/novo\n2. Capriche na capa e na descrição: diga exatamente o que o cliente recebe e como entrega.\n3. Responda rápido no chat do pedido: isso faz a sua loja subir na vitrine.\n\nO anúncio é grátis, você só paga a taxa quando vende, e o dinheiro do cliente fica protegido até a entrega.\n\nO que você vende hoje? Me responde aqui que eu te ajudo a montar o primeiro anúncio.\n\nAbraço,\n{atendente}',
  },
  lojista_sem_anuncio: {
    id: 'lojista_sem_anuncio', rotulo: 'Lojista ainda sem anúncio',
    assunto: '{nome}, falta só o primeiro anúncio',
    texto: 'Oi, {nome}! Tudo bem?\n\nVi que a sua loja {loja} já está criada no Comprei Barato, mas ainda não tem nenhum anúncio. Quer ajuda com o primeiro? Me diz o que você vende (e de qual jogo) que eu te passo um título e uma descrição que funcionam.\n\nPara subir agora: https://www.compreibarato.com.br/vender/produtos/novo\n\nAbraço,\n{atendente}',
  },
  cliente: {
    id: 'cliente', rotulo: 'Contato com cliente',
    assunto: 'Comprei Barato: sobre a sua conta',
    texto: 'Oi, {nome}! Tudo bem?\n\nAqui é {atendente}, da equipe do Comprei Barato.\n\n\n\nQualquer dúvida, é só responder este e-mail.\n\nAbraço,\n{atendente}',
  },
  generico: {
    id: 'generico', rotulo: 'Em branco',
    assunto: '', texto: 'Oi, {nome}! Tudo bem?\n\n\n\nAbraço,\n{atendente}',
  },
};

const primeiro = (s: unknown) => String(s ?? '').trim().split(/\s+/)[0] || '';

/** Monta assunto e texto do modelo trocando as variáveis (as que faltarem viram um texto neutro). */
export function montarEmail(id: IdModelo, v: { nome?: string | null; produto?: string | null; link?: string | null; loja?: string | null; atendente?: string | null }): { assunto: string; texto: string } {
  const m = MODELOS[id] || MODELOS.generico;
  const trocar = (t: string) => t
    .replace(/\{nome\}/g, primeiro(v.nome) || 'tudo bem')
    .replace(/\{produto\}/g, String(v.produto || 'o seu produto').slice(0, 120))
    .replace(/\{link\}/g, String(v.link || 'https://www.compreibarato.com.br'))
    .replace(/\{loja\}/g, String(v.loja || '').trim() ? `"${String(v.loja).trim()}"` : '')
    // sem atendente informado, o {atendente} fica para a Caixa de e-mail trocar pelo nome de quem está logado
    .replace(/\{atendente\}/g, v.atendente === undefined ? '{atendente}' : primeiro(v.atendente) || 'Equipe Comprei Barato')
    .replace(/ {2,}/g, ' ');
  return { assunto: trocar(m.assunto).replace(/^Oi, tudo bem!/, 'Oi!'), texto: trocar(m.texto).replace(/^Oi, tudo bem! Tudo bem\?/, 'Oi! Tudo bem?') };
}

export type PedidoEscrever = { para: string; assunto: string; texto: string; modelo?: IdModelo };

/** Endereço da janela da caixa já com o e-mail para escrever (usado fora do painel do admin). */
export function urlEscrever(p: PedidoEscrever): string {
  const q = new URLSearchParams({ para: p.para, assunto: p.assunto, texto: p.texto });
  return `/admin/email?${q.toString()}`;
}
