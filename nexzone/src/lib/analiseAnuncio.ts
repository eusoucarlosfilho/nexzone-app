// ============================================================
// Análise automática do anúncio (puro, testado em testes/analise-anuncio.test.js)
// Procura sinais de quem tenta fazer o que a plataforma não permite:
//   levar o cliente para outro site, contato fora da plataforma, pagamento por fora,
//   produto proibido (hack, conta roubada, assinatura compartilhada), preço fora da curva…
// Lê título, descrição, conteúdo de entrega e o TEXTO DAS IMAGENS (lido por OCR no servidor).
// Não recusa nada sozinho: dá uma nota de risco e mostra ao revisor o que achou e onde.
// ============================================================

export type Onde = 'titulo' | 'descricao' | 'entrega' | 'imagem' | 'preco' | 'vendedor';
export type Sinal = { tipo: TipoSinal; onde: Onde; trecho: string; peso: number };
export type TipoSinal = 'link_externo' | 'contato_externo' | 'pagamento_fora' | 'outro_site' | 'proibido' | 'compartilhada' | 'key_aleatoria' | 'promessa' | 'preco_baixo' | 'descricao_curta' | 'vendedor_novo' | 'vendedor_reincidente' | 'vendedor_confiavel';
export type Nivel = 'verde' | 'amarelo' | 'vermelho';
export type Analise = { score: number; nivel: Nivel; sinais: Sinal[]; ocr: 'ok' | 'sem_imagem' | 'falhou' | 'pulado'; versao: number };
export const VERSAO_ANALISE = 1;

/** O que cada sinal significa para quem revisa (e qual item do checklist de correção ele sugere). */
export const INFO_SINAL: Record<TipoSinal, { rotulo: string; dica: string; item: string | null }> = {
  link_externo: { rotulo: 'Link de outro site', dica: 'Pode estar levando o cliente para comprar fora da plataforma.', item: 'contato_externo' },
  contato_externo: { rotulo: 'Contato fora da plataforma', dica: 'WhatsApp, telefone, @ ou grupo: a conversa tem que ser pelo chat do pedido.', item: 'contato_externo' },
  pagamento_fora: { rotulo: 'Pagamento por fora', dica: 'Pede Pix direto ou fala em pagar fora: é o caminho do golpe e da perda da taxa.', item: 'contato_externo' },
  outro_site: { rotulo: 'Nome de outro marketplace', dica: 'Cita outro site de venda (pode ser anúncio copiado ou desvio de cliente).', item: 'contato_externo' },
  proibido: { rotulo: 'Possível produto proibido', dica: 'Hack, cheat, painel, conta roubada, "método" ou item gerado: não pode ser vendido.', item: 'proibido' },
  compartilhada: { rotulo: 'Conta ou assinatura compartilhada', dica: 'Tela/perfil de streaming ou assinatura revendida costuma cair e virar reembolso.', item: 'proibido' },
  key_aleatoria: { rotulo: 'Key aleatória', dica: 'O comprador não sabe o que recebe: confira se o anúncio deixa isso claro.', item: 'titulo' },
  promessa: { rotulo: 'Promessa irreal', dica: 'Garantia vitalícia, "nunca cai", ganho garantido…', item: 'promessa' },
  preco_baixo: { rotulo: 'Preço muito abaixo dos outros', dica: 'Bem abaixo de anúncios parecidos: pode ser isca ou conta problemática.', item: 'preco' },
  descricao_curta: { rotulo: 'Descrição quase vazia', dica: 'Sem dizer o que o cliente recebe, a chance de reclamação é alta.', item: 'descricao' },
  vendedor_novo: { rotulo: 'Vendedor novo', dica: 'Loja criada há poucos dias, sem anúncio aprovado antes.', item: null },
  vendedor_reincidente: { rotulo: 'Já teve anúncio corrigido ou reprovado', dica: 'Este vendedor já recebeu pedido de correção, reprovação ou pausa antes.', item: null },
  vendedor_confiavel: { rotulo: 'Vendedor com histórico bom', dica: 'Loja verificada e com vendas: reduz o risco.', item: null },
};

