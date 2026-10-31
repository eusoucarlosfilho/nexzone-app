// ============================================================
// Campanhas do site (puro, testado em testes/campanhas-site.test.js)
//   - faixa: tarja fina no topo de todas as páginas (texto + botão + contagem até o fim)
//   - banner: bloco grande no topo da home (imagem para computador e celular, ou só texto)
//   - calendário de datas do varejo e do mundo gamer com sugestão pronta de campanha
// A Black Friday tem módulo próprio (Crescimento e Black) e tem prioridade sobre a faixa.
// ============================================================

export type Formato = 'faixa' | 'banner';
export type Campanha = {
  id?: number; formato: Formato; titulo: string; mensagem?: string | null; botao?: string | null; link?: string | null;
  imagem_url?: string | null; imagem_mobile_url?: string | null; tema: string; intencao?: string | null;
  inicio: string; fim: string; ativa: boolean; prioridade?: number;
};

/** Paletas prontas (fundo, texto, destaque do botão). */
export const TEMAS: Record<string, { rotulo: string; fundo: string; texto: string; botao: string; botaoTexto: string }> = {
  laranja: { rotulo: 'Comprei Barato (laranja)', fundo: '#FF6B00', texto: '#16162A', botao: '#16162A', botaoTexto: '#FFFFFF' },
  escuro: { rotulo: 'Escuro gamer', fundo: '#16162A', texto: '#FFFFFF', botao: '#FF6B00', botaoTexto: '#16162A' },
  natal: { rotulo: 'Natal (vermelho)', fundo: '#B3122E', texto: '#FFFFFF', botao: '#FFFFFF', botaoTexto: '#B3122E' },
  anonovo: { rotulo: 'Ano Novo (preto e dourado)', fundo: '#0D0D12', texto: '#F5D27A', botao: '#F5D27A', botaoTexto: '#0D0D12' },
  verao: { rotulo: 'Férias (azul)', fundo: '#0EA5E9', texto: '#FFFFFF', botao: '#16162A', botaoTexto: '#FFFFFF' },
  roxo: { rotulo: 'Neon roxo', fundo: '#5B21B6', texto: '#FFFFFF', botao: '#22D3EE', botaoTexto: '#16162A' },
  verde: { rotulo: 'Verde', fundo: '#0E9F6E', texto: '#FFFFFF', botao: '#16162A', botaoTexto: '#FFFFFF' },
  rosa: { rotulo: 'Rosa (Mães / Namorados)', fundo: '#DB2777', texto: '#FFFFFF', botao: '#FFFFFF', botaoTexto: '#DB2777' },
};
export const temaDe = (t: string | null | undefined) => TEMAS[String(t || '')] || TEMAS.laranja;

/** Link permitido: página do próprio site ("/produtos?q=…") ou endereço do nosso domínio. Nada de site externo. */
export function linkValido(l: string | null | undefined): string | null {
  const s = String(l || '').trim().replace(/\s+/g, '%20'); // "gift card" vira "gift%20card"
  if (!s) return null;
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s.slice(0, 500);
  const m = s.match(/^https:\/\/(www\.)?compreibarato\.com\.br(\/[^\s]*)?$/i);
  return m ? (m[2] || '/').slice(0, 500) : null;
}

