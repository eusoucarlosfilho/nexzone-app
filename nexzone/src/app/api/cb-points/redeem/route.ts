import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardPoints, getSettingNum } from '@/lib/points';

const MIN_PONTOS = 100;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { pontos } = await req.json();
  const qtd = Math.floor(Number(pontos));
  if (!qtd || qtd < MIN_PONTOS) return NextResponse.json({ error: `Resgate mínimo de ${MIN_PONTOS} pontos.` }, { status: 400 });

  const admin = createAdminClient();

  // precisa ter loja (só vendedor troca por saldo)
  const { data: store } = await admin.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'Você precisa ter uma loja para trocar pontos por saldo.' }, { status: 400 });

  const { data: prof } = await admin.from('profiles').select('cb_points').eq('id', user.id).maybeSingle();
  const saldoPts = Number((prof as any)?.cb_points ?? 0);
  if (saldoPts < qtd) return NextResponse.json({ error: 'Pontos insuficientes.' }, { status: 400 });

  const perBrl = await getSettingNum(admin, 'cb_points_per_brl', 100);
  const valor = Math.round((qtd / perBrl) * 100) / 100;
  if (valor <= 0) return NextResponse.json({ error: 'Valor de resgate inválido.' }, { status: 400 });

  // debita pontos e credita saldo
  await awardPoints(admin, user.id, -qtd, `Resgate de ${qtd} pontos por saldo`, null);
  await admin.from('balance_credits').insert({ store_id: (store as any).id, valor, motivo: `Resgate de ${qtd} CB Points` });

  return NextResponse.json({ ok: true, valor });
}