/** minúsculas, sem acento, sem caracteres invisíveis; "ponto com" → ".com" (truque comum para fugir do filtro). */
export function normalizar(s: string): string {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[​-‏⁠﻿]/g, '').toLowerCase()
    .replace(/\s*[\(\[]?\s*ponto\s*[\)\]]?\s*(com|net|gg|br|io|store|shop|site|online|app|me)\b/g, '.$1')
    .replace(/\s*\[?\(?dot\)?\]?\s*(com|net|gg|io)\b/g, '.$1')
    .replace(/[ \t]+/g, ' ');
}

const NOSSO = /(^|[^a-z0-9])(www\.)?compreibarato\.com(\.br)?/;
// sites oficiais de jogos e lojas onde se RESGATA gift card/key: citar é normal ("resgate em roblox.com/redeem")
const OFICIAIS = /^(www\.)?([a-z0-9-]+\.)*(roblox|playstation|xbox|microsoft|steampowered|steamcommunity|epicgames|nintendo|riotgames|leagueoflegends|playvalorant|garena|ff\.garena|ea|origin|ubisoft|blizzard|battle|minecraft|mojang|google|apple|netflix|spotify|razer|rockstargames|hoyoverse|mihoyo|supercell|activision|callofduty)\.(com|com\.br|net|gg)(\/|$)/;
// domínio: algo.tld (tld comum) — sem pegar "R$ 4.99" nem "v1.2"
const DOMINIO = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]{1,40}\.(?:com\.br|net\.br|com|net|org|gg|io|store|shop|site|online|xyz|me|link|app|lol|top|vip|club|biz|info|pro|tv|live)(?:\/[^\s]*)?)\b/g;
const URL_CURTA = /\b(bit\.ly|tinyurl|linktr\.ee|t\.me|wa\.me|chat\.whatsapp|discord\.gg|discord\.com\/invite|encurtador|cutt\.ly|is\.gd|beacons\.ai)\b/;

type Regra = { tipo: TipoSinal; re: RegExp; peso: number };
const REGRAS: Regra[] = [
  { tipo: 'contato_externo', re: /\b(whats\s?app|whats|wpp|zap\s?zap|zap|telegram(?! premium)|telegran|discord(?! nitro)|insta(gram)?|me chama|chama no (pv|privado|direct|dm)|link na bio|grupo vip|meu grupo|meu canal|contato direto|fale comigo (no|pelo)|chamar? (no|pelo) (zap|whats|pv|privado|insta|discord|telegram))\b/, peso: 35 },
  { tipo: 'contato_externo', re: /(\(?\b\d{2}\)?\s?9\s?\d{4}[\s.-]?\d{4}\b)|(\+?55\s?\(?\d{2}\)?\s?9?\d{4}[\s.-]?\d{4})/, peso: 40 },
  { tipo: 'contato_externo', re: /(^|\s)@[a-z0-9_.]{3,30}\b/, peso: 25 },
  { tipo: 'pagamento_fora', re: /\b(pix direto|direto no pix|paga(r|mento)? por fora|fora da plataforma|fora do site|sem taxa(s)? da plataforma|chave pix|meu pix|transferencia direta|deposito direto|picpay|paypal|mercado pago direto)\b/, peso: 45 },
  { tipo: 'outro_site', re: /\b(gg\s?max|ggmax|eldorado\.gg|eldorado gg|game\s?market|gamemarket|mercado\s?livre|olx|shopee|g2g|playerauctions|z2u|kinguin|eneba|plati\.market|g2a|lzt|lolzteam|epicnpc|playhub|loja virtual propria)\b/, peso: 30 },
  { tipo: 'proibido', re: /\b(hack|hacker|cheat|aimbot|wall\s?hack|mod\s?menu|injetor|injector|regedit|painel (ff|free fire|de ff)|script (ff|free fire|roblox)|exploit|executor|bypass|crack(eado)?|conta (roubada|hackeada|puxada)|carding|cc gerada|gerador de (robux|diamantes?|skins?|v-?bucks)|(robux|diamantes?|v-?bucks|skins?) (gratis|de graca|infinit[oa]s?)|metodo (secreto|infalivel|para)|dupe|duplicacao|bug de (diamante|robux|dinheiro))\b/, peso: 45 },
  { tipo: 'compartilhada', re: /\b(conta compartilhada|compartilhad[ao]|tela (de|da)? ?(netflix|disney|hbo|max|prime|star)|perfil (de|da)? ?(netflix|disney|hbo|max|prime|spotify|youtube)|(netflix|disney\+?|hbo max|prime video|spotify|youtube premium|crunchyroll|chatgpt plus|canva pro) (vitalicio|vitalicia|1 ano|anual|mensal|compartilhad[ao])|familia (spotify|youtube))\b/, peso: 25 },
  { tipo: 'key_aleatoria', re: /\b(key aleatoria|keys aleatorias|random key|steam aleatoria|chave aleatoria|jogo aleatorio|caixa misteriosa)\b/, peso: 15 },
  { tipo: 'promessa', re: /\b(nunca cai|nao cai nunca|100% garantido|garantia vitalicia|vitalicio garantido|ganhe dinheiro|renda garantida|lucro garantido|sem risco de ban|anti ?ban garantido)\b/, peso: 15 },
];

