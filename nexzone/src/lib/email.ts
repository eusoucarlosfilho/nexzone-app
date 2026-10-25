// ============================================================
// E-mails transacionais e promocionais (Resend, domínio próprio).
// USO EXCLUSIVO NO SERVIDOR. A chave fica só na Vercel (RESEND_API_KEY).
//
// Regra de ouro: e-mail NUNCA derruba compra, chat ou painel.
// Toda função aqui captura os próprios erros e só registra no log.
//
// Obs.: e-mails de cadastro e redefinição de senha NÃO passam por aqui —
// são enviados pelo próprio Supabase Auth (SMTP do Resend).
// ============================================================
import { createAdminClient } from '@/lib/supabase/server';

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';
const TIMEOUT_MS = 8000;

export const SITE_URL = (process.env.EMAIL_SITE_URL || 'https://www.compreibarato.com.br').replace(/\/+$/, '');
export const REMETENTE_PADRAO = 'Comprei Barato <avisos@compreibarato.com.br>';

// Cotas do plano grátis do Resend (dia = calendário UTC). Ajustáveis por variável se o plano mudar.
export const LIMITE_DIARIO = Number(process.env.RESEND_DAILY_LIMIT) || 100;
export const LIMITE_MENSAL = Number(process.env.RESEND_MONTHLY_LIMIT) || 3000;
export const LOTE_MAXIMO = 100; // máximo por chamada do batch do Resend

export type EmailTag =
  | 'compra_aprovada' | 'nova_venda' | 'nova_mensagem' | 'escalonamento'
  | 'promocao' | 'promocao_teste' | 'outro';

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; skipped?: 'sem_config' | 'sem_destinatario'; error: string };

function remetente() {
  return process.env.RESEND_FROM || REMETENTE_PADRAO;
}

// Escapa texto vindo de usuário (título de produto, mensagem do chat) antes de pôr no HTML.
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function moneyBR(v: unknown): string {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

// Registro em email_log (conta a cota). Falha aqui também é silenciosa.
async function registrar(tipo: string, qtd: number, status: 'enviado' | 'falha' | 'sem_config', assunto?: string, detalhe?: string) {
  try {
    const admin = createAdminClient();
    await admin.from('email_log').insert({
      tipo, qtd, status,
      assunto: assunto ? assunto.slice(0, 200) : null,
      detalhe: detalhe ? detalhe.slice(0, 300) : null,
    });
  } catch (e: any) {
    console.error('[email] falha ao registrar log:', e?.message || e);
  }
}

async function postResend(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// ------------------------------------------------------------
// Envio unitário
// ------------------------------------------------------------
export async function sendEmail(opts: {
  to: string | null | undefined;
  subject: string;
  html: string;
  tag?: EmailTag;
  headers?: Record<string, string>;
  replyTo?: string;
}): Promise<SendResult> {
  const tag = opts.tag || 'outro';
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error(`[email] RESEND_API_KEY não configurada — "${opts.subject}" não enviado`);
      await registrar(tag, 0, 'sem_config', opts.subject, 'RESEND_API_KEY ausente');
      return { ok: false, skipped: 'sem_config', error: 'RESEND_API_KEY não configurada' };
    }
    const to = String(opts.to || '').trim();
    if (!to) {
      await registrar(tag, 0, 'falha', opts.subject, 'sem destinatário');
      return { ok: false, skipped: 'sem_destinatario', error: 'sem destinatário' };
    }

    const r = await postResend(RESEND_URL, {
      from: remetente(),
      to: [to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
      tags: [{ name: 'tipo', value: tag }],
    });

    if (!r.ok) {
      const msg = `HTTP ${r.status} ${r.data?.name || ''} ${r.data?.message || ''}`.trim();
      console.error(`[email] Resend recusou "${opts.subject}":`, msg);
      await registrar(tag, 1, 'falha', opts.subject, msg);
      return { ok: false, error: msg };
    }
    await registrar(tag, 1, 'enviado', opts.subject);
    return { ok: true, id: r.data?.id };
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 200);
    console.error(`[email] erro ao enviar "${opts.subject}":`, msg);
    await registrar(tag, 1, 'falha', opts.subject, msg);
    return { ok: false, error: msg };
  }
}

// ------------------------------------------------------------
// Envio em lote (promoções). Cada item = 1 destinatário.
// Divide em lotes de até 100 e espera entre chamadas (limite de requisições do Resend).
// ------------------------------------------------------------
export type BatchItem = { to: string; subject: string; html: string; headers?: Record<string, string> };

