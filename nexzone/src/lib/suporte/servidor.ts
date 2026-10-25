// ============================================================
// Central de Suporte — regras do servidor.
// USO EXCLUSIVO NO SERVIDOR (rotas /api e páginas do servidor). Usa service_role.
// ============================================================
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { calcBalance } from '@/lib/balance';
import { computeJourney, getStoreRevenue } from '@/lib/journey';
import { sendEmail, layoutEmail, esc, textoParaHtml, SITE_URL, moneyBR } from '@/lib/email';
import {
  ANEXO_MAX_BYTES, ANEXO_TIPOS, BUCKET_ANEXOS, LIMITE_CHAMADOS_HORA, REABRIR_DIAS,
  nomeCategoria, nomePrioridade, nomeStatus,
} from './constantes';

export type Admin = ReturnType<typeof createAdminClient>;

export const REMETENTE_SUPORTE_PADRAO = 'Comprei Barato <suporte@compreibarato.com.br>';
export const remetenteSuporte = () => process.env.RESEND_FROM || REMETENTE_SUPORTE_PADRAO;

// ------------------------------------------------------------
// Texto: sem HTML, sem caracteres de controle
// ------------------------------------------------------------
export function limparTexto(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/<[^>]*>/g, '')                       // remove tags HTML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max);
}
export function limparLinha(v: unknown, max: number): string {
  return limparTexto(v, max).replace(/\s+/g, ' ').trim();
}
export function emailValido(e: string): boolean {
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(e) && e.length <= 200;
}

// ------------------------------------------------------------
// Link seguro do chamado (visitante): token = HMAC(segredo, id do chamado).
// No banco fica só o sha-256 do token. Assim todo e-mail pode levar o mesmo link,
// e um vazamento do banco não revela links válidos.
// ------------------------------------------------------------
function segredoLink(): string {
  const s = process.env.SUPORTE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!s) throw new Error('Sem SUPORTE_LINK_SECRET/SUPABASE_SERVICE_ROLE_KEY para assinar o link do suporte');
  return s;
}
export function tokenDoChamado(ticketId: string): string {
  return createHmac('sha256', segredoLink()).update(`suporte:${ticketId}`).digest('base64url');
}
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function tokenConfere(ticket: { id: string; access_token_hash?: string | null }, token: string | null | undefined): boolean {
  if (!token || token.length > 200) return false;
  try {
    if (ticket.access_token_hash && iguais(sha256(token), ticket.access_token_hash)) return true;
    return iguais(token, tokenDoChamado(ticket.id));
  } catch { return false; }
}

export const urlChamado = (protocol: string, ticketId: string) =>
  `${SITE_URL}/suporte/${encodeURIComponent(protocol)}?t=${encodeURIComponent(tokenDoChamado(ticketId))}`;
export const urlAdminChamado = (protocol: string) => `${SITE_URL}/admin?suporte=${encodeURIComponent(protocol)}`;

// ------------------------------------------------------------
// IP (só o hash, para o limite por hora)
// ------------------------------------------------------------
export function ipDaRequisicao(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') || '';
  return (xf.split(',')[0] || req.headers.get('x-real-ip') || '').trim().slice(0, 64);
}
export const hashIp = (ip: string) => (ip ? sha256(`cb-suporte-ip:${ip}`) : null);

export async function excedeuLimite(admin: Admin, email: string, ipHash: string | null): Promise<boolean> {
  const desde = new Date(Date.now() - 3600_000).toISOString();
  const { count: porEmail } = await admin.from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('requester_email', email).gte('created_at', desde);
  if ((porEmail ?? 0) >= LIMITE_CHAMADOS_HORA) return true;
  if (ipHash) {
    const { count: porIp } = await admin.from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gte('created_at', desde);
    if ((porIp ?? 0) >= LIMITE_CHAMADOS_HORA) return true;
  }
  return false;
}

// ------------------------------------------------------------
// Quem está pedindo
// ------------------------------------------------------------
export async function ehAdmin(admin: Admin, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data as any)?.role === 'admin';
}

