// ============================================================
// Confiança no checkout (puro, sem banco): dados da empresa, prazo de entrega,
// cartão do vendedor e as regras de honestidade dos números exibidos.
// Tudo aqui é testado em testes/confianca.test.js.
// ============================================================

export type DadosEmpresa = {
  razao: string;      // razão social
  cnpj: string;       // só dígitos
  whatsapp: string;   // só dígitos, com DDI 55
  email: string;      // e-mail de contato exibido ao comprador
  cidade: string;     // "Palmas/TO"
  prazoManualHoras: number; // prazo padrão de entrega quando o vendedor entrega pelo chat
};

export const EMPRESA_VAZIA: DadosEmpresa = { razao: '', cnpj: '', whatsapp: '', email: '', cidade: '', prazoManualHoras: 24 };

/** Chaves da tabela settings usadas por esta tela. */
export const CHAVES_EMPRESA = ['empresa_razao', 'empresa_cnpj', 'empresa_whatsapp', 'empresa_email', 'empresa_cidade', 'entrega_prazo_horas'] as const;

const texto = (v: unknown, max: number) => {
  if (v === null || v === undefined || typeof v === 'boolean' || typeof v === 'object') return '';
  return String(v).replace(/^"+|"+$/g, '').replace(/[<>]/g, '').trim().slice(0, max);
};
const digitos = (v: unknown) => texto(v, 40).replace(/\D/g, '');

