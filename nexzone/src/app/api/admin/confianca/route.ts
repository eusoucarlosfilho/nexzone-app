import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { lerEmpresa } from '@/lib/confianca-servidor';
import { validarEmpresa } from '@/lib/confianca';

export const dynamic = 'force-dynamic';

// Admin › Configurações › Dados da empresa no checkout
//   GET  → dados atuais
//   POST { razao, cnpj, whatsapp, email, cidade, prazoManualHoras }
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? user : null;
}

export async function GET() {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  return NextResponse.json(await lerEmpresa(), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const v = validarEmpresa(b);
  if (!v.ok) return NextResponse.json({ error: v.erro, campo: v.campo }, { status: 400 });
  const agora = new Date().toISOString();
  const d = v.dados;
  const linhas = [
    { key: 'empresa_razao', value: d.razao },
    { key: 'empresa_cnpj', value: d.cnpj },
    { key: 'empresa_whatsapp', value: d.whatsapp },
    { key: 'empresa_email', value: d.email },
    { key: 'empresa_cidade', value: d.cidade },
    { key: 'entrega_prazo_horas', value: d.prazoManualHoras },
  ].map((l) => ({ ...l, updated_at: agora }));
  const { error } = await createAdminClient().from('settings').upsert(linhas);
  if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true, ...d });
}
