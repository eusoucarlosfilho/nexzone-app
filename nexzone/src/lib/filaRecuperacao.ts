// Fila de recuperação (puro, testado em testes/fila-recuperacao.test.js).
// Uma linha por PESSOA + PRODUTO, com tudo que já saiu para ela (automático e manual), para ninguém mandar em dobro.

export type Canal = 'whatsapp' | 'email' | 'copiar' | 'outro';
export type EventoHist = { quando: string; canal: Canal | 'auto'; tipo: 'auto' | 'manual'; rotulo: string; status?: 'enviado' | 'falhou' | 'adiado' | 'enviando'; por?: string | null };
export type Situacao = 'novo' | 'lembrado' | 'contatado' | 'desistiu';

export type PixPendente = { id: string; comprador: string | null; comprador_email: string | null; product_id: string; total: number; created_at: string; titulo: string; loja: string | null };
export type CarrinhoAberto = { id: number; product_id: string; user_id: string | null; email: string; nome: string | null; atualizado_em: string; titulo: string; loja: string | null; preco: number | null; lembrete_1h: string | null; lembrete_24h: string | null };
export type LogWhats = { evento: string; chave: string; status: string; created_at: string; enviado_em: string | null };
export type LembretePix = { order_id: string; etapa: string; enviado_em: string; canais: string[] | null };
export type ContatoManual = { chave: string; canal: Canal; por_nome: string | null; created_at: string };

export type ItemFila = {
  chave: string; tipo: 'pix' | 'carrinho'; nome: string | null; email: string | null; userId: string | null;
  whatsapp: string | null; avisos: boolean; productId: string; produto: string; loja: string | null; valor: number | null;
  desde: string; pedidos: string[]; carrinhos: number[]; historico: EventoHist[]; situacao: Situacao;
  ultimoManual: { quando: string; por: string | null; canal: Canal } | null;
};

export const chaveRecuperacao = (email: string | null | undefined, userId: string | null | undefined, productId: string) =>
  `${(String(email || '').trim().toLowerCase() || `u:${userId || '?'}`)}|${productId}`.slice(0, 200);

const ROTULO_WHATS: Record<string, string> = {
  pix_gerado: 'Pix na hora (WhatsApp)',
  pix_lembrete: '1º lembrete do Pix (WhatsApp)',
  pix_lembrete_24h: 'Lembrete de 24 h (WhatsApp)',
  carrinho_1h: '1º lembrete do carrinho (WhatsApp)',
  carrinho_24h: 'Lembrete de 24 h do carrinho (WhatsApp)',
};
const ROTULO_ETAPA: Record<string, string> = { '15min': '1º lembrete do Pix', '24h': 'Lembrete de 24 h', retro: 'Lembrete "ficou para trás"', imediato: 'Pix na hora' };
const ROTULO_CANAL: Record<Canal, string> = { whatsapp: 'WhatsApp manual', email: 'E-mail manual', copiar: 'Mensagem copiada', outro: 'Contato manual' };

/** O id (pedido ou carrinho) que vem depois dos dois pontos na chave do WhatsApp: "pix_lembrete_24h:<id>". */
export const idDaChave = (chave: string) => String(chave || '').split(':').slice(1).join(':');