// Pode ver/responder o chamado como cliente? (dono logado ou link com token)
export function clienteTemAcesso(ticket: any, userId: string | null | undefined, token: string | null | undefined): boolean {
  if (userId && ticket.user_id && ticket.user_id === userId) return true;
  return tokenConfere(ticket, token);
}

export function podeReabrir(ticket: any): boolean {
  if (ticket.status !== 'resolvido' || !ticket.resolved_at) return false;
  return Date.now() - new Date(ticket.resolved_at).getTime() <= REABRIR_DIAS * 86400000;
}
// Cliente pode mandar mensagem? (fechado: não; resolvido: só dentro dos 7 dias, e isso reabre)
export function clientePodeResponder(ticket: any): boolean {
  if (ticket.status === 'fechado') return false;
  if (ticket.status === 'resolvido') return podeReabrir(ticket);
  return true;
}

// ------------------------------------------------------------
// Configurações de aviso (tabela settings)
// ------------------------------------------------------------
export type ConfigSuporte = { supportEmails: string[]; emailCliente: boolean; avisoAdmins: Record<string, boolean> };

export async function lerConfigSuporte(admin: Admin): Promise<ConfigSuporte> {
  try {
    const { data } = await admin.from('settings').select('key, value')
      .in('key', ['support_email', 'suporte_email_cliente', 'suporte_aviso_admins']);
    const m: any = Object.fromEntries(((data as any[]) ?? []).map((r) => [r.key, r.value]));
    const supportEmails = String(typeof m.support_email === 'string' ? m.support_email : '')
      .split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => emailValido(e));
    const avisoAdmins = m.suporte_aviso_admins && typeof m.suporte_aviso_admins === 'object' && !Array.isArray(m.suporte_aviso_admins)
      ? m.suporte_aviso_admins : {};
    return { supportEmails: Array.from(new Set(supportEmails)), emailCliente: m.suporte_email_cliente !== false, avisoAdmins };
  } catch {
    return { supportEmails: [], emailCliente: true, avisoAdmins: {} };
  }
}

export async function emailDe(admin: Admin, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email?.toLowerCase() ?? null;
  } catch { return null; }
}

export async function listarAdmins(admin: Admin): Promise<{ id: string; email: string | null; nome: string | null }[]> {
  const { data } = await admin.from('profiles').select('id, nome').eq('role', 'admin');
  const lista = ((data as any[]) ?? []);
  return Promise.all(lista.map(async (p) => ({ id: p.id, nome: p.nome ?? null, email: await emailDe(admin, p.id) })));
}

/**
 * Para quem vai o aviso de chamado novo / cliente respondeu:
 *   (e-mails de suporte da Configurações) + (e-mail de cada admin com o aviso LIGADO)
 *   menos o e-mail de cada admin que DESLIGOU o próprio aviso.
 * Admin sem preferência salva conta como ligado.
 */
export async function destinatariosAdmins(admin: Admin, cfg?: ConfigSuporte): Promise<string[]> {
  const c = cfg || await lerConfigSuporte(admin);
  const admins = await listarAdmins(admin);
  const ligados = new Set<string>(); const desligados = new Set<string>();
  for (const a of admins) {
    if (!a.email) continue;
    if (c.avisoAdmins[a.id] === false) desligados.add(a.email); else ligados.add(a.email);
  }
  const todos = new Set<string>([...c.supportEmails, ...Array.from(ligados)]);
  return Array.from(todos).filter((e) => !desligados.has(e));
}

// ------------------------------------------------------------
// Conta do cliente: foto (snapshot) e painel ao vivo.
// Nível: usa o que JÁ existe no projeto —
//   loja: stores.nivel (novo/verificado/top) + selo da jornada "Rumo às estrelas"
//         (lib/journey: faturamento pago da loja);
//   comprador: CB Points do perfil (profiles.cb_points).
// ------------------------------------------------------------
async function acharUsuarioPorEmail(admin: Admin, email: string): Promise<string | null> {
  try {
    for (let page = 1; page <= 10; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users ?? [];
      const u = users.find((x: any) => String(x.email || '').toLowerCase() === email);
      if (u) return u.id;
      if (users.length < 1000) break;
    }
  } catch { /* sem busca: segue como visitante */ }
  return null;
}

