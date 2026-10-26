import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { emailValido, nomeValido } from '@/lib/rastreioVenda';
import { normalizarTelefone } from '@/lib/whatsapp/telefone';

// Checkout SEM LOGIN (Sprint 1) — identifica o comprador antes de gerar o pagamento.
//
//  • E-mail novo  → cria a conta na hora (nome + WhatsApp) e já deixa a pessoa logada neste navegador.
//                   Depois do pagamento ela acessa o pedido normalmente e pode criar uma senha.
//  • E-mail que já tem conta → NÃO loga ninguém (seria entrar na conta de outra pessoa).
//                   Responde { existe: true } e a tela pede a senha ou manda um link de acesso.
//
// Não mexe em valor, pedido nem pagamento: o pedido continua sendo criado em /api/checkout.
const SEM_CACHE = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.json({ ok: true, jaLogado: true }, { headers: SEM_CACHE });

  const body = await req.json().catch(() => ({}));
  // Armadilha para robôs: campo invisível que pessoas não preenchem
  if (typeof body.site === 'string' && body.site.trim()) return NextResponse.json({ error: 'Não foi possível continuar.' }, { status: 400, headers: SEM_CACHE });

  const nome = String(body.nome || '').replace(/\s+/g, ' ').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const whatsapp = normalizarTelefone(body.whatsapp);
  if (!nomeValido(nome)) return NextResponse.json({ error: 'Informe seu nome e sobrenome.', campo: 'nome' }, { status: 400, headers: SEM_CACHE });
  if (!emailValido(email)) return NextResponse.json({ error: 'Informe um e-mail válido.', campo: 'email' }, { status: 400, headers: SEM_CACHE });
  if (!whatsapp) return NextResponse.json({ error: 'Informe um WhatsApp válido com DDD.', campo: 'whatsapp' }, { status: 400, headers: SEM_CACHE });

  const admin = createAdminClient();
  const { error: criarErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      nome,
      whatsapp,
      whatsapp_avisos: body.avisosWhatsapp === false ? 'false' : 'true', // avisos do pedido
      whatsapp_promocoes: 'false',                                      // promoções: só se a pessoa ligar depois
      criado_no_checkout: true,
    },
  });
  if (criarErr) {
    const jaExiste = (criarErr as any).code === 'email_exists' || /already|registered|exists/i.test(criarErr.message || '');
    if (jaExiste) return NextResponse.json({ existe: true }, { headers: SEM_CACHE });
    console.error('[checkout/identificar] criar conta:', criarErr.message);
    return NextResponse.json({ error: 'Não foi possível continuar agora. Tente de novo em instantes.' }, { status: 502, headers: SEM_CACHE });
  }

  // Conta acabou de nascer: abre a sessão neste navegador (link mágico gerado e confirmado no servidor)
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = (link as any)?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error('[checkout/identificar] link:', linkErr?.message);
    return NextResponse.json({ existe: true }, { headers: SEM_CACHE }); // conta criada: a tela oferece o link por e-mail
  }
  const { error: verErr } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (verErr) {
    console.error('[checkout/identificar] sessão:', verErr.message);
    return NextResponse.json({ existe: true }, { headers: SEM_CACHE });
  }
  return NextResponse.json({ ok: true, novo: true }, { headers: SEM_CACHE });
}
