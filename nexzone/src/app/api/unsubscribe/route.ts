import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { SITE_URL, esc } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Descadastro de promoções (LGPD).
// GET  /api/unsubscribe?t={marketing_token} → link "Não quero mais receber" do rodapé
// POST /api/unsubscribe?t={marketing_token} → "um clique" do Gmail/Outlook (List-Unsubscribe-Post, RFC 8058)
// Público de propósito: quem tem o token (só o dono do e-mail) consegue descadastrar. Não revela dados.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function descadastrar(token: string | null): Promise<'ok' | 'invalido' | 'erro'> {
  if (!token || !UUID.test(token)) return 'invalido';
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('profiles')
      .update({ email_marketing: false, email_marketing_em: new Date().toISOString() })
      .eq('marketing_token', token)
      .select('id');
    if (error) { console.error('[unsubscribe]', error.message); return 'erro'; }
    return data && data.length ? 'ok' : 'invalido';
  } catch (e: any) {
    console.error('[unsubscribe]', e?.message || e);
    return 'erro';
  }
}

function pagina(titulo: string, texto: string, status = 200) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(titulo)} · Comprei Barato</title></head>
<body style="margin:0;background:#FFF7F0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:48px auto;padding:0 16px;">
    <div style="font-size:24px;font-weight:bold;margin-bottom:18px;"><span style="color:#16161F;">Comprei</span><span style="color:#FF6B00;">Barato</span></div>
    <div style="background:#fff;border:1px solid #F1E4D8;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 10px;font-size:21px;color:#16161F;">${esc(titulo)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:23px;color:#4A4A5A;">${texto}</p>
      <a href="${SITE_URL}" style="display:inline-block;background:#FF6B00;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:50px;">Ir para o site</a>
    </div>
  </div>
</body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  const r = await descadastrar(new URL(req.url).searchParams.get('t'));
  if (r === 'ok') {
    return pagina('Pronto!', 'Você não vai mais receber promoções. Os avisos sobre suas compras e vendas continuam chegando normalmente. Se mudar de ideia, é só marcar a opção de novo em Minha conta.');
  }
  if (r === 'invalido') return pagina('Link inválido', 'Não encontramos este link de descadastro. Se ainda recebe promoções, ajuste em Minha conta, no site.', 404);
  return pagina('Tente novamente', 'Não conseguimos concluir agora. Tente de novo em alguns minutos.', 500);
}

export async function POST(req: Request) {
  const r = await descadastrar(new URL(req.url).searchParams.get('t'));
  return NextResponse.json({ ok: r === 'ok' }, { status: r === 'erro' ? 500 : 200 });
}
