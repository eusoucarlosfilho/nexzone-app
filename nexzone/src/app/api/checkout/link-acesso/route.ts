import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { emailValido } from '@/lib/rastreioVenda';
import { sendEmail, layoutEmail, SITE_URL } from '@/lib/email';

// Checkout sem login: e-mail que já tem conta recebe um LINK DE ACESSO que volta direto para o checkout.
// A resposta é sempre a mesma (não revela se o e-mail tem conta).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OK = () => NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const productId = String(body.productId || '');
  if (!emailValido(email) || !UUID.test(productId)) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = (data as any)?.properties?.hashed_token;
    if (error || !tokenHash) return OK(); // e-mail sem conta: não revela
    const url = `${SITE_URL}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=${encodeURIComponent(`/checkout/${productId}`)}`;
    await sendEmail({
      to: email, tag: 'outro', subject: 'Seu link para continuar a compra',
      html: layoutEmail({
        titulo: 'Continue sua compra',
        preheader: 'Clique para entrar e finalizar o pagamento.',
        texto: '<p style="margin:0 0 12px 0;">Clique no botão abaixo para entrar na sua conta e voltar direto para o pagamento. O link vale por 1 hora e só funciona uma vez.</p><p style="margin:0;">Se não foi você que pediu, ignore este e-mail.</p>',
        botaoTexto: 'Continuar a compra', botaoUrl: url,
      }),
    });
  } catch (e: any) {
    console.error('[checkout/link-acesso]', e?.message || e);
  }
  return OK();
}
