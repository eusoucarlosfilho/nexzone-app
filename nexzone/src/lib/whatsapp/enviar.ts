// Envio de avisos por WhatsApp. SÓ SERVIDOR.
//
// Regra de ouro: NUNCA lança erro e NUNCA trava quem chamou (compra, webhook, chat, cadastro).
// - interruptor geral e por evento (Admin → Torpedos → WhatsApp);
// - destinatário: telefone do perfil, só se "Receber avisos por WhatsApp" estiver ligado;
//   sem número válido → não envia (o e-mail continua normal);
// - sem duplicidade: cada aviso tem uma chave única (ex.: compra_aprovada:<pedido>:comprador);
// - limite por minuto: acima dele, o aviso fica "adiado" para reenvio manual no admin;
// - tudo registrado em whatsapp_log (aba Torpedos enviados).
// Se a tabela whatsapp_log não existir (SQL não aplicado), nada é enviado.
import { createAdminClient } from '@/lib/supabase/server';
import { conectado, sendText, sendImage } from '@/lib/whatsapp';
import { qrPixPng } from './qrPix';
import { lerConfig } from './config';
import { acharEvento, montarTexto, chavePasso } from './eventos';
import { normalizarTelefone } from './telefone';
import { SITE_URL } from '@/lib/email';

type Vars = Record<string, string | number | null | undefined>;

export type Aviso = {
  evento: string;
  chave: string;              // identificador único deste aviso (evita repetição)
  userId?: string | null;     // destinatário cadastrado
  telefone?: string | null;   // alternativa quando não há usuário (ex.: chamado de visitante)
  paraAdmin?: boolean;        // usa o "WhatsApp do admin" da configuração
  vars: Vars;
};

const TEMPO_TOTAL_MS = 8000;

export const link = (caminho: string) => SITE_URL + caminho;
export const primeiroNome = (nome: unknown) => String(nome ?? '').trim().split(/\s+/)[0] || 'tudo bem';

/** Telefone + consentimento de um usuário. Perfil primeiro; se vazio, o número informado no cadastro. */
export async function contatoDoUsuario(admin: any, userId: string): Promise<{ telefone: string | null; avisos: boolean; promocoes: boolean; nome: string | null }> {
  const { data: p } = await admin.from('profiles')
    .select('nome, whatsapp, whatsapp_avisos, whatsapp_promocoes').eq('id', userId).maybeSingle();
  let telefone = normalizarTelefone((p as any)?.whatsapp);
  if (!telefone) {
    try {
      const { data } = await admin.auth.admin.getUserById(userId);
      const md: any = data?.user?.user_metadata || {};
      telefone = normalizarTelefone(md.whatsapp || md.phone || data?.user?.phone);
    } catch { /* sem número */ }
  }
  return {
    telefone,
    avisos: (p as any)?.whatsapp_avisos !== false,
    promocoes: (p as any)?.whatsapp_promocoes !== false,
    nome: (p as any)?.nome ?? null,
  };
}

async function executar(a: Aviso): Promise<void> {
  const cfg = await lerConfig();
  if (!cfg.ativo) return;
  const ev = cfg.eventos[a.evento];
  const def = acharEvento(a.evento);
  if (!def || !ev || !ev.ativo) return;

  const admin = createAdminClient();
  let destino: string | null = null;
  let nome: string | null = null;
  if (a.paraAdmin) destino = cfg.adminNumero;
  else if (a.userId) {
    const c = await contatoDoUsuario(admin, a.userId);
    if (!c.avisos) return;               // o usuário desligou os avisos por WhatsApp
    destino = c.telefone; nome = c.nome;
  }
  if (!destino && a.telefone) destino = normalizarTelefone(a.telefone);
  if (!destino) return;                   // sem número: fica só o e-mail

  const texto = montarTexto(ev.modelo || def.padrao, { nome: primeiroNome(nome), ...a.vars });
  if (!texto) return;

  // Interruptor LIGADO mas WhatsApp desconectado: não envia, não registra erro e não atrapalha o site
  if (!(await conectado())) return;

  // Registro + trava de duplicidade (chave única no banco)
  const { data: linha, error } = await admin.from('whatsapp_log').insert({
    evento: a.evento, chave: a.chave.slice(0, 200), user_id: a.userId ?? null, destino, texto, status: 'enviando',
  }).select('id').single();
  if (error || !linha) return;            // repetido (23505) ou tabela ausente: não envia

  // Limite por minuto
  const umMinuto = new Date(Date.now() - 60000).toISOString();
  const { count } = await admin.from('whatsapp_log').select('id', { count: 'exact', head: true })
    .in('status', ['enviado', 'enviando']).gte('created_at', umMinuto).neq('id', (linha as any).id);
  if ((count ?? 0) >= cfg.limitePorMinuto) {
    await admin.from('whatsapp_log').update({ status: 'adiado', erro: 'limite por minuto atingido' }).eq('id', (linha as any).id);
    return;
  }

  const r = await sendText(destino, texto);
  await admin.from('whatsapp_log').update(r.ok
    ? { status: 'enviado', enviado_em: new Date().toISOString(), erro: null, tentativas: 1 }
    : { status: 'falhou', erro: r.erro, tentativas: 1 }).eq('id', (linha as any).id);
}