/** Procura os sinais num texto. `onde` diz de onde veio (o texto da imagem pesa mais: é onde o desvio costuma se esconder). */
export function sinaisDoTexto(texto: string, onde: Onde): Sinal[] {
  const t = normalizar(texto);
  if (!t.trim()) return [];
  const extra = onde === 'imagem' ? 10 : onde === 'entrega' ? 5 : 0;
  const out: Sinal[] = [];
  const trechoDe = (i: number, len: number) => t.slice(Math.max(0, i - 25), Math.min(t.length, i + len + 25)).replace(/\s+/g, ' ').trim();
  // links (menos os nossos)
  const vistos = new Set<string>();
  for (const m of Array.from(t.matchAll(DOMINIO))) {
    const d = m[1].replace(/^https?:\/\//, '');
    if (NOSSO.test(' ' + d) || OFICIAIS.test(d) || vistos.has(d)) continue;
    // e-mail (a@b.com) conta como contato, não como site
    const antes = t[(m.index ?? 0) - 1];
    if (antes === '@') continue;
    vistos.add(d);
    out.push({ tipo: 'link_externo', onde, trecho: trechoDe(m.index ?? 0, m[0].length), peso: 40 + extra });
  }
  const curta = t.match(URL_CURTA);
  if (curta) out.push({ tipo: 'link_externo', onde, trecho: trechoDe(curta.index ?? 0, curta[0].length), peso: 45 + extra });
  const email = t.match(/\b[a-z0-9._%+-]{2,}@[a-z0-9.-]+\.[a-z]{2,}\b/);
  if (email && !NOSSO.test(' ' + email[0].split('@')[1])) out.push({ tipo: 'contato_externo', onde, trecho: trechoDe(email.index ?? 0, email[0].length), peso: 30 + extra });
  for (const r of REGRAS) {
    // e-mail já contado: não conta o "@usuario" de novo
    if (r.tipo === 'contato_externo' && r.re.source.includes('(^|\\s)@') && email) continue;
    const m = t.match(r.re);
    if (m) out.push({ tipo: r.tipo, onde, trecho: trechoDe(m.index ?? 0, m[0].length), peso: r.peso + (['link_externo', 'contato_externo', 'pagamento_fora', 'outro_site'].includes(r.tipo) ? extra : 0) });
  }
  return out;
}

export type Contexto = {
  preco: number;
  medianaParecidos?: number | null;   // mediana do preço de anúncios ativos do mesmo jogo + tipo
  qtdParecidos?: number;
  diasDeLoja?: number | null;
  aprovadosAntes?: number;            // anúncios desta loja já aprovados
  problemasAntes?: number;            // correções / reprovações / pausas da equipe
  lojaVerificada?: boolean;
  vendasDaLoja?: number;
};

/** Junta tudo numa nota de 0 a 100 e no nível (verde < 30 ≤ amarelo < 60 ≤ vermelho). */
export function avaliar(p: { titulo?: string | null; descricao?: string | null; entrega?: string | null; textoImagens?: string[] }, ctx: Contexto, ocr: Analise['ocr'] = 'pulado'): Analise {
  let sinais: Sinal[] = [
    ...sinaisDoTexto(p.titulo || '', 'titulo'),
    ...sinaisDoTexto(p.descricao || '', 'descricao'),
    ...sinaisDoTexto(p.entrega || '', 'entrega'),
    ...(p.textoImagens || []).flatMap((t) => sinaisDoTexto(t, 'imagem')),
  ];
  // o mesmo tipo de sinal no mesmo lugar conta uma vez só (o mais forte)
  const melhor = new Map<string, Sinal>();
  for (const s of sinais) { const k = `${s.tipo}:${s.onde}`; const a = melhor.get(k); if (!a || s.peso > a.peso) melhor.set(k, s); }
  sinais = Array.from(melhor.values());

  if ((p.descricao || '').replace(/\s+/g, ' ').trim().length < 30) sinais.push({ tipo: 'descricao_curta', onde: 'descricao', trecho: '', peso: 10 });
  if (ctx.medianaParecidos && (ctx.qtdParecidos || 0) >= 5 && ctx.preco > 0 && ctx.preco < ctx.medianaParecidos * 0.25) {
    sinais.push({ tipo: 'preco_baixo', onde: 'preco', trecho: `R$ ${ctx.preco.toFixed(2).replace('.', ',')} (parecidos: ~R$ ${ctx.medianaParecidos.toFixed(2).replace('.', ',')})`, peso: 20 });
  }
  if ((ctx.aprovadosAntes || 0) === 0 && (ctx.diasDeLoja == null || ctx.diasDeLoja < 7)) sinais.push({ tipo: 'vendedor_novo', onde: 'vendedor', trecho: '', peso: 10 });
  if ((ctx.problemasAntes || 0) > 0) sinais.push({ tipo: 'vendedor_reincidente', onde: 'vendedor', trecho: `${ctx.problemasAntes} vez(es)`, peso: Math.min(30, 15 * (ctx.problemasAntes || 0)) });
  if (ctx.lojaVerificada && (ctx.vendasDaLoja || 0) >= 3 && !(ctx.problemasAntes || 0)) sinais.push({ tipo: 'vendedor_confiavel', onde: 'vendedor', trecho: '', peso: -15 });

  const score = Math.max(0, Math.min(100, sinais.reduce((s, x) => s + x.peso, 0)));
  // um sinal grave sozinho já deixa no mínimo amarelo, mesmo com vendedor confiável
  const grave = sinais.some((s) => ['link_externo', 'contato_externo', 'pagamento_fora', 'proibido'].includes(s.tipo));
  const nivel: Nivel = score >= 60 ? 'vermelho' : score >= 30 || grave ? 'amarelo' : 'verde';
  sinais.sort((a, b) => b.peso - a.peso);
  return { score, nivel, sinais, ocr, versao: VERSAO_ANALISE };
}

/** Entra no ar sozinho? Só verde, com a leitura da imagem feita (ou sem imagem) e sem correção pendente da equipe. */
export function podeAprovarSozinho(a: Analise, opts: { ligado: boolean; correcaoPendente: boolean }): boolean {
  return opts.ligado && !opts.correcaoPendente && a.nivel === 'verde' && (a.ocr === 'ok' || a.ocr === 'sem_imagem');
}

export function mediana(nums: number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export const ROTULO_ONDE: Record<Onde, string> = { titulo: 'no título', descricao: 'na descrição', entrega: 'na mensagem de entrega', imagem: 'na imagem', preco: 'no preço', vendedor: 'no vendedor' };
export const ROTULO_NIVEL: Record<Nivel, string> = { verde: 'Baixo risco', amarelo: 'Atenção', vermelho: 'Alto risco' };
