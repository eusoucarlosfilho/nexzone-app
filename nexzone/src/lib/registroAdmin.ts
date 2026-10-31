// ============================================================
// Registro do admin ("quem fez o quê") + sequência de mensagens para lojista novo.
// Regras puras (sem rede): usadas pelas telas, pelas APIs e pelos testes.
// ============================================================

export type GrupoAcao = 'aprovacao' | 'mensagens' | 'lojistas' | 'usuarios' | 'financeiro' | 'config';

export const GRUPOS: { id: GrupoAcao; rotulo: string }[] = [
  { id: 'aprovacao', rotulo: 'Aprovações' },
  { id: 'mensagens', rotulo: 'Mensagens' },
  { id: 'lojistas', rotulo: 'Novos lojistas' },
  { id: 'usuarios', rotulo: 'Usuários' },
  { id: 'financeiro', rotulo: 'Pedidos e dinheiro' },
  { id: 'config', rotulo: 'Configurações' },
];

/** Cada ação registrada: em que grupo entra e como aparece na frase ("Carlos aprovou o anúncio X"). */
export const ACOES: Record<string, { grupo: GrupoAcao; verbo: string }> = {
  produto_aprovado: { grupo: 'aprovacao', verbo: 'aprovou o anúncio' },
  produto_reprovado: { grupo: 'aprovacao', verbo: 'reprovou o anúncio' },
  produto_moderado: { grupo: 'aprovacao', verbo: 'moderou o anúncio' },
  produto_destaque: { grupo: 'aprovacao', verbo: 'mudou o destaque do anúncio' },
  produto_conferido: { grupo: 'aprovacao', verbo: 'conferiu o anúncio que entrou no ar sozinho' },
  aprovacao_automatica_ligada: { grupo: 'config', verbo: 'ligou a aprovação automática de anúncios' },
  aprovacao_automatica_desligada: { grupo: 'config', verbo: 'desligou a aprovação automática de anúncios' },
  verificacao_aprovada: { grupo: 'aprovacao', verbo: 'aprovou a verificação de' },
  verificacao_reprovada: { grupo: 'aprovacao', verbo: 'reprovou a verificação de' },

  whatsapp_enviado: { grupo: 'mensagens', verbo: 'chamou no WhatsApp' },
  email_enviado: { grupo: 'mensagens', verbo: 'enviou e-mail para' },
  aviso_enviado: { grupo: 'mensagens', verbo: 'mandou aviso para' },
  advertencia_enviada: { grupo: 'mensagens', verbo: 'mandou advertência para' },
  promocao_enviada: { grupo: 'mensagens', verbo: 'disparou a promoção' },

  produtor_status: { grupo: 'lojistas', verbo: 'mudou o status de' },
  produtor_assumiu: { grupo: 'lojistas', verbo: 'assumiu o atendimento de' },
  produtor_liberou: { grupo: 'lojistas', verbo: 'liberou o atendimento de' },
  produtor_nota: { grupo: 'lojistas', verbo: 'anotou em' },
  sequencia_editada: { grupo: 'lojistas', verbo: 'editou as mensagens prontas' },

  usuario_bloqueado: { grupo: 'usuarios', verbo: 'bloqueou' },
  usuario_desbloqueado: { grupo: 'usuarios', verbo: 'desbloqueou' },
  usuario_restrito: { grupo: 'usuarios', verbo: 'restringiu' },
  usuario_liberado: { grupo: 'usuarios', verbo: 'tirou a restrição de' },
  admin_adicionado: { grupo: 'usuarios', verbo: 'tornou administrador' },
  admin_removido: { grupo: 'usuarios', verbo: 'tirou de administrador' },
  loja_visibilidade: { grupo: 'usuarios', verbo: 'mudou a exibição da loja' },

  pedido_reembolsado: { grupo: 'financeiro', verbo: 'reembolsou o pedido' },
  pix_conferido: { grupo: 'financeiro', verbo: 'conferiu o Pix do pedido' },
  saque_pago: { grupo: 'financeiro', verbo: 'marcou como pago o saque de' },
  saque_recusado: { grupo: 'financeiro', verbo: 'recusou o saque de' },
  reclamacao_resolvida: { grupo: 'financeiro', verbo: 'resolveu a reclamação do pedido' },
  reembolso_aprovado: { grupo: 'financeiro', verbo: 'aprovou o reembolso do pedido' },
  reembolso_recusado: { grupo: 'financeiro', verbo: 'recusou o reembolso do pedido' },
  reembolso_confirmado: { grupo: 'financeiro', verbo: 'confirmou a devolução do pedido' },

  config_alterada: { grupo: 'config', verbo: 'alterou as configurações' },
};

