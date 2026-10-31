import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { linkDoAnexo } from '@/lib/caixaEmail-servidor';

export const dynamic = 'force-dynamic';

// Baixar anexo de um e-mail recebido: GET ?id=<linha>&anexo=<id do anexo> → redireciona para o link temporário do Resend.
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const u = new URL(req.url).searchParams;
  const id = Number(u.get('id'));
  const anexo = String(u.get('anexo') || '');
  if (!id || !/^[A-Za-z0-9_-]{1,100}$/.test(anexo)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const link = await linkDoAnexo(createAdminClient(), id, anexo);
  if (!link || !/^https:\/\//.test(link)) return NextResponse.json({ error: 'Anexo indisponível. Tente de novo em instantes.' }, { status: 404 });
  return NextResponse.redirect(link, { status: 302 });
}
