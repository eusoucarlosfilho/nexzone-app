import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();
  const rows: { key: string; value: any }[] = [];

  if (body.commission_percent != null) {
    const c = Number(body.commission_percent);
    if (isNaN(c) || c < 0 || c > 50) return NextResponse.json({ error: 'comissão inválida (0 a 50%)' }, { status: 400 });
    rows.push({ key: 'commission_percent', value: c });
  }
  if (Array.isArray(body.boost_plans)) {
    const plans = body.boost_plans.map((p: any) => ({ dias: Number(p.dias), valor: Number(p.valor), label: String(p.label || `${p.dias} dias`) }));
    rows.push({ key: 'boost_plans', value: plans });
  }
  if (body.support_email != null) rows.push({ key: 'support_email', value: String(body.support_email) });

  for (const r of rows) {
    const { error } = await admin.from('settings').upsert({ key: r.key, value: r.value, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
