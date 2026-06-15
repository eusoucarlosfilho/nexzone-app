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

  // CB Points e liberação de saldo
  const numKeys: [string, number, number][] = [
    ['cb_points_per_purchase', 0, 100000],
    ['cb_points_per_brl', 1, 1000000],
    ['cb_points_review_bonus', 0, 100000],
    ['review_window_days', 0, 60],
    ['fast_release_days', 0, 60],
  ];
  for (const [key, min, max] of numKeys) {
    if (body[key] != null) {
      const v = Number(body[key]);
      if (isNaN(v) || v < min || v > max) return NextResponse.json({ error: `valor inválido para ${key}` }, { status: 400 });
      rows.push({ key, value: v });
    }
  }

  // Escalonamento (Torpedos enviados)
  if (body.escalonamento_horas != null) {
    const h = Number(body.escalonamento_horas);
    if (isNaN(h) || h < 1 || h > 240) return NextResponse.json({ error: 'horas inválidas (1 a 240)' }, { status: 400 });
    rows.push({ key: 'escalonamento_horas', value: h });
  }
  if (typeof body.escalonamento_email_on === 'boolean') rows.push({ key: 'escalonamento_email_on', value: body.escalonamento_email_on });
  if (typeof body.escalonamento_sms_on === 'boolean') rows.push({ key: 'escalonamento_sms_on', value: body.escalonamento_sms_on });
  if (typeof body.sms_api_url === 'string') rows.push({ key: 'sms_api_url', value: body.sms_api_url.trim() });
  if (typeof body.sms_remetente === 'string') rows.push({ key: 'sms_remetente', value: body.sms_remetente.trim() });
  // token só atualiza se vier preenchido (em branco mantém o atual)
  if (typeof body.sms_api_token === 'string' && body.sms_api_token.trim()) rows.push({ key: 'sms_api_token', value: body.sms_api_token.trim() });

  // Gateway de pagamento
  if (body.payment_gateway === 'misticpay' || body.payment_gateway === 'mercadopago') {
    rows.push({ key: 'payment_gateway', value: body.payment_gateway });
  }
  // Credenciais MisticPay
  if (typeof body.misticpay_ci === 'string') {
    rows.push({ key: 'misticpay_ci', value: body.misticpay_ci.trim() });
  }
  // Só atualiza o Client Secret se vier um valor novo (em branco = mantém o atual)
  if (typeof body.misticpay_cs === 'string' && body.misticpay_cs.trim()) {
    rows.push({ key: 'misticpay_cs', value: body.misticpay_cs.trim() });
  }

  for (const r of rows) {
    const { error } = await admin.from('settings').upsert({ key: r.key, value: r.value, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
