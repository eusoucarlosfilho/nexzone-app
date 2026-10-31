// ============================================================
// Caixa de e-mail do admin — SÓ SERVIDOR.
// Recebe pelo Resend (MX do domínio → Resend → webhook email.received → /api/webhooks/email-recebido),
// guarda na tabela email_caixa (SQL 33) e envia pelo mesmo Resend que o site já usa.
// Segredo do webhook e chave da API (opcional) ficam CRIPTOGRAFADOS em settings ('caixa_email').
// ============================================================
import { createAdminClient } from '@/lib/supabase/server';
import { cifrar, decifrar } from '@/lib/whatsapp/config';
import { DOMINIO, chaveConversa, ehNosso, htmlDoTexto, lerEndereco, listaDeEmails, previaDe, textoDoHtml } from '@/lib/caixaEmail';
import { novoMessageId } from '@/lib/caixaEmail-assinatura';

type Admin = ReturnType<typeof createAdminClient>;
const API = 'https://api.resend.com';
const CHAVE_CFG = 'caixa_email';

export type CfgCaixa = {
  segredo: string;          // whsec_… do webhook (decifrado)
  chave: string;            // chave da API do Resend com permissão de leitura (decifrada); vazia = usa RESEND_API_KEY
  enderecos: string[];      // endereços que aparecem no "De:" ao escrever
  padrao: string;           // endereço padrão do "De:"
  nome: string;             // nome que aparece para quem recebe
  assinatura: string;       // texto colado no fim de cada e-mail
  avisar: boolean;          // avisar os admins no sino/celular a cada e-mail novo
};
const PADRAO: CfgCaixa = { segredo: '', chave: '', enderecos: [`suporte@${DOMINIO}`, `contato@${DOMINIO}`], padrao: `suporte@${DOMINIO}`, nome: 'Comprei Barato', assinatura: 'Equipe Comprei Barato\nwww.compreibarato.com.br', avisar: true };

export async function lerCfgCaixa(admin: Admin): Promise<CfgCaixa> {
  const { data } = await admin.from('settings').select('value').eq('key', CHAVE_CFG).maybeSingle();
  const v: any = (data as any)?.value || {};
  const enderecos = Array.isArray(v.enderecos) ? v.enderecos.map((e: string) => String(e).toLowerCase()).filter((e: string) => ehNosso(e)) : PADRAO.enderecos;
  const lista = enderecos.length ? enderecos : PADRAO.enderecos;
  return {
    segredo: v.segredo ? decifrar(String(v.segredo)) : '',
    chave: v.chave ? decifrar(String(v.chave)) : '',
    enderecos: lista,
    padrao: lista.includes(String(v.padrao || '').toLowerCase()) ? String(v.padrao).toLowerCase() : lista[0],
    nome: String(v.nome ?? PADRAO.nome).slice(0, 60) || PADRAO.nome,
    assinatura: String(v.assinatura ?? PADRAO.assinatura).slice(0, 1000),
    avisar: v.avisar !== false,
  };
}