export type Registro = {
  id?: number;
  admin_id: string | null;
  admin_nome: string | null;
  acao: string;
  alvo_tipo: string | null;
  alvo_id: string | null;
  alvo_nome: string | null;
  detalhes: Record<string, any> | null;
  criado_em: string;
};

export const grupoDaAcao = (acao: string): GrupoAcao | null => ACOES[acao]?.grupo ?? null;
export const acoesDoGrupo = (g: string): string[] => Object.keys(ACOES).filter((k) => ACOES[k].grupo === g);

const ROT_STATUS: Record<string, string> = { novo: 'Novo', conversando: 'Conversando', cadastrou: 'Cadastrou', vendendo: 'Vendendo', descartado: 'Descartado' };
const ROT_MOD: Record<string, string> = { correcao: 'pediu correção no anúncio', pausar: 'pausou o anúncio', cancelar: 'cancelou o anúncio', reativar: 'reativou o anúncio' };

/** Frase curta do que foi feito, sem o nome de quem fez. Ex.: "aprovou o anúncio “Conta Free Fire”". */
export function descreverAcao(r: Pick<Registro, 'acao' | 'alvo_nome' | 'detalhes'>): string {
  const d = r.detalhes || {};
  const alvo = r.alvo_nome ? ` “${r.alvo_nome}”` : '';
  switch (r.acao) {
    case 'whatsapp_enviado': {
      const n = Number(d.etapa);
      const qual = n >= 1 && n <= 3 ? `mensagem ${n}${d.titulo ? ` (${d.titulo})` : ''}` : 'mensagem da fase';
      return `enviou a ${qual} no WhatsApp para${alvo}`;
    }
    case 'produtor_status':
      return `mudou${alvo} de ${ROT_STATUS[d.de] || d.de || '—'} para ${ROT_STATUS[d.para] || d.para || '—'}${d.automatico ? ' (ao enviar a mensagem)' : ''}`;
    case 'produto_moderado':
      return `${ROT_MOD[d.acao] || 'moderou o anúncio'}${alvo}`;
    case 'produto_destaque':
      return Number(d.dias) > 0 ? `deu ${d.dias} dias de destaque ao anúncio${alvo}` : `tirou o destaque do anúncio${alvo}`;
    case 'loja_visibilidade':
      return d.ocultar ? `passou a vender a loja${alvo} como Comprei Barato` : `voltou a mostrar o nome da loja${alvo}`;
    case 'pix_conferido':
      return `conferiu o Pix do pedido${alvo}${d.resultado ? ` (${d.resultado})` : ''}`;
    case 'email_enviado':
      return `enviou e-mail para${alvo}${d.assunto ? ` — “${d.assunto}”` : ''}`;
    case 'config_alterada':
      return `alterou as configurações${Array.isArray(d.chaves) && d.chaves.length ? ` (${d.chaves.slice(0, 6).join(', ')}${d.chaves.length > 6 ? '…' : ''})` : ''}`;
    default: {
      const a = ACOES[r.acao];
      return a ? `${a.verbo}${alvo}` : `${r.acao.replace(/_/g, ' ')}${alvo}`;
    }
  }
}

export const primeiroNome = (s: unknown) => String(s ?? '').trim().split(/\s+/)[0] || '';