const imagemValida = (u: unknown) => {
  const s = String(u || '').trim();
  return !s ? null : /^https:\/\/[a-z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/capas\/campanhas\/[A-Za-z0-9._\/-]+$/.test(s) ? s : undefined;
};

/** Confere o que o admin preencheu. */
export function validarCampanha(raw: any): { ok: true; c: Campanha } | { ok: false; erro: string } {
  const formato: Formato = raw?.formato === 'banner' ? 'banner' : raw?.formato === 'faixa' ? 'faixa' : (null as any);
  if (!formato) return { ok: false, erro: 'Escolha onde a campanha aparece (faixa ou banner).' };
  const limpa = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const titulo = limpa(raw.titulo, 90);
  if (titulo.length < 3) return { ok: false, erro: 'Escreva o título da campanha.' };
  const mensagem = limpa(raw.mensagem, 220) || null;
  const botao = limpa(raw.botao, 30) || null;
  const link = raw.link ? linkValido(raw.link) : null;
  if (raw.link && !link) return { ok: false, erro: 'O link precisa ser uma página do próprio site (ex.: /produtos?q=natal ou https://www.compreibarato.com.br/…).' };
  if (botao && !link) return { ok: false, erro: 'Com botão, informe para onde ele leva.' };
  const img = imagemValida(raw.imagem_url), imgM = imagemValida(raw.imagem_mobile_url);
  if (img === undefined || imgM === undefined) return { ok: false, erro: 'Envie a imagem pelo botão de upload.' };
  const inicio = Date.parse(raw.inicio), fim = Date.parse(raw.fim);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return { ok: false, erro: 'Informe o início e o fim.' };
  if (fim <= inicio) return { ok: false, erro: 'O fim precisa ser depois do início.' };
  if (fim - inicio > 120 * 86400000) return { ok: false, erro: 'Campanha de no máximo 120 dias.' };
  return {
    ok: true,
    c: {
      formato, titulo, mensagem, botao, link, imagem_url: img, imagem_mobile_url: imgM, tema: TEMAS[raw.tema] ? raw.tema : 'laranja',
      intencao: limpa(raw.intencao, 500) || null, inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString(),
      ativa: raw.ativa !== false, prioridade: Math.max(0, Math.min(100, Math.round(Number(raw.prioridade) || 0))),
    },
  };
}

export type Situacao = 'no_ar' | 'agendada' | 'encerrada' | 'pausada';
export function situacao(c: Pick<Campanha, 'ativa' | 'inicio' | 'fim'>, agora = Date.now()): Situacao {
  if (!c.ativa) return 'pausada';
  if (agora < Date.parse(c.inicio)) return 'agendada';
  if (agora > Date.parse(c.fim)) return 'encerrada';
  return 'no_ar';
}

/** A campanha que aparece agora em cada formato: maior prioridade; empate → a que termina antes. */
export function noAr(lista: Campanha[], formato: Formato, agora = Date.now()): Campanha | null {
  const v = lista.filter((c) => c.formato === formato && situacao(c, agora) === 'no_ar');
  v.sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0) || Date.parse(a.fim) - Date.parse(b.fim));
  return v[0] || null;
}

// ---------------- calendário de datas ----------------
/** Domingo de Páscoa (algoritmo de Meeus/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}
const dia = (ano: number, mes: number, d: number) => new Date(Date.UTC(ano, mes - 1, d, 12));
const somaDias = (dt: Date, n: number) => new Date(dt.getTime() + n * 86400000);
/** n-ésimo dia da semana do mês (0 = domingo). */
function enesimo(ano: number, mes: number, semana: number, n: number): Date {
  const primeiro = dia(ano, mes, 1);
  const delta = (semana - primeiro.getUTCDay() + 7) % 7;
  return somaDias(primeiro, delta + 7 * (n - 1));
}
/** Black Friday: sexta depois da 4ª quinta-feira de novembro. */
export const blackFriday = (ano: number) => somaDias(enesimo(ano, 11, 4, 4), 1);

export type DataSazonal = {
  id: string; nome: string; data: string; comeca: string; termina: string; publico: 'gamer' | 'varejo';
  sugestao: { formato: Formato; tema: string; titulo: string; mensagem: string; botao: string; link: string; intencao: string; textoImagem: string; ideiaImagem: string };
};

type Modelo = { id: string; nome: string; quando: (ano: number) => Date; antes: number; depois: number; publico: 'gamer' | 'varejo'; s: DataSazonal['sugestao'] };