/** CNPJ com dígitos verificadores corretos. */
export function cnpjValido(v: unknown): boolean {
  const c = digitos(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

export function formatarCnpj(v: unknown): string {
  const c = digitos(v);
  if (c.length !== 14) return c;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** WhatsApp em dígitos com DDI 55 (aceita "(63) 99999-0000"). Inválido: ''. */
export function whatsappEmpresa(v: unknown): string {
  let d = digitos(v);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55\d{10,11}$/.test(d) ? d : '';
}

export function whatsappLegivel(d: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : '';
}

export function horasPrazo(v: unknown): number {
  const n = Math.round(Number(texto(v, 10)));
  return Number.isFinite(n) && n >= 1 && n <= 168 ? n : 24;
}

/** Lê o mapa {chave: valor} da tabela settings. Faltando chave: vazio (nada inventado). */
export function lerDadosEmpresa(map: Record<string, unknown>, emailSuporte?: unknown): DadosEmpresa {
  const email = texto(map.empresa_email, 120) || texto(emailSuporte, 300).split(',')[0].trim();
  return {
    razao: texto(map.empresa_razao, 120),
    cnpj: cnpjValido(map.empresa_cnpj) ? digitos(map.empresa_cnpj) : '',
    whatsapp: whatsappEmpresa(map.empresa_whatsapp),
    email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) ? email : '',
    cidade: texto(map.empresa_cidade, 60),
    prazoManualHoras: horasPrazo(map.entrega_prazo_horas),
  };
}

/** Valida o que o admin digitou. Campo vazio é permitido (some do checkout). */
export function validarEmpresa(b: any): { ok: true; dados: DadosEmpresa } | { ok: false; campo: string; erro: string } {
  const razao = texto(b?.razao, 120);
  const cnpjD = digitos(b?.cnpj);
  if (cnpjD && !cnpjValido(cnpjD)) return { ok: false, campo: 'cnpj', erro: 'CNPJ inválido. Confira os 14 números.' };
  const wRaw = digitos(b?.whatsapp);
  const whatsapp = wRaw ? whatsappEmpresa(wRaw) : '';
  if (wRaw && !whatsapp) return { ok: false, campo: 'whatsapp', erro: 'WhatsApp inválido. Use DDD + número.' };
  const email = texto(b?.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return { ok: false, campo: 'email', erro: 'E-mail inválido.' };
  const h = Math.round(Number(b?.prazoManualHoras));
  if (!Number.isFinite(h) || h < 1 || h > 168) return { ok: false, campo: 'prazoManualHoras', erro: 'Prazo de 1 a 168 horas.' };
  return { ok: true, dados: { razao, cnpj: cnpjD, whatsapp, email, cidade: texto(b?.cidade, 60), prazoManualHoras: h } };
}

// ---------- Prazo de entrega ----------
const TIPOS_MANUAIS = ['conta', 'item', 'moeda', 'servico'];
export const entregaPeloVendedor = (tipoAnuncio: unknown) => TIPOS_MANUAIS.includes(String(tipoAnuncio || ''));

export function textoHoras(h: number): string {
  if (h % 24 === 0 && h >= 24) { const d = h / 24; return `${d} ${d === 1 ? 'dia' : 'dias'}`; }
  return `${h} ${h === 1 ? 'hora' : 'horas'}`;
}

/** Promessa de entrega exibida no checkout e no pedido. */
export function promessaEntrega(tipoAnuncio: unknown, prazoHoras: number): { titulo: string; detalhe: string; manual: boolean } {
  if (entregaPeloVendedor(tipoAnuncio)) {
    return {
      manual: true,
      titulo: `Entrega pelo vendedor em até ${textoHoras(prazoHoras)}`,
      detalhe: 'Depois do pagamento, o vendedor entrega pelo chat do pedido. Você é avisado aqui e no WhatsApp.',
    };
  }
  return {
    manual: false,
    titulo: 'Entrega na hora',
    detalhe: 'Liberado automaticamente assim que o pagamento confirmar. Você é avisado aqui e no WhatsApp.',
  };
}

// ---------- Cartão do vendedor (só números reais) ----------
export type StatsVendedor = { desde: string | null; vendas: number; avaliacoes: number; media: number };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function mesAno(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return '';
  return `${MESES[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

/** Linhas do cartão do vendedor. Loja sem histórico: diz que é nova, sem inventar número. */
export function linhasVendedor(s: StatsVendedor, opts: { oficial: boolean; verificada: boolean }): { selo: string | null; linhas: string[]; nova: boolean } {
  const selo = opts.oficial ? 'Loja oficial' : opts.verificada ? 'Loja verificada' : null;
  const linhas: string[] = [];
  const desde = mesAno(s.desde);
  if (desde) linhas.push(`Na plataforma desde ${desde}`);
  const vendas = Math.max(0, Math.floor(Number(s.vendas) || 0));
  if (vendas > 0) linhas.push(`${vendas.toLocaleString('pt-BR')} ${vendas === 1 ? 'venda concluída' : 'vendas concluídas'}`);
  const av = Math.max(0, Math.floor(Number(s.avaliacoes) || 0));
  if (av > 0 && s.media >= 1) linhas.push(`${s.media.toFixed(1).replace('.', ',')} de 5 · ${av} ${av === 1 ? 'avaliação' : 'avaliações'}`);
  return { selo, linhas, nova: vendas === 0 };
}

// ---------- Honestidade dos contadores ----------
/**
 * Contador manual de avaliações só aparece se existir ao menos uma avaliação real escrita.
 * "356 avaliações" com a lista vazia é o que mais derruba a confiança de quem vem do anúncio.
 */
export function avaliacoesExibidas(exibidas: { avaliacoes: number; media: number }, reaisComTexto: number): { avaliacoes: number; media: number } {
  if (reaisComTexto > 0) return exibidas;
  return { avaliacoes: 0, media: 0 };
}

// ---------- Pedido de avaliação ----------
/** Janela em que o comprador recebe o pedido de avaliação: entre 24 h e 72 h depois da entrega. */
export const JANELA_AVALIACAO = { deHoras: 72, ateHoras: 24 } as const;

export type PedidoParaAvaliar = { id: string; comprador: string; entregue_em: string | null; status: string };
export function precisaPedirAvaliacao(o: PedidoParaAvaliar, agora: number, jaAvaliou: boolean, jaPediu: boolean): boolean {
  if (jaAvaliou || jaPediu) return false;
  if (o.status !== 'entregue' && o.status !== 'pago') return false;
  const t = o.entregue_em ? new Date(o.entregue_em).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  const horas = (agora - t) / 3600000;
  return horas >= JANELA_AVALIACAO.ateHoras && horas <= JANELA_AVALIACAO.deHoras;
}

// ---------- Linha do tempo do pedido ----------
export type EtapaPedido = { id: 'criado' | 'pago' | 'entregue' | 'garantia'; rotulo: string; quando: string | null; feito: boolean; atual: boolean };

export function linhaDoTempo(o: { status: string; created_at?: string | null; pago_em?: string | null; entregue_em?: string | null; garantia_ate?: string | null }, agora = Date.now()): EtapaPedido[] {
  const pago = ['pago', 'entregue'].includes(o.status);
  const entregue = o.status === 'entregue' || (pago && !!o.entregue_em);
  const garantiaFim = o.garantia_ate ? new Date(o.garantia_ate).getTime() : NaN;
  const garantiaPassou = Number.isFinite(garantiaFim) && garantiaFim <= agora;
  const etapas: EtapaPedido[] = [
    { id: 'criado', rotulo: 'Pedido criado', quando: o.created_at ?? null, feito: true, atual: false },
    { id: 'pago', rotulo: pago ? 'Pagamento confirmado' : 'Aguardando pagamento', quando: pago ? (o.pago_em ?? o.entregue_em ?? null) : null, feito: pago, atual: false },
    { id: 'entregue', rotulo: 'Produto entregue', quando: entregue ? (o.entregue_em ?? null) : null, feito: entregue, atual: false },
    { id: 'garantia', rotulo: garantiaPassou ? 'Garantia concluída' : 'Garantia em andamento', quando: o.garantia_ate ?? null, feito: garantiaPassou, atual: false },
  ];
  const i = etapas.findIndex((e) => !e.feito);
  if (i >= 0) etapas[i].atual = true;
  return etapas;
}
