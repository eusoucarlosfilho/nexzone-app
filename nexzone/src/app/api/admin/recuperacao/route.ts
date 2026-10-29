import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { pedidosAntigos, carrinhosAntigos, recuperarAntigos } from '@/lib/recuperacao-servidor';
import { minutosRecuperacao } from '@/lib/posVenda';
import { lerConfig } from '@/lib/whatsapp/config';
import { conectado } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin › Pedidos › Recuperação de vendas
//   GET  → robô ligado? última execução, tempo do 1º lembrete, WhatsApp conectado, quantos antigos dá para chamar
//   POST { acao: 'minutos', minutos } | { acao: 'antigos' }
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? user : null;
}

export async function GET() {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const admin = createAdminClient();
  const [cfgRows, segredo, wa] = await Promise.all([
    admin.from('settings').select('key, value').in('key', ['recuperacao_minutos', 'cron_eventos_em']),
    admin.from('push_config').select('chave').eq('chave', 'segredo_cron').maybeSingle(),
    lerConfig(),
  ]);
  const m: Record<string, any> = Object.fromEntries(((cfgRows.data ?? []) as any[]).map((r) => [r.key, r.value]));
  const [pedidos, carrinhos, ligado] = await Promise.all([pedidosAntigos(admin), carrinhosAntigos(admin), wa.ativo ? conectado().catch(() => false) : Promise.resolve(false)]);
  const { count: ultimas24h } = await admin.from('lembretes_pix').select('order_id', { count: 'exact', head: true }).gte('enviado_em', new Date(Date.now() - 86400000).toISOString());
  return NextResponse.json({
    sql24: !!segredo.data,
    minutos: minutosRecuperacao(m.recuperacao_minutos),
    roboEm: m.cron_eventos_em ? String(m.cron_eventos_em).replace(/"/g, '') : null,
    whatsapp: { ativo: wa.ativo, conectado: !!ligado },
    antigos: { pedidos: pedidos.length, carrinhos: carrinhos.length },
    lembretes24h: ultimas24h ?? 0,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  if (b.acao === 'minutos') {
    const n = Math.round(Number(b.minutos));
    if (!Number.isFinite(n) || n < 3 || n > 120) return NextResponse.json({ error: 'Use de 3 a 120 minutos.' }, { status: 400 });
    const { error } = await admin.from('settings').upsert({ key: 'recuperacao_minutos', value: n, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
    return NextResponse.json({ ok: true, minutos: n });
  }
  if (b.acao === 'antigos') {
    try { return NextResponse.json({ ok: true, ...(await recuperarAntigos(admin)) }); }
    catch (e: any) { console.error('[recuperacao] antigos', e?.message || e); return NextResponse.json({ error: 'Falhou no meio. Os que saíram ficaram registrados; clique de novo para continuar.' }, { status: 500 }); }
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