/** Nome curto do admin para mostrar nas telas (nome do perfil, senão a parte antes do @ do e-mail). */
export function nomeDoAdmin(nome: unknown, email?: unknown): string {
  const n = primeiroNome(nome);
  if (n) return n.charAt(0).toUpperCase() + n.slice(1);
  const e = String(email ?? '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  const p = primeiroNome(e);
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Admin';
}

/** Cor fixa por admin (mesma pessoa = mesma cor em todas as telas). */
const CORES = ['#4C8DFF', '#20C98A', '#FF7A14', '#9B6BFF', '#E8457A', '#00B8D9'];
export function corDoAdmin(id: string | null | undefined): string {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return s ? CORES[h % CORES.length] : '#8A8AA0';
}

// ------------------------------------------------------------
// Sequência de mensagens para o lojista novo (WhatsApp)
// ------------------------------------------------------------
export type MensagemSequencia = { titulo: string; texto: string };

/** Padrão: boas-vindas → descobrir o que vende → levar ao 1º anúncio. Todas terminam com pergunta. */
export const SEQUENCIA_PADRAO: MensagemSequencia[] = [
  {
    titulo: 'Boas-vindas',
    texto: 'Oi, {nome}! Tudo bem? Aqui é {atendente}, da equipe do Comprei Barato 👋 Vi que você acabou de criar sua loja com a gente — seja muito bem-vindo! Posso te ajudar a deixar ela pronta pra vender?',
  },
  {
    titulo: 'O que vende',
    texto: 'Pra eu te orientar do jeito certo: o que você mais vende hoje? Contas, itens/skins, moedas, gift cards ou serviços (boost, coach)? E é mais de qual jogo?',
  },
  {
    titulo: '1º anúncio',
    texto: 'Show, isso tem procura aqui! 🔥 Subir o primeiro anúncio leva uns 2 minutos: compreibarato.com.br/vender/produtos/novo\n\nO anúncio é grátis, você só paga a taxa quando vende e o dinheiro do cliente fica protegido até a entrega. Quer que eu acompanhe com você enquanto sobe o primeiro?',
  },
];

export const VARIAVEIS = ['{nome}', '{atendente}', '{jogo}'] as const;
export const MAX_MENSAGENS = 3;

/** Troca as variáveis: {nome} = 1º nome do lojista, {atendente} = 1º nome de quem está logado, {jogo} = jogo do cadastro. */
export function montarMensagem(texto: string, v: { nome?: string | null; atendente?: string | null; jogo?: string | null }): string {
  const nome = primeiroNome(v.nome) || 'tudo bem';
  const atendente = primeiroNome(v.atendente) || 'a equipe';
  const jogo = String(v.jogo || '').trim() || 'seu jogo';
  return String(texto || '')
    .replace(/\{nome\}/gi, nome)
    .replace(/\{atendente\}/gi, atendente)
    .replace(/\{jogo\}/gi, jogo);
}

/** Valida a sequência editada no admin: 1 a 3 mensagens, título curto e texto de 10 a 1000 caracteres. */
export function validarSequencia(v: unknown): { ok: true; sequencia: MensagemSequencia[] } | { ok: false; erro: string } {
  if (!Array.isArray(v) || !v.length) return { ok: false, erro: 'Escreva pelo menos uma mensagem.' };
  if (v.length > MAX_MENSAGENS) return { ok: false, erro: `No máximo ${MAX_MENSAGENS} mensagens.` };
  const out: MensagemSequencia[] = [];
  for (let i = 0; i < v.length; i++) {
    const m: any = v[i] || {};
    const texto = String(m.texto ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    const titulo = String(m.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 30) || `Mensagem ${i + 1}`;
    if (texto.length < 10) return { ok: false, erro: `A mensagem ${i + 1} está curta demais.` };
    if (texto.length > 1000) return { ok: false, erro: `A mensagem ${i + 1} passou de 1000 caracteres.` };
    out.push({ titulo, texto });
  }
  return { ok: true, sequencia: out };
}

/** Lê o que está salvo em settings; se faltar ou estiver quebrado, usa o padrão. */
export function sequenciaSalva(valor: unknown): MensagemSequencia[] {
  const v = validarSequencia(valor);
  return v.ok ? v.sequencia : SEQUENCIA_PADRAO;
}

/** Próxima mensagem a enviar (1, 2, 3) ou null se a sequência acabou. */
export function proximaEtapa(enviadas: unknown, total = MAX_MENSAGENS): number | null {
  const n = Math.max(0, Math.floor(Number(enviadas) || 0));
  return n >= total ? null : n + 1;
}

/** Quem está atendendo o lojista, do ponto de vista de quem está logado. */
export function situacaoAtendimento(item: { responsavel_id?: string | null; responsavel_nome?: string | null }, meuId: string | null | undefined):
  { tipo: 'livre' } | { tipo: 'meu'; nome: string } | { tipo: 'outro'; nome: string } {
  if (!item?.responsavel_id) return { tipo: 'livre' };
  const nome = item.responsavel_nome || 'Outro admin';
  return item.responsavel_id === meuId ? { tipo: 'meu', nome } : { tipo: 'outro', nome };
}

/** Texto curto para "desde quando". Ex.: "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function haQuanto(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return '';
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (!isFinite(s)) return '';
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}