export async function resumoConta(admin: Admin, userId: string | null, email: string, opts: { ignorarTicket?: string; detalhado?: boolean } = {}) {
  const ehVisitante = !userId;
  let uid = userId;
  let origem: 'logado' | 'email_nao_verificado' | 'visitante' = userId ? 'logado' : 'visitante';
  if (!uid) {
    uid = await acharUsuarioPorEmail(admin, email);
    if (uid) origem = 'email_nao_verificado';
  }

  // chamados anteriores (pela conta ou pelo e-mail)
  let qTk = admin.from('support_tickets').select('id, protocol, subject, status, category, opened_at')
    .order('opened_at', { ascending: false }).limit(20);
  qTk = uid ? qTk.or(`user_id.eq.${uid},requester_email.eq."${email.replace(/"/g, '')}"`) : qTk.eq('requester_email', email);
  const { data: tks } = await qTk;
  const chamados = ((tks as any[]) ?? []).filter((t) => t.id !== opts.ignorarTicket);

  const base: any = {
    gerado_em: new Date().toISOString(),
    origem,                                   // logado | email_nao_verificado | visitante
    conta_encontrada: !!uid,
    chamados_anteriores: chamados.length,
  };
  if (opts.detalhado) base.chamados_lista = chamados.slice(0, 10);
  if (!uid) return { ...base, tipo_conta: 'visitante' };

  const { data: prof } = await admin.from('profiles').select('*').eq('id', uid).maybeSingle();
  const p: any = prof || {};
  const { data: store } = await admin.from('stores').select('id, nome, slug, nivel, status, created_at').eq('owner', uid).maybeSingle();
  const s: any = store || null;

  // compras
  const { data: compras } = await admin.from('orders').select('id, total, status, created_at, products(titulo)')
    .eq('comprador', uid).order('created_at', { ascending: false }).limit(500);
  const comprasPagas = ((compras as any[]) ?? []).filter((o) => o.status === 'pago' || o.status === 'entregue');

  // reclamações abertas por ele
  const { data: rcs } = await admin.from('complaints').select('id, order_id, status, created_at')
    .eq('autor', uid).order('created_at', { ascending: false }).limit(50);
  const reclamacoes = (rcs as any[]) ?? [];

  const out: any = {
    ...base,
    tipo_conta: p.role || 'comprador',
    cadastro_em: p.created_at || null,
    status_conta: p.status || 'ativo',
    cb_points: Number(p.cb_points ?? 0),
    compras_qtd: comprasPagas.length,
    total_gasto: comprasPagas.reduce((t, o) => t + Number(o.total || 0), 0),
    reclamacoes_anteriores: reclamacoes.length,
    loja: null,
  };
  if (opts.detalhado) {
    out.compras_recentes = ((compras as any[]) ?? []).slice(0, 5).map((o) => ({ id: o.id, total: Number(o.total), status: o.status, created_at: o.created_at, titulo: o.products?.titulo ?? null }));
    out.reclamacoes_lista = reclamacoes.slice(0, 10);
  }

  if (s) {
    const rev = await getStoreRevenue(admin, s.id).catch(() => ({ faturamento: 0, vendas: 0 }));
    const jornada = computeJourney(rev.faturamento, rev.vendas);
    const { data: prods } = await admin.from('products').select('id, titulo, preco, preco_promo, status')
      .eq('store_id', s.id).order('created_at', { ascending: false }).limit(100);
    let saldo: any = null;
    try {
      const b = await calcBalance(admin, s.id);
      saldo = { disponivel: b.disponivel, a_liberar: b.aLiberar, retido_reclamacao: b.bloqueado, em_saque: b.emProcessamento };
    } catch { saldo = null; }
    out.loja = {
      id: s.id, nome: s.nome, slug: s.slug, status: s.status, criada_em: s.created_at,
      nivel: s.nivel,                              // stores.nivel
      selo: jornada.atual?.nome ?? 'Sem vendas',   // jornada "Rumo às estrelas"
      total_vendido: rev.faturamento,
      vendas_qtd: rev.vendas,
      produtos_qtd: ((prods as any[]) ?? []).length,
      produtos: ((prods as any[]) ?? []).slice(0, 50).map((x) => ({ id: x.id, titulo: x.titulo, preco: Number(x.preco_promo ?? x.preco), status: x.status })),
      saldo_disponivel: saldo?.disponivel ?? null,
      saldo_pendente: saldo ? saldo.a_liberar + saldo.retido_reclamacao : null,
      saldo_detalhe: saldo,
    };
    if (opts.detalhado) {
      const { data: vendas } = await admin.from('orders').select('id, total, status, created_at, products(titulo)')
        .eq('store_id', s.id).order('created_at', { ascending: false }).limit(5);
      out.loja.vendas_recentes = ((vendas as any[]) ?? []).map((o) => ({ id: o.id, total: Number(o.total), status: o.status, created_at: o.created_at, titulo: o.products?.titulo ?? null }));
    }
  }
  if (ehVisitante) out.aviso = 'Chamado aberto sem login: a conta foi encontrada pelo e-mail informado, que não foi confirmado.';
  return out;
}

