// ============================================================
// Recrutamento de produtores (/produtores) — regras puras (sem rede).
// Usado pela página, pela API e pelos testes.
// ============================================================

// Recrutamento de LOJISTAS do marketplace gamer (contas, itens, moedas, gift cards e serviços)
// e de quem vende produtos digitais. A taxa exibida é a do plano mais barato (Básico).
export const TAXA_BASE = 5;               // % por venda no plano Básico ("a partir de")

export const TIPOS = [
  { id: 'contas', rotulo: 'Contas' },
  { id: 'itens', rotulo: 'Itens, skins e moedas' },
  { id: 'giftcards', rotulo: 'Gift cards e keys' },
  { id: 'servicos', rotulo: 'Serviços (boost, coach)' },
  { id: 'recargas', rotulo: 'Recargas' },
  { id: 'digitais', rotulo: 'Produtos digitais (guias, cursos, softwares)' },
  { id: 'outro', rotulo: 'Outro' },
] as const;

export const PLATAFORMAS = ['GGMax', 'Desapego Games', 'DFG', 'GameMarket', 'Mercado Livre', 'Eldorado / G2G', 'Instagram / WhatsApp', 'Discord', 'Loja própria', 'Outra'] as const;

export const FATURAMENTO = ['Ainda não vendi', 'Até R$ 1 mil/mês', 'R$ 1 mil a R$ 5 mil/mês', 'R$ 5 mil a R$ 20 mil/mês', 'R$ 20 mil a R$ 100 mil/mês', 'Mais de R$ 100 mil/mês'] as const;

/** "Nicho" no formulário = jogo principal (a coluna continua se chamando nicho). */
export const NICHOS = ['Free Fire', 'Roblox / Blox Fruits', 'Valorant', 'League of Legends', 'CS2 / Steam', 'Fortnite', 'GTA', 'Minecraft', 'Genshin / Honkai', 'Clash / Brawl Stars', 'EA FC / eFootball', 'Tibia / MMORPG', 'PUBG / COD Mobile', 'Pokémon', 'Vários jogos', 'Produtos digitais (não jogos)', 'Outro'] as const;

export const STATUS = [
  { id: 'novo', rotulo: 'Novo', cor: '#FF7A14' },
  { id: 'conversando', rotulo: 'Conversando', cor: '#4C8DFF' },
  { id: 'cadastrou', rotulo: 'Cadastrou', cor: '#9B6BFF' },
  { id: 'vendendo', rotulo: 'Vendendo', cor: '#20C98A' },
  { id: 'descartado', rotulo: 'Descartado', cor: '#8A8AA0' },
] as const;
export type StatusInteressado = typeof STATUS[number]['id'];

const limpar = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** WhatsApp brasileiro só com dígitos, com 55 na frente. Aceita (11) 98888-7777, +55 11 9..., etc. */
export function normalizarWhatsapp(v: unknown): string | null {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11 && d[2] !== '9') return null;
  return '55' + d;
}

export const formatarWhatsapp = (d: string) => {
  const n = d.startsWith('55') ? d.slice(2) : d;
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : d;
};

export function normalizarInstagram(v: unknown): string | null {
  let s = String(v ?? '').trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) return null;
  return s.toLowerCase();
}

export function emailValido(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  return /^[^\s@]{1,64}@[^\s@]{1,120}\.[a-z]{2,}$/.test(s) ? s.slice(0, 160) : null;
}

export function linkValido(v: unknown): string | null {
  let s = String(v ?? '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString().slice(0, 300);
  } catch { return null; }
}

export type DadosEtapa1 = { nome: string; whatsapp: string; email: string | null; instagram: string | null };
export type DadosEtapa2 = { nicho: string | null; tipos: string[]; ja_vende: 'sim' | 'comecando' | 'nao' | null; plataformas: string[]; faturamento: string | null; link_produto: string | null; mensagem: string | null };

export type Validacao<T> = { ok: true; dados: T } | { ok: false; campo: string; erro: string };

