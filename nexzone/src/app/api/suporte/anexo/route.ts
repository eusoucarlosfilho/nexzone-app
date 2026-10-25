import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { usuarioAtual } from '@/lib/suporte/auth';
import { clienteTemAcesso, ehAdmin, urlAssinadaAnexo } from '@/lib/suporte/servidor';

// Abre um anexo do chamado por link assinado de 2 minutos.
// Admin: qualquer anexo. Cliente (dono logado ou link com token): só anexos que não são nota interna.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const messageId = u.searchParams.get('m') || '';
  const token = u.searchParams.get('t');
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return NextResponse.json({ error: 'anexo não encontrado' }, { status: 404 });

  const admin = createAdminClient();
  const { data: m } = await admin.from('support_messages')
    .select('id, ticket_id, attachment_path, attachment_name, is_internal_note').eq('id', messageId).maybeSingle();
  const msg: any = m;
  if (!msg?.attachment_path) return NextResponse.json({ error: 'anexo não encontrado' }, { status: 404 });

  const user = await usuarioAtual();
  let ok = await ehAdmin(admin, user?.id);
  if (!ok && !msg.is_internal_note) {
    const { data: t } = await admin.from('support_tickets').select('id, user_id, access_token_hash').eq('id', msg.ticket_id).maybeSingle();
    ok = !!t && clienteTemAcesso(t, user?.id, token);
  }
  if (!ok) return NextResponse.json({ error: 'anexo não encontrado' }, { status: 404 });

  const url = await urlAssinadaAnexo(admin, msg.attachment_path, msg.attachment_name);
  if (!url) return NextResponse.json({ error: 'anexo indisponível' }, { status: 404 });
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