export function textoNivel(snap: any): string {
  if (!snap || !snap.conta_encontrada) return 'Visitante (sem conta encontrada)';
  const partes: string[] = [];
  if (snap.loja) partes.push(`Loja ${snap.loja.nivel} · selo ${snap.loja.selo}`);
  partes.push(`${Number(snap.cb_points || 0).toLocaleString('pt-BR')} CB Points`);
  return partes.join(' · ');
}

// ------------------------------------------------------------
// Anexos (bucket privado)
// ------------------------------------------------------------
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

async function garantirBucket(admin: Admin) {
  try {
    const { data } = await admin.storage.getBucket(BUCKET_ANEXOS);
    if (data) return;
    await admin.storage.createBucket(BUCKET_ANEXOS, { public: false, fileSizeLimit: ANEXO_MAX_BYTES, allowedMimeTypes: [...ANEXO_TIPOS] });
  } catch (e: any) {
    console.error('[suporte] bucket:', e?.message || e);
  }
}

// Passo 1: o servidor confere tipo e tamanho e devolve uma URL assinada de upload
// (o arquivo vai direto do navegador para o Storage, sem passar pelo limite da Vercel).
export async function criarUploadAssinado(admin: Admin, tipo: string, tamanho: number) {
  if (!(ANEXO_TIPOS as readonly string[]).includes(tipo)) return { error: 'Envie uma imagem (PNG, JPG, WEBP, GIF) ou PDF.' };
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > ANEXO_MAX_BYTES) return { error: 'O anexo pode ter no máximo 5 MB.' };
  await garantirBucket(admin);
  const path = `pendentes/${randomUUID()}.${EXT[tipo]}`;
  const { data, error } = await admin.storage.from(BUCKET_ANEXOS).createSignedUploadUrl(path);
  if (error || !data) return { error: 'Não foi possível preparar o envio do anexo.' };
  return { path: data.path, token: data.token };
}