const MODELOS: Modelo[] = [
  { id: 'ferias-jan', nome: 'Férias de janeiro', quando: (a) => dia(a, 1, 2), antes: 1, depois: 28, publico: 'gamer',
    s: { formato: 'banner', tema: 'verao', titulo: 'Férias Gamer: o mês todo para jogar', mensagem: 'Contas, moedas e gift cards para curtir as férias. Pix na hora e dinheiro protegido até a entrega.', botao: 'Ver ofertas', link: '/produtos', intencao: 'Aproveitar o tempo livre das férias para vender contas e moedas.', textoImagem: 'FÉRIAS GAMER | O MÊS TODO PARA JOGAR | CONTAS · MOEDAS · GIFT CARDS', ideiaImagem: 'personagem gamer de óculos escuros numa cadeira de praia com um controle na mão, céu azul e sol' } },
  { id: 'volta-aulas', nome: 'Volta às aulas', quando: (a) => dia(a, 2, 2), antes: 7, depois: 14, publico: 'varejo',
    s: { formato: 'faixa', tema: 'escuro', titulo: 'Volta às aulas: organize a rotina e ainda sobra tempo para jogar', mensagem: 'Planilhas, templates e ferramentas de estudo', botao: 'Ver produtos', link: '/produtos?q=planilha', intencao: 'Puxar as categorias de templates, planilhas e IA para estudantes.', textoImagem: 'VOLTA ÀS AULAS | ESTUDE MELHOR · JOGUE MAIS', ideiaImagem: 'mochila aberta com notebook, caderno e um controle de videogame' } },
  { id: 'carnaval', nome: 'Carnaval', quando: (a) => somaDias(pascoa(a), -47), antes: 5, depois: 1, publico: 'gamer',
    s: { formato: 'faixa', tema: 'roxo', titulo: 'Carnaval Gamer: feriadão para subir de nível', mensagem: 'Moedas, passes e contas para o feriado', botao: 'Aproveitar', link: '/jogos', intencao: 'Feriado longo = muita gente jogando. Puxar moedas e passes.', textoImagem: 'CARNAVAL GAMER | FERIADÃO PARA SUBIR DE NÍVEL', ideiaImagem: 'confetes e serpentinas neon caindo sobre um controle gamer, fundo roxo' } },
  { id: 'consumidor', nome: 'Dia do Consumidor', quando: (a) => dia(a, 3, 15), antes: 3, depois: 3, publico: 'varejo',
    s: { formato: 'banner', tema: 'laranja', titulo: 'Semana do Consumidor: preço baixo e compra protegida', mensagem: 'Seu dinheiro fica com a gente até a entrega. Se der errado, você recebe de volta.', botao: 'Ver ofertas', link: '/produtos', intencao: 'Reforçar a confiança (dinheiro protegido) numa data de varejo forte.', textoImagem: 'SEMANA DO CONSUMIDOR | COMPRA PROTEGIDA ATÉ A ENTREGA', ideiaImagem: 'escudo laranja brilhante protegendo um carrinho de compras com ícones de jogos' } },
  { id: 'pascoa', nome: 'Páscoa', quando: (a) => pascoa(a), antes: 6, depois: 1, publico: 'varejo',
    s: { formato: 'faixa', tema: 'laranja', titulo: 'Páscoa: troque o chocolate por um gift card', mensagem: 'Presente digital chega na hora', botao: 'Ver gift cards', link: '/produtos?q=gift%20card', intencao: 'Vender gift card como presente.', textoImagem: 'PÁSCOA | DÊ UM GIFT CARD DE PRESENTE', ideiaImagem: 'ovo de páscoa aberto com um gift card brilhando dentro' } },
  { id: 'maes', nome: 'Dia das Mães', quando: (a) => enesimo(a, 5, 0, 2), antes: 7, depois: 0, publico: 'varejo',
    s: { formato: 'faixa', tema: 'rosa', titulo: 'Dia das Mães: presente digital que chega na hora', mensagem: 'Gift cards de streaming, jogos e apps', botao: 'Ver presentes', link: '/produtos?q=gift%20card', intencao: 'Gift card como presente de última hora.', textoImagem: 'DIA DAS MÃES | PRESENTE DIGITAL NA HORA', ideiaImagem: 'caixa de presente rosa com laço e um cartão-presente digital saindo dela' } },
  { id: 'namorados', nome: 'Dia dos Namorados', quando: (a) => dia(a, 6, 12), antes: 7, depois: 0, publico: 'gamer',
    s: { formato: 'banner', tema: 'rosa', titulo: 'Namorados Gamer: presente para o player 2', mensagem: 'Skins, passes e gift cards para dar de presente. Entrega rápida e dinheiro protegido.', botao: 'Escolher presente', link: '/produtos?q=gift%20card', intencao: 'Presente gamer para o casal.', textoImagem: 'DIA DOS NAMORADOS | PRESENTE PARA O PLAYER 2', ideiaImagem: 'dois controles de videogame formando um coração, luz rosa neon' } },
  { id: 'ferias-jul', nome: 'Férias de julho', quando: (a) => dia(a, 7, 1), antes: 0, depois: 30, publico: 'gamer',
    s: { formato: 'banner', tema: 'verao', titulo: 'Férias de julho: hora de zerar a lista', mensagem: 'Contas, itens, moedas e serviços de boost. Tudo com dinheiro protegido até a entrega.', botao: 'Ver ofertas', link: '/jogos', intencao: 'Mês de muita gente jogando: puxar contas e boost.', textoImagem: 'FÉRIAS DE JULHO | HORA DE ZERAR A LISTA', ideiaImagem: 'quarto gamer com setup RGB e janela mostrando dia de sol' } },
  { id: 'pais', nome: 'Dia dos Pais', quando: (a) => enesimo(a, 8, 0, 2), antes: 7, depois: 0, publico: 'varejo',
    s: { formato: 'faixa', tema: 'escuro', titulo: 'Dia dos Pais: presente para o pai gamer', mensagem: 'Gift cards e jogos com entrega na hora', botao: 'Ver presentes', link: '/produtos?q=gift%20card', intencao: 'Gift card como presente.', textoImagem: 'DIA DOS PAIS | PRESENTE PARA O PAI GAMER', ideiaImagem: 'controle de videogame com uma gravata, fundo escuro com luz laranja' } },
  { id: 'gamer', nome: 'Dia do Gamer', quando: (a) => dia(a, 8, 29), antes: 3, depois: 1, publico: 'gamer',
    s: { formato: 'banner', tema: 'roxo', titulo: 'Dia do Gamer: a data é sua', mensagem: 'Ofertas em contas, skins, moedas e gift cards para comemorar o dia de quem joga.', botao: 'Ver ofertas', link: '/jogos', intencao: 'Data do nosso público: campanha de marca e de vendas.', textoImagem: 'DIA DO GAMER · 29 DE AGOSTO | A DATA É SUA', ideiaImagem: 'troféu gamer brilhando em cima de um teclado RGB, partículas neon' } },
  { id: 'cliente', nome: 'Dia do Cliente', quando: (a) => dia(a, 9, 15), antes: 2, depois: 1, publico: 'varejo',
    s: { formato: 'faixa', tema: 'laranja', titulo: 'Dia do Cliente: obrigado por comprar com a gente', mensagem: 'Vendedores com preço especial', botao: 'Ver ofertas', link: '/produtos', intencao: 'Relacionamento e recompra.', textoImagem: 'DIA DO CLIENTE | OBRIGADO POR JOGAR COM A GENTE', ideiaImagem: 'coração laranja formado por pixels, estilo jogo retrô' } },
  { id: 'criancas', nome: 'Dia das Crianças', quando: (a) => dia(a, 10, 12), antes: 10, depois: 0, publico: 'gamer',
    s: { formato: 'banner', tema: 'verde', titulo: 'Dia das Crianças: Robux, diamantes e gift cards', mensagem: 'O presente que eles querem, com entrega rápida e dinheiro protegido até a entrega.', botao: 'Ver presentes', link: '/jogos', intencao: 'Pais comprando moedas e gift cards de presente. Linguagem para o adulto que paga.', textoImagem: 'DIA DAS CRIANÇAS | O PRESENTE QUE ELES QUEREM', ideiaImagem: 'caixa de presente aberta com moedas douradas e diamantes azuis saindo, estilo cartoon 3D' } },
  { id: 'halloween', nome: 'Halloween', quando: (a) => dia(a, 10, 31), antes: 5, depois: 0, publico: 'gamer',
    s: { formato: 'faixa', tema: 'escuro', titulo: 'Halloween Gamer: skins e itens de terror', mensagem: 'Os eventos de Halloween dos jogos começaram', botao: 'Ver itens', link: '/produtos?q=skin', intencao: 'Eventos de Halloween dentro dos jogos.', textoImagem: 'HALLOWEEN GAMER | SKINS E ITENS DE TERROR', ideiaImagem: 'abóbora com olhos neon laranja ao lado de um controle, névoa roxa' } },
  { id: 'black', nome: 'Black Friday', quando: (a) => blackFriday(a), antes: 30, depois: 3, publico: 'gamer',
    s: { formato: 'faixa', tema: 'escuro', titulo: 'Use o módulo Black Friday', mensagem: 'A Black tem tema, contagem e inscrição de vendedores próprios', botao: 'Ver', link: '/black-friday', intencao: 'Configurar em Crescimento e Black (não criar aqui).', textoImagem: '', ideiaImagem: '' } },
  { id: 'natal', nome: 'Natal', quando: (a) => dia(a, 12, 25), antes: 15, depois: 0, publico: 'varejo',
    s: { formato: 'banner', tema: 'natal', titulo: 'Natal Gamer: o presente chega na hora', mensagem: 'Gift cards, moedas e jogos para dar de presente, sem frete e sem atraso. Dinheiro protegido até a entrega.', botao: 'Ver presentes', link: '/produtos?q=gift%20card', intencao: 'Presente digital de última hora (sem frete).', textoImagem: 'NATAL GAMER | O PRESENTE CHEGA NA HORA · SEM FRETE', ideiaImagem: 'árvore de Natal feita de controles e luzes RGB, presentes embaixo, fundo vermelho' } },
  { id: 'ano-novo', nome: 'Ano Novo', quando: (a) => dia(a, 12, 31), antes: 4, depois: 1, publico: 'gamer',
    s: { formato: 'faixa', tema: 'anonovo', titulo: 'Ano novo, conta nova: comece o ano no topo', mensagem: 'Contas e upgrades com desconto', botao: 'Ver ofertas', link: '/jogos', intencao: 'Virada de ano, metas: subir de nível.', textoImagem: 'ANO NOVO, CONTA NOVA | COMECE O ANO NO TOPO', ideiaImagem: 'fogos de artifício dourados formando o símbolo de play, fundo preto' } },
];

