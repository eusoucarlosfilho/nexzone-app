import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { criarCampanha, resumo, type Publico } from '@/lib/whatsapp/campanhas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const { data, error } = await createAdminClient().from('whatsapp_campanhas')
    .select('id, titulo, publico, status, total, created_at, concluida_em').order('created_at', { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: 'Campanhas indisponíveis (o SQL do WhatsApp foi aplicado?).' }, { status: 503 });
  const lista = await Promise.all((data ?? []).map(async (c: any) => ({ ...c, resumo: await resumo(c.id) })));
  return NextResponse.json({ campanhas: lista }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const b = await req.json().catch(() => ({}));
  const r = await criarCampanha({ titulo: String(b?.titulo || ''), mensagem: String(b?.mensagem || ''), publico: b?.publico as Publico, lista: String(b?.lista || ''), autor: a.userId });
  return r.ok ? NextResponse.json(r, { status: 201 }) : NextResponse.json({ error: r.erro }, { status: 400 });
}