function tipoPelosBytes(b: Uint8Array): string | null {
  const h = (i: number) => b[i];
  if (b.length >= 8 && h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47) return 'image/png';
  if (b.length >= 3 && h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return 'image/jpeg';
  if (b.length >= 6 && h(0) === 0x47 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x38) return 'image/gif';
  if (b.length >= 12 && h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46
      && h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50) return 'image/webp';
  if (b.length >= 5 && h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46 && h(4) === 0x2d) return 'application/pdf';
  return null;
}

// Passo 2: ao gravar a mensagem, confere o arquivo de verdade (tamanho e assinatura dos bytes)
// e move de "pendentes/" para a pasta do chamado.
export async function confirmarAnexo(admin: Admin, pendPath: unknown, nomeOriginal: unknown, ticketId: string):
  Promise<{ ok: true; path: string; name: string; type: string } | { ok: false; error: string } | null> {
  const p = String(pendPath || '');
  if (!p) return null;
  if (!/^pendentes\/[0-9a-f-]{36}\.(png|jpg|webp|gif|pdf)$/.test(p)) return { ok: false, error: 'Anexo inválido.' };
  const bucket = admin.storage.from(BUCKET_ANEXOS);
  const { data: blob, error } = await bucket.download(p);
  if (error || !blob) return { ok: false, error: 'Anexo não encontrado. Envie de novo.' };
  const buf = new Uint8Array(await blob.arrayBuffer());
  const tipo = tipoPelosBytes(buf);
  if (buf.byteLength > ANEXO_MAX_BYTES || !tipo) {
    await bucket.remove([p]);
    return { ok: false, error: buf.byteLength > ANEXO_MAX_BYTES ? 'O anexo pode ter no máximo 5 MB.' : 'Envie uma imagem (PNG, JPG, WEBP, GIF) ou PDF.' };
  }
  const destino = `${ticketId}/${randomUUID()}.${EXT[tipo]}`;
  const { error: mvErr } = await bucket.move(p, destino);
  if (mvErr) return { ok: false, error: 'Não foi possível salvar o anexo.' };
  const nome = limparLinha(nomeOriginal, 120) || `anexo.${EXT[tipo]}`;
  return { ok: true, path: destino, name: nome, type: tipo };
}

export async function urlAssinadaAnexo(admin: Admin, path: string, nome?: string | null): Promise<string | null> {
  const { data } = await admin.storage.from(BUCKET_ANEXOS).createSignedUrl(path, 120, nome ? { download: nome } : undefined);
  return data?.signedUrl ?? null;
}

// ------------------------------------------------------------
// Gravação
// ------------------------------------------------------------
export async function registrarEvento(admin: Admin, ticketId: string, actorId: string | null, tipo: string, de?: string | null, para?: string | null) {
  const { error } = await admin.from('support_ticket_events').insert({ ticket_id: ticketId, actor_id: actorId, event_type: tipo, from_value: de ?? null, to_value: para ?? null });
  if (error) console.error('[suporte] evento:', error.message);
}

export async function marcarEmail(admin: Admin, messageId: string, status: 'enviado' | 'falhou' | 'desativado' | 'nao_aplicavel', erro?: string | null) {
  await admin.from('support_messages').update({
    email_status: status,
    email_sent_at: status === 'enviado' ? new Date().toISOString() : null,
    email_error: status === 'falhou' ? String(erro || 'falha no envio').slice(0, 300) : null,
  }).eq('id', messageId);
}

// ------------------------------------------------------------
// E-mails
// ------------------------------------------------------------
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function linhaInfo(rotulo: string, valor: string) {
  return `<tr><td style="padding:3px 12px 3px 0;color:#8A8A9A;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(rotulo)}</td><td style="padding:3px 0;color:#16161F;font-size:14px;font-weight:bold;">${esc(valor)}</td></tr>`;
}
function caixaMensagem(autor: string, data: string, corpo: string, destaque = false) {
  return `<div style="margin:0 0 12px 0;padding:14px 16px;border-radius:12px;background:${destaque ? '#FFF1E6' : '#F7F4F0'};border-left:4px solid ${destaque ? '#FF6B00' : '#D9D2CA'};">
    <div style="font-size:12px;color:#8A8A9A;margin-bottom:6px;"><strong style="color:#16161F;">${esc(autor)}</strong> · ${esc(data)}</div>
    <div style="font-size:14px;line-height:21px;color:#2A2A38;">${textoParaHtml(corpo)}</div>
  </div>`;
}

async function enviarParaVarios(destinos: string[], assunto: string, html: string, replyTo?: string) {
  let ok = 0; const erros: string[] = [];
  for (const to of destinos) {
    const r = await sendEmail({ to, subject: assunto, html, tag: 'suporte', from: remetenteSuporte(), replyTo });
    if (r.ok) ok++; else erros.push(r.error);
  }
  return { ok, erros };
}

/** Chamado novo → admins. */
export async function avisarAdminsChamadoNovo(admin: Admin, t: any, mensagem: string) {
  const destinos = await destinatariosAdmins(admin);
  if (!destinos.length) return { status: 'desativado' as const };
  const snap = t.customer_snapshot || {};
  const info = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
    ${linhaInfo('Protocolo', t.protocol)}${linhaInfo('Tipo', nomeCategoria(t.category))}${linhaInfo('Prioridade', nomePrioridade(t.priority))}
    ${linhaInfo('Nome', t.requester_name)}${linhaInfo('E-mail', t.requester_email)}${t.requester_phone ? linhaInfo('WhatsApp', t.requester_phone) : ''}
    ${linhaInfo('Nível', textoNivel(snap))}
    ${linhaInfo('Total vendido', snap.loja ? moneyBR(snap.loja.total_vendido) : '—')}
    ${linhaInfo('Produtos', snap.loja ? String(snap.loja.produtos_qtd) : '0')}
  </table>`;
  const html = layoutEmail({
    logo: true,
    titulo: `Novo chamado ${t.protocol}`,
    preheader: `${nomeCategoria(t.category)} · ${t.subject}`,
    texto: `${info}<p style="margin:0 0 8px 0;font-weight:bold;color:#16161F;">${esc(t.subject)}</p>${caixaMensagem(t.requester_name, quando(t.opened_at), mensagem, true)}`,
    botaoTexto: 'Abrir no Admin',
    botaoUrl: urlAdminChamado(t.protocol),
  });
  // Sem Reply-To para o cliente: a resposta deve ser dada pelo Admin, para ficar no histórico.
  const r = await enviarParaVarios(destinos, `[${t.protocol}] Novo chamado: ${t.subject}`, html);
  return r.ok > 0 ? { status: 'enviado' as const } : { status: 'falhou' as const, erro: r.erros.join(' | ') };
}

/** Cliente respondeu pelo site → admins. */
export async function avisarAdminsClienteRespondeu(admin: Admin, t: any, mensagem: string) {
  const destinos = await destinatariosAdmins(admin);
  if (!destinos.length) return { status: 'desativado' as const };
  const html = layoutEmail({
    logo: true,
    titulo: `O cliente respondeu o chamado ${t.protocol}`,
    preheader: t.subject,
    texto: `<p style="margin:0 0 12px 0;"><strong>${esc(t.requester_name)}</strong> (${esc(t.requester_email)}) respondeu em <strong>${esc(t.subject)}</strong>. O chamado voltou para <strong>Em atendimento</strong>.</p>${caixaMensagem(t.requester_name, quando(new Date().toISOString()), mensagem, true)}`,
    botaoTexto: 'Abrir no Admin',
    botaoUrl: urlAdminChamado(t.protocol),
  });
  const r = await enviarParaVarios(destinos, `[${t.protocol}] Cliente respondeu: ${t.subject}`, html);
  return r.ok > 0 ? { status: 'enviado' as const } : { status: 'falhou' as const, erro: r.erros.join(' | ') };
}

/** Confirmação para o cliente ao abrir. */
export async function confirmarParaCliente(admin: Admin, t: any) {
  const cfg = await lerConfigSuporte(admin);
  const html = layoutEmail({
    logo: true,
    titulo: `Recebemos seu chamado ${t.protocol}`,
    preheader: `Protocolo ${t.protocol} · ${t.subject}`,
    texto: `<p style="margin:0 0 12px 0;">Olá, ${esc(t.requester_name)}! Recebemos seu chamado e vamos responder por aqui, no e-mail <strong>${esc(t.requester_email)}</strong>.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;">${linhaInfo('Protocolo', t.protocol)}${linhaInfo('Assunto', t.subject)}${linhaInfo('Tipo', nomeCategoria(t.category))}</table>
      <p style="margin:0;">Guarde o número do protocolo. Pelo botão abaixo você acompanha a conversa e pode mandar mais informações.</p>`,
    botaoTexto: 'Acompanhar meu chamado',
    botaoUrl: urlChamado(t.protocol, t.id),
  });
  return sendEmail({ to: t.requester_email, subject: `Recebemos seu chamado ${t.protocol}`, html, tag: 'suporte', from: remetenteSuporte(), replyTo: cfg.supportEmails[0] });
}

/** Resposta do admin → cliente (com as últimas mensagens da conversa abaixo). */
export async function enviarRespostaAoCliente(admin: Admin, t: any, msg: any) {
  const cfg = await lerConfigSuporte(admin);
  const { data: anteriores } = await admin.from('support_messages')
    .select('id, sender_type, body, created_at').eq('ticket_id', t.id).eq('is_internal_note', false)
    .neq('id', msg.id).order('created_at', { ascending: false }).limit(4);
  const historico = ((anteriores as any[]) ?? []).map((m) =>
    caixaMensagem(m.sender_type === 'admin' ? 'Comprei Barato' : m.sender_type === 'sistema' ? 'Sistema' : t.requester_name, quando(m.created_at), m.body)).join('');
  const html = layoutEmail({
    logo: true,
    titulo: `Resposta ao seu chamado ${t.protocol}`,
    preheader: msg.body.slice(0, 120),
    texto: `<p style="margin:0 0 12px 0;">Olá, ${esc(t.requester_name)}! Respondemos seu chamado <strong>${esc(t.subject)}</strong>:</p>
      ${caixaMensagem('Comprei Barato', quando(msg.created_at), msg.body, true)}
      ${msg.attachment_name ? `<p style="margin:0 0 12px 0;font-size:13px;color:#8A8A9A;">Anexo: ${esc(msg.attachment_name)} (abra pela conversa no site).</p>` : ''}
      ${historico ? `<p style="margin:18px 0 8px 0;font-size:13px;color:#8A8A9A;font-weight:bold;">Mensagens anteriores</p>${historico}` : ''}
      <p style="margin:12px 0 0 0;font-size:13px;color:#8A8A9A;">Status: ${esc(nomeStatus(t.status))}. Responda pelo botão abaixo.</p>`,
    botaoTexto: 'Ver conversa e responder',
    botaoUrl: urlChamado(t.protocol, t.id),
  });
  return sendEmail({ to: t.requester_email, subject: `[${t.protocol}] Re: ${t.subject}`, html, tag: 'suporte', from: remetenteSuporte(), replyTo: cfg.supportEmails[0] });
}

/** Marcado como resolvido → cliente (pode reabrir em até 7 dias). */
export async function avisarResolvido(admin: Admin, t: any) {
  const cfg = await lerConfigSuporte(admin);
  const html = layoutEmail({
    logo: true,
    titulo: `Chamado ${t.protocol} resolvido`,
    preheader: t.subject,
    texto: `<p style="margin:0 0 12px 0;">Olá, ${esc(t.requester_name)}! Marcamos o chamado <strong>${esc(t.subject)}</strong> como <strong>resolvido</strong>.</p>
      <p style="margin:0;">Se ainda precisar de ajuda, você pode <strong>reabrir o chamado em até ${REABRIR_DIAS} dias</strong> pelo botão abaixo. Depois disso, é só abrir um novo chamado.</p>`,
    botaoTexto: 'Ver chamado ou reabrir',
    botaoUrl: urlChamado(t.protocol, t.id),
  });
  return sendEmail({ to: t.requester_email, subject: `[${t.protocol}] Chamado resolvido: ${t.subject}`, html, tag: 'suporte', from: remetenteSuporte(), replyTo: cfg.supportEmails[0] });
}

/** Fechado automaticamente (aguardando cliente por 5 dias) → cliente. */
export async function avisarFechadoAutomatico(admin: Admin, t: any, texto: string) {
  const cfg = await lerConfigSuporte(admin);
  const html = layoutEmail({
    logo: true,
    titulo: `Chamado ${t.protocol} encerrado`,
    preheader: t.subject,
    texto: `<p style="margin:0 0 12px 0;">Olá, ${esc(t.requester_name)}!</p>${textoParaHtml(texto)}`,
    botaoTexto: 'Abrir um novo chamado',
    botaoUrl: `${SITE_URL}/suporte`,
  });
  return sendEmail({ to: t.requester_email, subject: `[${t.protocol}] Chamado encerrado: ${t.subject}`, html, tag: 'suporte', from: remetenteSuporte(), replyTo: cfg.supportEmails[0] });
}