/** Salva a configuração. Segredo e chave: vazio = mantém o atual; `limpar…` = apaga. */
export async function salvarCfgCaixa(admin: Admin, b: any): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { data } = await admin.from('settings').select('value').eq('key', CHAVE_CFG).maybeSingle();
  const atual: any = (data as any)?.value || {};
  const novo: any = { ...atual };
  if (b.enderecos !== undefined) {
    const { validos } = listaDeEmails(b.enderecos);
    const nossos = validos.filter(ehNosso);
    if (!nossos.length) return { ok: false, erro: `Informe pelo menos um endereço @${DOMINIO}.` };
    novo.enderecos = nossos.slice(0, 10);
  }
  if (b.padrao !== undefined) novo.padrao = String(b.padrao).toLowerCase();
  if (b.nome !== undefined) novo.nome = String(b.nome).replace(/[<>"]/g, '').trim().slice(0, 60);
  if (b.assinatura !== undefined) novo.assinatura = String(b.assinatura).slice(0, 1000);
  if (b.avisar !== undefined) novo.avisar = !!b.avisar;
  try {
    if (b.limparSegredo) delete novo.segredo;
    else if (b.segredo && String(b.segredo).trim()) {
      const s = String(b.segredo).trim();
      if (!/^whsec_[A-Za-z0-9+/=]{16,}$/.test(s)) return { ok: false, erro: 'O segredo do webhook começa com whsec_ (copie do Resend › Webhooks › Signing secret).' };
      novo.segredo = cifrar(s);
    }
    if (b.limparChave) delete novo.chave;
    else if (b.chave && String(b.chave).trim()) {
      const c = String(b.chave).trim();
      if (!/^re_[A-Za-z0-9_]{10,}$/.test(c)) return { ok: false, erro: 'A chave da API do Resend começa com re_.' };
      novo.chave = cifrar(c);
    }
  } catch {
    return { ok: false, erro: 'Não foi possível guardar com segurança (falta a chave de criptografia do servidor).' };
  }
  const { error } = await admin.from('settings').upsert({ key: CHAVE_CFG, value: novo, updated_at: new Date().toISOString() });
  return error ? { ok: false, erro: 'Não foi possível salvar.' } : { ok: true };
}

const chaveApi = (cfg: CfgCaixa) => cfg.chave || process.env.RESEND_API_KEY || '';

async function resend(cfg: CfgCaixa, caminho: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const chave = chaveApi(cfg);
  if (!chave) return { ok: false, status: 0, data: { message: 'Sem chave do Resend.' } };
  const r = await fetch(API + caminho, {
    ...init,
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

const semTabela = (e: any) => /email_caixa|42P01|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);

// ---------------- receber ----------------
/** Busca o e-mail completo no Resend e guarda na caixa de entrada. Idempotente (o Resend pode reenviar o aviso). */
export async function receberEmail(admin: Admin, emailId: string): Promise<{ ok: boolean; erro?: string; id?: number; ja?: boolean }> {
  const { data: ja } = await admin.from('email_caixa').select('id').eq('resend_id', emailId).maybeSingle();
  if (ja) return { ok: true, ja: true, id: (ja as any).id };
  const cfg = await lerCfgCaixa(admin);
  const r = await resend(cfg, `/emails/receiving/${encodeURIComponent(emailId)}`);
  if (!r.ok) {
    console.error('[caixa] ler e-mail recebido', r.status, r.data?.message);
    return { ok: false, erro: r.status === 401 || r.status === 403 ? 'A chave do Resend não tem permissão para ler e-mails recebidos.' : 'Falha ao ler o e-mail no Resend.' };
  }
  const e = r.data || {};
  const h: Record<string, any> = {};
  for (const [k, v] of Object.entries(e.headers || {})) h[k.toLowerCase()] = Array.isArray(v) ? v.join(' ') : v;
  const de = lerEndereco(h.from || e.from);
  const messageId = (String(e.message_id || h['message-id'] || '').match(/<[^>]+>/) || [null])[0];
  // conversa: se a resposta cita um e-mail que já está na caixa, entra na mesma conversa
  const citados = (`${h.references || ''} ${h['in-reply-to'] || ''}`.match(/<[^>]+>/g) || []).map((x) => x.toLowerCase());
  let conversa = chaveConversa({ messageId, inReplyTo: h['in-reply-to'], references: h.references });
  if (citados.length) {
    const { data: ant } = await admin.from('email_caixa').select('conversa').in('message_id', citados.slice(-20)).limit(1);
    if (ant && ant.length) conversa = (ant[0] as any).conversa;
  }
  const auth = e.authentication || null;
  const spam = !!auth && String(auth.dmarc || '').toLowerCase() === 'fail' && String(auth.spf || '').toLowerCase() !== 'pass';
  const texto = e.text ? String(e.text).slice(0, 200000) : null;
  const html = e.html ? String(e.html).slice(0, 1500000) : null;
  const anexos = (Array.isArray(e.attachments) ? e.attachments : [])
    .filter((a: any) => String(a.content_disposition || '').toLowerCase() !== 'inline' || !a.content_id)
    .map((a: any) => ({ id: String(a.id), nome: String(a.filename || 'anexo').slice(0, 200), tipo: String(a.content_type || ''), tamanho: Number(a.size) || 0 }));
  const linha = {
    pasta: spam ? 'spam' : 'entrada', sentido: 'recebido', resend_id: emailId, message_id: messageId ? messageId.toLowerCase() : null,
    in_reply_to: h['in-reply-to'] ? String(h['in-reply-to']).slice(0, 500) : null, conversa,
    de: de.email || 'desconhecido', de_nome: de.nome, para: (e.to || []).map((x: string) => lerEndereco(x).email), cc: (e.cc || []).map((x: string) => lerEndereco(x).email),
    assunto: String(e.subject || '(sem assunto)').slice(0, 500), texto, html, previa: previaDe(texto, html), anexos, autenticacao: auth,
    criado_em: e.created_at || new Date().toISOString(),
  };
  const { data: ins, error } = await admin.from('email_caixa').insert(linha).select('id').single();
  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) return { ok: true, ja: true };
    return { ok: false, erro: semTabela(error) ? 'Falta rodar o SQL 33.' : error.message };
  }
  if (cfg.avisar && !spam) await avisarAdmins(admin, (ins as any).id, de.nome || de.email, linha.assunto);
  return { ok: true, id: (ins as any).id };
}

async function avisarAdmins(admin: Admin, id: number, quem: string, assunto: string) {
  try {
    const { data: adms } = await admin.from('profiles').select('id').eq('role', 'admin');
    const linhas = ((adms ?? []) as any[]).map((a) => ({
      user_id: a.id, tipo: 'aviso', titulo: `Novo e-mail de ${String(quem).slice(0, 60)}`,
      texto: String(assunto || '(sem assunto)').slice(0, 140), link: `/admin/email?id=${id}`, grupo: `email:${id}`,
    }));
    if (linhas.length) await admin.from('notificacoes').insert(linhas);
  } catch (e: any) { console.error('[caixa] aviso', e?.message || e); }
}

// ---------------- enviar ----------------
export type Envio = {
  de?: string; para: unknown; cc?: unknown; bcc?: unknown; assunto: string; texto: string;
  responderA?: number | null;                  // id da mensagem respondida (entra na mesma conversa)
  anexos?: { nome: string; tipo?: string; conteudo: string }[]; // conteúdo em base64
  adminId: string;
};
const LIMITE_ANEXOS = 3 * 1024 * 1024; // 3 MB somados (limite de tamanho do pedido na Vercel)

export async function enviarDaCaixa(admin: Admin, e: Envio): Promise<{ ok: true; id: number } | { ok: false; erro: string; status?: number }> {
  const cfg = await lerCfgCaixa(admin);
  const de = String(e.de || cfg.padrao).toLowerCase();
  if (!cfg.enderecos.includes(de)) return { ok: false, erro: 'Escolha um endereço de envio da lista.', status: 400 };
  const para = listaDeEmails(e.para), cc = listaDeEmails(e.cc), bcc = listaDeEmails(e.bcc);
  const invalidos = [...para.invalidos, ...cc.invalidos, ...bcc.invalidos];
  if (invalidos.length) return { ok: false, erro: `E-mail inválido: ${invalidos.slice(0, 3).join(', ')}`, status: 400 };
  if (!para.validos.length) return { ok: false, erro: 'Informe para quem enviar.', status: 400 };
  const assunto = String(e.assunto || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300) || '(sem assunto)';
  const texto = String(e.texto || '').slice(0, 100000);
  if (!texto.trim()) return { ok: false, erro: 'Escreva a mensagem.', status: 400 };
  const corpo = cfg.assinatura.trim() && !texto.includes(cfg.assinatura.trim()) ? `${texto}\n\n--\n${cfg.assinatura.trim()}` : texto;

  // resposta: mesma conversa e cabeçalhos para o Gmail/Outlook do cliente juntar
  let conversa: string | null = null, inReplyTo: string | null = null, references: string | null = null;
  if (e.responderA) {
    const { data: orig } = await admin.from('email_caixa').select('message_id, conversa').eq('id', e.responderA).maybeSingle();
    if (orig) {
      conversa = (orig as any).conversa;
      inReplyTo = (orig as any).message_id || null;
      references = [conversa, inReplyTo].filter((x, i, a) => x && a.indexOf(x) === i).join(' ') || null;
    }
  }
  const anexos = (e.anexos || []).slice(0, 10).map((a) => ({ filename: String(a.nome || 'anexo').slice(0, 200), content: String(a.conteudo || '').replace(/^data:[^,]*,/, '') }));
  const bytes = anexos.reduce((s, a) => s + Math.floor((a.content.length * 3) / 4), 0);
  if (bytes > LIMITE_ANEXOS) return { ok: false, erro: 'Anexos passam de 3 MB. Envie um link (Drive) no lugar.', status: 413 };

  const messageId = novoMessageId();
  const headers: Record<string, string> = { 'Message-ID': messageId };
  if (inReplyTo) headers['In-Reply-To'] = inReplyTo;
  if (references) headers.References = references;
  const r = await resend(cfg, '/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: `${cfg.nome} <${de}>`, to: para.validos, ...(cc.validos.length ? { cc: cc.validos } : {}), ...(bcc.validos.length ? { bcc: bcc.validos } : {}),
      reply_to: de, subject: assunto, text: corpo, html: htmlDoTexto(corpo), headers, ...(anexos.length ? { attachments: anexos } : {}),
      tags: [{ name: 'tipo', value: 'caixa' }],
    }),
  });
  if (!r.ok) {
    console.error('[caixa] enviar', r.status, r.data?.message);
    return { ok: false, erro: r.data?.message ? `Resend: ${String(r.data.message).slice(0, 200)}` : 'Não foi possível enviar agora.', status: 502 };
  }
  const { data: ins, error } = await admin.from('email_caixa').insert({
    pasta: 'enviados', sentido: 'enviado', resend_id: r.data?.id ? String(r.data.id) : null, message_id: messageId.toLowerCase(), in_reply_to: inReplyTo,
    conversa: conversa || messageId.toLowerCase(), de, de_nome: cfg.nome, para: para.validos, cc: cc.validos, assunto, texto: corpo, html: null,
    previa: previaDe(corpo), anexos: anexos.map((a) => ({ id: null, nome: a.filename, tipo: '', tamanho: Math.floor((a.content.length * 3) / 4) })),
    lido: true, enviado_por: e.adminId,
  }).select('id').single();
  if (error) return { ok: false, erro: semTabela(error) ? 'Enviado, mas falta rodar o SQL 33 para guardar nos Enviados.' : 'Enviado, mas não foi possível guardar nos Enviados.', status: 500 };
  return { ok: true, id: (ins as any).id };
}

/** Link temporário de um anexo recebido (o Resend gera na hora; vale por pouco tempo). */
export async function linkDoAnexo(admin: Admin, linhaId: number, anexoId: string): Promise<string | null> {
  const { data: m } = await admin.from('email_caixa').select('resend_id, sentido').eq('id', linhaId).maybeSingle();
  if (!m || (m as any).sentido !== 'recebido' || !(m as any).resend_id) return null;
  const cfg = await lerCfgCaixa(admin);
  const r = await resend(cfg, `/emails/receiving/${encodeURIComponent((m as any).resend_id)}/attachments`);
  if (!r.ok) return null;
  const a = (r.data?.data || []).find((x: any) => String(x.id) === anexoId);
  return a?.download_url ? String(a.download_url) : null;
}

export { textoDoHtml };