/** Junta Pix pendentes e carrinhos numa fila por pessoa + produto, com o histórico de cada um. */
export function montarFila(p: {
  pix: PixPendente[]; carrinhos: CarrinhoAberto[]; logs: LogWhats[]; lembretes: LembretePix[]; manuais: ContatoManual[];
  desistiu: Set<string>; contatos: Record<string, { nome: string | null; whatsapp: string | null; avisos: boolean }>;
}): ItemFila[] {
  const fila = new Map<string, ItemFila>();
  const novo = (chave: string, base: Partial<ItemFila>): ItemFila => ({
    chave, tipo: 'pix', nome: null, email: null, userId: null, whatsapp: null, avisos: false, productId: '', produto: 'Produto', loja: null, valor: null,
    desde: new Date().toISOString(), pedidos: [], carrinhos: [], historico: [], situacao: 'novo', ultimoManual: null, ...base,
  });

  for (const o of p.pix) {
    const k = chaveRecuperacao(o.comprador_email, o.comprador, o.product_id);
    const it = fila.get(k) ?? novo(k, { tipo: 'pix', email: o.comprador_email, userId: o.comprador, productId: o.product_id, produto: o.titulo, loja: o.loja, valor: Number(o.total), desde: o.created_at });
    it.pedidos.push(o.id);
    if (o.created_at > it.desde) { it.desde = o.created_at; it.valor = Number(o.total); } // mostra o Pix mais recente
    fila.set(k, it);
  }
  for (const c of p.carrinhos) {
    const k = chaveRecuperacao(c.email, c.user_id, c.product_id);
    const it = fila.get(k) ?? novo(k, { tipo: 'carrinho', email: c.email, userId: c.user_id, nome: c.nome, productId: c.product_id, produto: c.titulo, loja: c.loja, valor: c.preco, desde: c.atualizado_em });
    it.carrinhos.push(c.id);
    if (!it.nome && c.nome) it.nome = c.nome;
    if (!it.userId && c.user_id) it.userId = c.user_id;
    fila.set(k, it);
    if (c.lembrete_1h) it.historico.push({ quando: c.lembrete_1h, canal: 'auto', tipo: 'auto', rotulo: '1º lembrete do carrinho' });
    if (c.lembrete_24h) it.historico.push({ quando: c.lembrete_24h, canal: 'auto', tipo: 'auto', rotulo: 'Lembrete de 24 h do carrinho' });
  }

  const porPedido = new Map<string, ItemFila>();
  const porCarrinho = new Map<string, ItemFila>();
  fila.forEach((it) => { it.pedidos.forEach((id) => porPedido.set(id, it)); it.carrinhos.forEach((id) => porCarrinho.set(String(id), it)); });

  for (const l of p.logs) {
    if (l.evento === 'pix_codigo') continue; // vai junto com o "Pix na hora"
    const id = idDaChave(l.chave);
    const it = l.evento.startsWith('carrinho') ? porCarrinho.get(id) : porPedido.get(id);
    if (!it) continue;
    const retro = l.chave.includes('_retro:');
    it.historico.push({ quando: l.enviado_em || l.created_at, canal: 'whatsapp', tipo: 'auto', rotulo: retro ? 'Lembrete "ficou para trás" (WhatsApp)' : (ROTULO_WHATS[l.evento] || l.evento), status: (['enviado', 'falhou', 'adiado', 'enviando'].includes(l.status) ? l.status : undefined) as any });
  }
  for (const r of p.lembretes) {
    const it = porPedido.get(r.order_id);
    if (!it || !(r.canais || []).includes('email')) continue;
    it.historico.push({ quando: r.enviado_em, canal: 'email', tipo: 'auto', rotulo: `${ROTULO_ETAPA[r.etapa] || 'Lembrete'} (e-mail)` });
  }
  for (const m of p.manuais) {
    const it = fila.get(m.chave);
    if (!it) continue;
    it.historico.push({ quando: m.created_at, canal: m.canal, tipo: 'manual', rotulo: ROTULO_CANAL[m.canal] || 'Contato manual', por: m.por_nome });
  }

  const lista = Array.from(fila.values());
  for (const it of lista) {
    const ct = it.userId ? p.contatos[it.userId] : undefined;
    if (ct) { it.nome = it.nome || ct.nome; it.whatsapp = ct.whatsapp; it.avisos = ct.avisos; }
    it.historico.sort((a, b) => (a.quando < b.quando ? -1 : 1));
    const manuais = it.historico.filter((h) => h.tipo === 'manual');
    const u = manuais[manuais.length - 1];
    it.ultimoManual = u ? { quando: u.quando, por: u.por ?? null, canal: u.canal as Canal } : null;
    it.situacao = p.desistiu.has(it.chave) ? 'desistiu' : manuais.length ? 'contatado' : it.historico.length ? 'lembrado' : 'novo';
  }
  const ordem: Record<Situacao, number> = { novo: 0, lembrado: 1, contatado: 2, desistiu: 3 };
  return lista.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (a.desde < b.desde ? 1 : -1));
}

/** Contato manual recente? (para avisar antes de mandar de novo) */
export function contatoRecente(it: Pick<ItemFila, 'ultimoManual'>, horas = 24, agora = Date.now()): boolean {
  if (!it.ultimoManual) return false;
  return agora - new Date(it.ultimoManual.quando).getTime() < horas * 3600000;
}

export function haQuantoCurto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  const d = Math.round(min / 1440);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

export const CANAIS_VALIDOS: Canal[] = ['whatsapp', 'email', 'copiar', 'outro'];
