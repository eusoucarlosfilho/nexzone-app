import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  sendEmail, sendBatch, layoutEmail, textoParaHtml, cotaUsada,
  headersDescadastro, rodapeDescadastro, LIMITE_DIARIO, LIMITE_MENSAL, type BatchItem,
} from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Envio de promoções pelo Admin.
// Vai SOMENTE para quem marcou email_marketing = true (consentimento, LGPD),
// com link de descadastro e List-Unsubscribe em todo e-mail.
// Bloqueia envio acima da cota diária/mensal do plano grátis do Resend.

async function exigirAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}

type Destinatario = { id: string; email: string; token: string };

// Quem aceitou receber promoções (e não está bloqueado), com o e-mail vindo do Auth (servidor).
async function destinatarios(admin: any): Promise<Destinatario[]> {
  const perfis: { id: string; marketing_token: string }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from('profiles')
      .select('id, marketing_token, status')
      .eq('email_marketing', true)
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    const lote = (data ?? []).filter((p: any) => p.status !== 'bloqueado');
    perfis.push(...lote);
    if (!data || data.length < 1000) break;
  }
  if (!perfis.length) return [];

  const emails = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) if (u.email) emails.set(u.id, u.email);
    if (users.length < 1000) break;
  }

  const vistos = new Set<string>();
  const out: Destinatario[] = [];
  for (const p of perfis) {
    const email = emails.get(p.id);
    if (!email || !p.marketing_token) continue;
    const chave = email.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ id: p.id, email, token: p.marketing_token });
  }
  return out;
}

function validar(body: any): { ok: true; assunto: string; texto: string; botaoTexto?: string; botaoUrl?: string } | { ok: false; error: string } {
  const assunto = String(body?.assunto || '').trim();
  const texto = String(body?.texto || '').trim();
  const botaoUrl = String(body?.botaoUrl || '').trim();
  const botaoTexto = String(body?.botaoTexto || '').trim() || 'Ver ofertas';
  if (assunto.length < 3 || assunto.length > 150) return { ok: false, error: 'O assunto precisa ter entre 3 e 150 caracteres.' };
  if (texto.length < 10 || texto.length > 5000) return { ok: false, error: 'O texto precisa ter entre 10 e 5.000 caracteres.' };
  if (botaoUrl && !/^https:\/\/[^\s"'<>]+$/i.test(botaoUrl)) return { ok: false, error: 'O link do botão precisa começar com https://' };
  return { ok: true, assunto, texto, ...(botaoUrl ? { botaoTexto: botaoTexto.slice(0, 40), botaoUrl } : {}) };
}

function montarHtml(v: { assunto: string; texto: string; botaoTexto?: string; botaoUrl?: string }, token: string) {
  return layoutEmail({
    titulo: v.assunto,
    preheader: v.texto.slice(0, 110),
    texto: textoParaHtml(v.texto),
    botaoTexto: v.botaoTexto,
    botaoUrl: v.botaoUrl,
    rodapeExtra: rodapeDescadastro(token),
  });
}

// GET → números para a tela (quantos aceitaram, cota usada)
export async function GET() {
  const a = await exigirAdmin();
  if ('erro' in a) return a.erro;
  const admin = createAdminClient();
  const [{ count, error }, cota] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('email_marketing', true),
    cotaUsada(),
  ]);
  return NextResponse.json({
    inscritos: error ? null : (count ?? 0),
    migracaoOk: !error && cota !== null,
    cota, limiteDiario: LIMITE_DIARIO, limiteMensal: LIMITE_MENSAL,
    chaveOk: !!process.env.RESEND_API_KEY,
  });
}

// POST { acao: 'teste' | 'enviar', assunto, texto, botaoTexto?, botaoUrl? }
export async function POST(req: Request) {
  const a = await exigirAdmin();
  if ('erro' in a) return a.erro;
  const admin = createAdminClient();

  let body: any = {};
  try { body = await req.json(); } catch {}
  const v = validar(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY não configurada na Vercel.' }, { status: 503 });

  const cota = await cotaUsada();
  if (!cota) return NextResponse.json({ error: 'Não foi possível medir a cota de e-mails (a migração 0003 foi aplicada?). Envio bloqueado por segurança.' }, { status: 503 });

  // ---------- TESTE: só para o próprio admin ----------
  if (body?.acao === 'teste') {
    if (cota.hoje + 1 > LIMITE_DIARIO) return NextResponse.json({ error: `Cota diária atingida (${cota.hoje}/${LIMITE_DIARIO}).` }, { status: 429 });
    const { data: me } = await admin.from('profiles').select('marketing_token').eq('id', a.user.id).maybeSingle();
    const token = (me as any)?.marketing_token;
    if (!a.user.email || !token) return NextResponse.json({ error: 'Seu perfil não tem e-mail ou token de descadastro.' }, { status: 400 });
    const r = await sendEmail({
      to: a.user.email, tag: 'promocao_teste', subject: `[TESTE] ${v.assunto}`,
      html: montarHtml(v, token), headers: headersDescadastro(token),
    });
    if (!r.ok) return NextResponse.json({ error: `Falha no teste: ${r.error}` }, { status: 502 });
    return NextResponse.json({ ok: true, enviadoPara: a.user.email });
  }

  // ---------- ENVIO REAL ----------
  if (body?.acao !== 'enviar' || body?.confirmar !== true) {
    return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
  }

  // Evita disparo duplo (clique repetido / duas abas): mesmo assunto nos últimos 10 min.
  const dezMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recente } = await admin.from('email_log').select('id')
    .eq('tipo', 'promocao').eq('assunto', v.assunto.slice(0, 200)).gte('created_at', dezMin).limit(1);
  if (recente && recente.length) return NextResponse.json({ error: 'Esta promoção já foi enviada há menos de 10 minutos.' }, { status: 409 });

  let lista: Destinatario[];
  try { lista = await destinatarios(admin); }
  catch (e: any) { return NextResponse.json({ error: `Não foi possível montar a lista: ${e?.message || e}` }, { status: 500 }); }
  if (!lista.length) return NextResponse.json({ error: 'Ninguém aceitou receber promoções ainda.' }, { status: 400 });

  const livresHoje = LIMITE_DIARIO - cota.hoje;
  const livresMes = LIMITE_MENSAL - cota.mes;
  if (lista.length > livresHoje) {
    return NextResponse.json({ error: `Bloqueado: ${lista.length} destinatários, mas só restam ${Math.max(0, livresHoje)} envios hoje (limite ${LIMITE_DIARIO}/dia do plano grátis). Tente amanhã ou aumente o plano do Resend.` }, { status: 429 });
  }
  if (lista.length > livresMes) {
    return NextResponse.json({ error: `Bloqueado: só restam ${Math.max(0, livresMes)} envios neste mês (limite ${LIMITE_MENSAL}/mês).` }, { status: 429 });
  }

  const itens: BatchItem[] = lista.map((d) => ({
    to: d.email, subject: v.assunto, html: montarHtml(v, d.token), headers: headersDescadastro(d.token),
  }));
  const r = await sendBatch(itens, 'promocao');
  return NextResponse.json({ ok: r.falhas === 0, total: lista.length, enviados: r.enviados, falhas: r.falhas, erros: r.erros.slice(0, 3) });
}