export async function sendBatch(items: BatchItem[], tag: EmailTag): Promise<{ enviados: number; falhas: number; erros: string[] }> {
  const res = { enviados: 0, falhas: 0, erros: [] as string[] };
  if (!items.length) return res;
  if (!process.env.RESEND_API_KEY) {
    await registrar(tag, 0, 'sem_config', items[0]?.subject, `RESEND_API_KEY ausente (${items.length} não enviados)`);
    res.falhas = items.length;
    res.erros.push('RESEND_API_KEY não configurada');
    return res;
  }
  for (let i = 0; i < items.length; i += LOTE_MAXIMO) {
    const lote = items.slice(i, i + LOTE_MAXIMO);
    try {
      const r = await postResend(RESEND_BATCH_URL, lote.map((it) => ({
        from: remetente(),
        to: [it.to],
        subject: it.subject,
        html: it.html,
        ...(it.headers ? { headers: it.headers } : {}),
        tags: [{ name: 'tipo', value: tag }],
      })));
      if (r.ok) {
        res.enviados += lote.length;
        await registrar(tag, lote.length, 'enviado', lote[0].subject, `lote ${i / LOTE_MAXIMO + 1}`);
      } else {
        const msg = `HTTP ${r.status} ${r.data?.name || ''} ${r.data?.message || ''}`.trim();
        res.falhas += lote.length;
        res.erros.push(msg);
        await registrar(tag, lote.length, 'falha', lote[0].subject, msg);
        if (r.status === 429) break; // cota ou limite de requisições: não insiste
      }
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 200);
      res.falhas += lote.length;
      res.erros.push(msg);
      await registrar(tag, lote.length, 'falha', lote[0].subject, msg);
    }
    if (i + LOTE_MAXIMO < items.length) await new Promise((ok) => setTimeout(ok, 600));
  }
  return res;
}

// ------------------------------------------------------------
// Cota usada (dia UTC e mês UTC, como o Resend conta)
// ------------------------------------------------------------
export async function cotaUsada(): Promise<{ hoje: number; mes: number } | null> {
  // null = não foi possível medir (ex.: migração 0003 não aplicada). Quem envia promoção deve bloquear.
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('email_cota_usada');
    if (error) { console.error('[email] cota: ', error.message); return null; }
    const row: any = Array.isArray(data) ? data[0] : data;
    return { hoje: Number(row?.hoje) || 0, mes: Number(row?.mes) || 0 };
  } catch (e: any) {
    console.error('[email] cota: ', e?.message || e);
    return null;
  }
}

// ------------------------------------------------------------
// E-mail do usuário (vem de auth.users — só com service_role, só no servidor)
// ------------------------------------------------------------
export async function emailDoUsuario(admin: any, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch (e: any) {
    console.error('[email] getUserById falhou:', e?.message || e);
    return null;
  }
}

// ------------------------------------------------------------
// Layout com a identidade do site (tabelas + CSS inline: Gmail/Outlook)
// `texto` aceita HTML simples já escapado; use esc() em conteúdo de usuário.
// ------------------------------------------------------------
export function layoutEmail(opts: {
  titulo: string;
  texto: string;
  botaoTexto?: string;
  botaoUrl?: string;
  rodapeExtra?: string; // ex.: link "Não quero mais receber" nas promoções
  preheader?: string;   // resumo que aparece na caixa de entrada
}): string {
  const fonte = 'Arial, Helvetica, sans-serif';
  const botao = opts.botaoTexto && opts.botaoUrl ? `
          <tr>
            <td align="left" style="padding:8px 32px 28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#FF6B00" style="border-radius:50px;">
                    <a href="${esc(opts.botaoUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-family:${fonte};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:50px;background:#FF6B00;">
                      ${esc(opts.botaoTexto)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(opts.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#FFF7F0;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#FFF7F0;">${esc(opts.preheader || opts.titulo)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF7F0" style="background:#FFF7F0;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="left" style="padding:0 8px 18px 8px;font-family:${fonte};font-size:24px;font-weight:bold;letter-spacing:-0.5px;">
              <a href="${SITE_URL}" target="_blank" style="text-decoration:none;"><span style="color:#16161F;">Comprei</span><span style="color:#FF6B00;">Barato</span></a>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid #F1E4D8;border-radius:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="padding:30px 32px 8px 32px;font-family:${fonte};font-size:21px;line-height:28px;font-weight:bold;color:#16161F;">
                    ${esc(opts.titulo)}
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:8px 32px 20px 32px;font-family:${fonte};font-size:15px;line-height:23px;color:#4A4A5A;">
                    ${opts.texto}
                  </td>
                </tr>${botao}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0 8px;font-family:${fonte};font-size:12px;line-height:18px;color:#8A8A9A;">
              Comprei Barato · produtos digitais com entrega imediata<br>
              <a href="${SITE_URL}" target="_blank" style="color:#FF6B00;text-decoration:none;">www.compreibarato.com.br</a>
              ${opts.rodapeExtra ? `<br><br>${opts.rodapeExtra}` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Converte texto simples (ex.: digitado pelo admin) em parágrafos HTML seguros.
export function textoParaHtml(t: string): string {
  return esc(t).split(/\n{2,}/).map((p) => p.replace(/\n/g, '<br>')).filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px 0;">${p}</p>`).join('');
}

// URL de descadastro e cabeçalhos List-Unsubscribe (RFC 8058: um clique)
export function urlDescadastro(token: string) {
  return `${SITE_URL}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}
export function headersDescadastro(token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${urlDescadastro(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
export function rodapeDescadastro(token: string) {
  return `Você recebe este e-mail porque aceitou receber promoções da Comprei Barato.<br>
<a href="${esc(urlDescadastro(token))}" target="_blank" style="color:#8A8A9A;text-decoration:underline;">Não quero mais receber</a>`;
}