/** Dispara um aviso. Nunca lança erro; desiste depois de 8 s. */
export async function avisarWhatsApp(a: Aviso): Promise<void> {
  try {
    await Promise.race([executar(a), new Promise<void>((ok) => setTimeout(ok, TEMPO_TOTAL_MS))]);
  } catch (e: any) {
    console.error('[whatsapp] aviso não enviado:', a.evento, e?.message || e);
  }
}

/** Reenvia um aviso que falhou ou foi adiado (botão no admin). */
export async function reenviar(id: number): Promise<{ ok: boolean; erro?: string }> {
  const admin = createAdminClient();
  const { data: l } = await admin.from('whatsapp_log').select('id, destino, texto, status, tentativas').eq('id', id).maybeSingle();
  if (!l) return { ok: false, erro: 'Registro não encontrado.' };
  if (!['falhou', 'adiado'].includes((l as any).status)) return { ok: false, erro: 'Só dá para reenviar avisos que falharam ou foram adiados.' };
  const cfg = await lerConfig();
  if (!cfg.ativo) return { ok: false, erro: 'O WhatsApp está desligado.' };
  if (!(await conectado())) return { ok: false, erro: 'O WhatsApp não está conectado.' };
  const r = await sendText((l as any).destino, String((l as any).texto).replace(/^\[imagem do QR Code\]\n/, ''));
  const tent = Number((l as any).tentativas || 0) + 1;
  await admin.from('whatsapp_log').update(r.ok
    ? { status: 'enviado', enviado_em: new Date().toISOString(), erro: null, tentativas: tent }
    : { status: 'falhou', erro: r.erro, tentativas: tent }).eq('id', id);
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}

/** Janela de 10 minutos: evita uma rajada de avisos de chat para a mesma pessoa. */
export const janela10min = () => Math.floor(Date.now() / 600000);

// ============================================================
// Sequência do Pix (4 mensagens, nesta ordem):
//   1. imagem do QR Code + texto (pix_gerado na hora / pix_lembrete no lembrete)
//   2. aviso de que o código copia e cola vem logo abaixo (pix_codigo_aviso)
//   3. só o código copia e cola (pix_codigo), para copiar com um toque
//   4. "este número é só de notificações; atendimento pelo site" (aviso_numero)
// Pagamento confirmado: compra_aprovada (link do chat com o vendedor) + aviso_numero.
// Cada mensagem tem o seu registro em whatsapp_log (chave única por pedido): nunca repete.
// Se o provedor não aceitar imagem, a 1ª mensagem vai só com o texto (o código continua indo).
// ============================================================
export type PassoWhats = { evento: string; vars: Vars; imagem?: string | null; textoBruto?: boolean };

const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Envia passos em ordem para um destinatário. Usado pela sequência do Pix, pela confirmação e pelo teste do admin. */
async function executarSequencia(dest: { userId?: string | null; telefone?: string | null; ignorarConsentimento?: boolean },
  base: string, passos: PassoWhats[], logUserId?: string | null): Promise<{ enviados: number; erros: string[] }> {
  const out = { enviados: 0, erros: [] as string[] };
  const cfg = await lerConfig();
  if (!cfg.ativo && !dest.ignorarConsentimento) return out;
  const admin = createAdminClient();
  let destino: string | null = null;
  let nome: string | null = null;
  if (dest.userId) {
    const c = await contatoDoUsuario(admin, dest.userId);
    if (!c.avisos && !dest.ignorarConsentimento) return out;
    destino = c.telefone; nome = c.nome;
  }
  if (!destino && dest.telefone) destino = normalizarTelefone(dest.telefone);
  if (!destino) return out;
  if (!(await conectado())) { out.erros.push('O WhatsApp não está conectado.'); return out; }

  for (let i = 0; i < passos.length; i++) {
    const p = passos[i];
    const ev = cfg.eventos[p.evento];
    const def = acharEvento(p.evento);
    if (!def || !ev || (!ev.ativo && !dest.ignorarConsentimento)) continue; // evento desligado no admin: pula só ele
    const modelo = ev.modelo || def.padrao;
    // o código Pix vai exatamente como o banco gerou (sem mexer em espaços)
    const texto = p.textoBruto && modelo.trim() === '{pix}'
      ? String(p.vars.pix ?? '').trim()
      : montarTexto(modelo, { nome: primeiroNome(nome), ...p.vars });
    if (!texto) continue;

    const { data: linha, error } = await admin.from('whatsapp_log').insert({
      evento: p.evento, chave: chavePasso(base, i), user_id: logUserId ?? dest.userId ?? null, destino,
      texto: p.imagem ? `[imagem do QR Code]\n${texto}` : texto, status: 'enviando',
    }).select('id').single();
    if (error || !linha) continue;          // já enviado antes (chave repetida) ou tabela ausente

    const umMinuto = new Date(Date.now() - 60000).toISOString();
    const { count } = await admin.from('whatsapp_log').select('id', { count: 'exact', head: true })
      .in('status', ['enviado', 'enviando']).gte('created_at', umMinuto).neq('id', (linha as any).id);
    // a sequência inteira conta como um aviso: só o 1º passo respeita o limite por minuto
    if (i === 0 && (count ?? 0) >= cfg.limitePorMinuto && !dest.ignorarConsentimento) {
      await admin.from('whatsapp_log').update({ status: 'adiado', erro: 'limite por minuto atingido' }).eq('id', (linha as any).id);
      return out;
    }

    let r = p.imagem ? await sendImage(destino, p.imagem, texto, 'qrcode-pix.png') : await sendText(destino, texto);
    let obs: string | null = null;
    if (!r.ok && p.imagem) {                // provedor sem envio de imagem: manda o texto para a sequência seguir
      obs = `imagem não enviada (${r.erro}); foi só o texto`;
      out.erros.push(`QR Code: ${r.erro}`);
      r = await sendText(destino, texto);
    }
    await admin.from('whatsapp_log').update(r.ok
      ? { status: 'enviado', enviado_em: new Date().toISOString(), erro: obs, tentativas: 1 }
      : { status: 'falhou', erro: r.erro, tentativas: 1 }).eq('id', (linha as any).id);
    if (r.ok) out.enviados++; else out.erros.push(`${def.rotulo}: ${r.erro}`);
    if (i < passos.length - 1) await pausa(900); // mantém a ordem das mensagens no celular
  }
  return out;
}

