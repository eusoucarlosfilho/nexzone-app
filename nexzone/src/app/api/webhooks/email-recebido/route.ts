import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assinaturaValida } from '@/lib/caixaEmail-assinatura';
import { lerCfgCaixa, receberEmail } from '@/lib/caixaEmail-servidor';

export const dynamic = 'force-dynamic';

// Aviso do Resend quando chega um e-mail em qualquer endereço @compreibarato.com.br (evento email.received).
// Só aceita aviso ASSINADO com o segredo salvo em Admin › Caixa de e-mail › Configurar.
// O aviso só traz o id: o e-mail completo é buscado no Resend pelo servidor.
export async function POST(req: Request) {
  const corpo = await req.text();
  const admin = createAdminClient();
  const cfg = await lerCfgCaixa(admin);
  if (!cfg.segredo) return NextResponse.json({ error: 'caixa de e-mail não configurada' }, { status: 503 });
  const ok = assinaturaValida(cfg.segredo, {
    id: req.headers.get('svix-id') || req.headers.get('webhook-id'),
    timestamp: req.headers.get('svix-timestamp') || req.headers.get('webhook-timestamp'),
    assinatura: req.headers.get('svix-signature') || req.headers.get('webhook-signature'),
  }, corpo);
  if (!ok) return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  let ev: any = {};
  try { ev = JSON.parse(corpo); } catch { return NextResponse.json({ error: 'json inválido' }, { status: 400 }); }
  if (ev?.type !== 'email.received') return NextResponse.json({ ok: true, ignorado: ev?.type || null });
  const id = String(ev?.data?.email_id || '');
  if (!id) return NextResponse.json({ error: 'sem email_id' }, { status: 400 });
  const r = await receberEmail(admin, id);
  // erro de leitura: responde 500 para o Resend tentar de novo mais tarde
  return r.ok ? NextResponse.json({ ok: true, id: r.id ?? null }) : NextResponse.json({ error: r.erro }, { status: 500 });
}