const iso = (d: Date) => d.toISOString();

/** Próximas datas (a partir de hoje), com o período sugerido e a campanha pronta. */
export function proximasDatas(agora = Date.now(), qtd = 6): DataSazonal[] {
  const ano = new Date(agora).getUTCFullYear();
  const todas: DataSazonal[] = [];
  for (const a of [ano, ano + 1]) {
    for (const m of MODELOS) {
      const d = m.quando(a);
      const comeca = somaDias(d, -m.antes), termina = somaDias(d, m.depois);
      todas.push({ id: `${m.id}-${a}`, nome: m.nome, data: iso(d), comeca: iso(new Date(Date.UTC(comeca.getUTCFullYear(), comeca.getUTCMonth(), comeca.getUTCDate(), 3))), termina: iso(new Date(Date.UTC(termina.getUTCFullYear(), termina.getUTCMonth(), termina.getUTCDate() + 1, 2, 59))), publico: m.publico, sugestao: m.s });
    }
  }
  return todas.filter((x) => Date.parse(x.termina) > agora).sort((x, y) => Date.parse(x.comeca) - Date.parse(y.comeca)).slice(0, qtd);
}

/** Prompt da imagem, com o texto exato que vai escrito na arte e o tamanho certo para cada lugar. */
export function promptDaImagem(s: DataSazonal['sugestao'], formato: 'computador' | 'celular'): string {
  const tam = formato === 'computador' ? 'horizontal 1920 x 600 px (proporção 16:5), texto concentrado no centro-esquerda para não ser cortado' : 'quadrada 1080 x 1080 px (proporção 1:1), texto grande no centro';
  const tema = temaDe(s.tema);
  const linhas = s.textoImagem.split('|').map((x) => x.trim()).filter(Boolean);
  return `Arte de banner para site de marketplace gamer, ${tam}. Cena: ${s.ideiaImagem}. Cores principais: fundo ${tema.fundo}, destaques ${tema.botao}. `
    + `Texto escrito na arte, exatamente assim: ${linhas.map((l, i) => `${i === 0 ? 'título grande' : 'linha menor'} "${l}"`).join('; ')}. `
    + 'Estilo moderno, alto contraste, letras grossas e legíveis. Sem logos de jogos ou de marcas, sem personagens de jogos conhecidos, sem números de telefone e sem endereços de site.';
}