/** Monta os 4 passos do Pix. `tipo`: 'gerado' (na hora) ou 'lembrete' (Pix não pago). */
export async function passosPix(tipo: 'gerado' | 'lembrete', d: { produto: string; valor: string; pedido: string; link: string; pixCode: string; pixQr?: string | null }): Promise<PassoWhats[]> {
  const vars: Vars = { produto: d.produto, valor: d.valor, pedido: d.pedido, link: d.link, pix: d.pixCode };
  // QR Code gerado aqui a partir do código (nítido e sempre igual); se falhar, usa a imagem que o banco devolveu
  const imagem = (await qrPixPng(d.pixCode)) || (d.pixQr ? String(d.pixQr) : null);
  return [
    { evento: tipo === 'gerado' ? 'pix_gerado' : 'pix_lembrete', vars, imagem },
    { evento: 'pix_codigo_aviso', vars },
    { evento: 'pix_codigo', vars, textoBruto: true },
    { evento: 'aviso_numero', vars },
  ];
}

/** Sequência do Pix para o comprador. Nunca lança erro. */
export async function enviarSequenciaPix(a: { userId: string; orderId: string; tipo: 'gerado' | 'lembrete'; produto: string; valor: string; pixCode: string; pixQr?: string | null }): Promise<void> {
  try {
    const passos = await passosPix(a.tipo, { produto: a.produto, valor: a.valor, pedido: String(a.orderId).slice(0, 8), link: link(`/pedido/${a.orderId}`), pixCode: a.pixCode, pixQr: a.pixQr });
    await Promise.race([executarSequencia({ userId: a.userId }, `pix_${a.tipo}:${a.orderId}`, passos), pausa(25000)]);
  } catch (e: any) {
    console.error('[whatsapp] sequência do Pix não enviada:', e?.message || e);
  }
}

/** Pagamento confirmado: mensagem com o link do chat do pedido + aviso de que o número é só de notificações. */
export async function enviarConfirmacaoPagamento(a: { userId: string; orderId: string; produto: string; valor: string }): Promise<void> {
  try {
    const vars: Vars = { produto: a.produto, valor: a.valor, pedido: String(a.orderId).slice(0, 8), link: link(`/pedido/${a.orderId}#chat`) };
    await Promise.race([executarSequencia({ userId: a.userId }, `compra_aprovada:${a.orderId}`, [
      { evento: 'compra_aprovada', vars }, { evento: 'aviso_numero', vars },
    ]), pausa(15000)]);
  } catch (e: any) {
    console.error('[whatsapp] confirmação não enviada:', e?.message || e);
  }
}

/** Teste do admin: manda a sequência do Pix (código de exemplo) e a confirmação para o número digitado. */
export async function testarSequenciaPix(telefone: string, adminId: string): Promise<{ enviados: number; erros: string[] }> {
  // código de exemplo no formato do Pix, mas SEM chave válida: não dá para pagar
  const pixCode = '00020126360014BR.GOV.BCB.PIX0114TESTE-NAO-PAGAR5204000053039865406' + '1.00' + '5802BR5914COMPREI BARATO6009SAO PAULO62070503***6304ABCD';
  const marca = Date.now();
  const d = { produto: 'Produto de teste', valor: 'R$ 1,00', pedido: 'TESTE', link: link(''), pixCode }; // link de exemplo: a página inicial
  const pix = await passosPix('gerado', d);
  const confirmacao: PassoWhats[] = [{ evento: 'compra_aprovada', vars: d }, { evento: 'aviso_numero', vars: d }];
  return executarSequencia({ telefone, ignorarConsentimento: true }, `teste_pix:${marca}`, [...pix, ...confirmacao], adminId);
}