export function validarEtapa1(b: any): Validacao<DadosEtapa1> {
  const nome = limpar(b?.nome, 120);
  if (nome.length < 2) return { ok: false, campo: 'nome', erro: 'Diga seu nome.' };
  const whatsapp = normalizarWhatsapp(b?.whatsapp);
  if (!whatsapp) return { ok: false, campo: 'whatsapp', erro: 'WhatsApp inválido. Use DDD + número.' };
  const emailBruto = String(b?.email ?? '').trim();
  const email = emailValido(emailBruto);
  if (emailBruto && !email) return { ok: false, campo: 'email', erro: 'E-mail inválido.' };
  const igBruto = String(b?.instagram ?? '').trim();
  const instagram = normalizarInstagram(igBruto);
  if (igBruto && !instagram) return { ok: false, campo: 'instagram', erro: 'Instagram inválido. Ex.: @seuperfil' };
  return { ok: true, dados: { nome, whatsapp, email, instagram } };
}

export function validarEtapa2(b: any): Validacao<DadosEtapa2> {
  const nicho = (NICHOS as readonly string[]).includes(b?.nicho) ? String(b.nicho) : null;
  if (!nicho) return { ok: false, campo: 'nicho', erro: 'Escolha o jogo principal.' };
  const ids = TIPOS.map((t) => t.id as string);
  const tipos = Array.isArray(b?.tipos) ? Array.from(new Set(b.tipos.filter((t: any) => ids.includes(t)))) as string[] : [];
  if (!tipos.length) return { ok: false, campo: 'tipos', erro: 'Marque o que você vende (ou quer vender).' };
  const ja_vende = ['sim', 'comecando', 'nao'].includes(b?.ja_vende) ? b.ja_vende : null;
  if (!ja_vende) return { ok: false, campo: 'ja_vende', erro: 'Conta pra gente se você já vende.' };
  const plataformas = ja_vende === 'nao' ? [] : Array.isArray(b?.plataformas) ? Array.from(new Set(b.plataformas.filter((p: any) => (PLATAFORMAS as readonly string[]).includes(p)))).slice(0, 8) as string[] : [];
  const faturamento = (FATURAMENTO as readonly string[]).includes(b?.faturamento) ? String(b.faturamento) : null;
  const linkBruto = String(b?.link_produto ?? '').trim();
  const link_produto = linkValido(linkBruto);
  if (linkBruto && !link_produto) return { ok: false, campo: 'link_produto', erro: 'Link inválido.' };
  const mensagem = limpar(b?.mensagem, 1000) || null;
  return { ok: true, dados: { nicho, tipos, ja_vende, plataformas, faturamento, link_produto, mensagem } };
}

/** Origem do anúncio: só chaves conhecidas e texto curto. */
export function limparOrigem(o: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!o || typeof o !== 'object') return out;
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'entrada', 'fbclid']) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, k === 'fbclid' ? 255 : 160);
  }
  return out;
}

/** Link do WhatsApp com mensagem pronta (admin → produtor, ou produtor → equipe). */
export function linkWhatsapp(numero: string, texto: string) {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
}

export function mensagemParaProdutor(nome: string, nicho?: string | null) {
  const primeiro = nome.split(' ')[0] || nome;
  return `Oi, ${primeiro}! Aqui é do Comprei Barato. Vi que você se cadastrou para vender${nicho ? ` (${nicho})` : ''} e quero te mostrar como funciona: anúncio grátis, taxa a partir de ${TAXA_BASE}% e o dinheiro do cliente protegido até a entrega. Posso te explicar rapidinho por aqui?`;
}

export function mensagemDoProdutor(nome: string) {
  const primeiro = nome.split(' ')[0] || nome;
  return `Oi! Sou ${primeiro}, acabei de me cadastrar para vender no Comprei Barato e quero saber mais.`;
}

/** Simulador da página: quanto o lojista economiza por mês com a taxa do plano Básico. */
export function economiaMensal(faturamentoMes: number, taxaAtualPct: number, fixoPorVenda: number, vendasMes: number) {
  const f = Math.max(0, Number(faturamentoMes) || 0);
  const atual = f * (Math.max(0, Number(taxaAtualPct) || 0) / 100) + Math.max(0, Number(fixoPorVenda) || 0) * Math.max(0, Math.round(Number(vendasMes) || 0));
  const nossa = f * (TAXA_BASE / 100);
  return { atual: Math.round(atual * 100) / 100, nossa: Math.round(nossa * 100) / 100, economia: Math.round(Math.max(0, atual - nossa) * 100) / 100 };
}
