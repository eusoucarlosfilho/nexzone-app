import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { antigosElegiveis, recuperarAntigos, filaDeRecuperacao, registrarContato, marcarSituacao } from '@/lib/recuperacao-servidor';
import { CANAIS_VALIDOS, type Canal } from '@/lib/filaRecuperacao';
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
  const { data: p } = await supabase.from('profiles').select('role, nome').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? { id: user.id, nome: String((p as any)?.nome || user.email || 'Admin').split(' ')[0] } : null;
}

export async function GET(req: Request) {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const admin = createAdminClient();
  const [cfgRows, segredo, wa] = await Promise.all([
    admin.from('settings').select('key, value').in('key', ['recuperacao_minutos', 'cron_eventos_em']),
    admin.from('push_config').select('chave').eq('chave', 'segredo_cron').maybeSingle(),
    lerConfig(),
  ]);
  const m: Record<string, any> = Object.fromEntries(((cfgRows.data ?? []) as any[]).map((r) => [r.key, r.value]));
  const querFila = new URL(req.url).searchParams.get('fila') === '1';
  const [el, ligado, fila] = await Promise.all([antigosElegiveis(admin), wa.ativo ? conectado().catch(() => false) : Promise.resolve(false), querFila ? filaDeRecuperacao(admin).catch(() => null) : Promise.resolve(null)]);
  const pedidos = el.pedidos; const carrinhos = el.carrinhos;
  const { count: ultimas24h } = await admin.from('lembretes_pix').select('order_id', { count: 'exact', head: true }).gte('enviado_em', new Date(Date.now() - 86400000).toISOString());
  return NextResponse.json({
    sql24: !!segredo.data,
    minutos: minutosRecuperacao(m.recuperacao_minutos),
    roboEm: m.cron_eventos_em ? String(m.cron_eventos_em).replace(/"/g, '') : null,
    whatsapp: { ativo: wa.ativo, conectado: !!ligado },
    antigos: { pedidos: pedidos.length, carrinhos: carrinhos.length },
    lembretes24h: ultimas24h ?? 0,
    ...(fila ? { fila: fila.itens, sql26: fila.sql26 } : {}),
    // quem o botão "Chamar quem ficou para trás" vai chamar agora (até 12, mesma ordem do envio)
    proximos: [...pedidos.map((o: any) => ({ quem: o.comprador_email || 'cliente', produto: o.products?.titulo || 'produto' })), ...carrinhos.map((c: any) => ({ quem: c.nome || c.email || 'cliente', produto: c.products?.titulo || 'produto' }))].slice(0, 12),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const eu = await soAdmin();
  if (!eu) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
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
  if (b.acao === 'contato' || b.acao === 'situacao') {
    const chave = String(b.chave || '').slice(0, 200);
    if (!chave.includes('|')) return NextResponse.json({ error: 'cliente inválido' }, { status: 400 });
    if (b.acao === 'contato') {
      const canal = String(b.canal || '') as Canal;
      if (!CANAIS_VALIDOS.includes(canal)) return NextResponse.json({ error: 'canal inválido' }, { status: 400 });
      const ok = await registrarContato(admin, chave, canal, eu);
      return ok ? NextResponse.json({ ok: true, por: eu.nome, quando: new Date().toISOString() }) : NextResponse.json({ error: 'Falta rodar o SQL 26 para registrar contatos.' }, { status: 503 });
    }
    const ok = await marcarSituacao(admin, chave, b.desistiu === true, eu);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Falta rodar o SQL 26.' }, { status: 503 });
  }
  if (b.acao === 'antigos') {
    try { return NextResponse.json({ ok: true, ...(await recuperarAntigos(admin)) }); }
    catch (e: any) { console.error('[recuperacao] antigos', e?.message || e); return NextResponse.json({ error: 'Falhou no meio. Os que saíram ficaram registrados; clique de novo para continuar.' }, { status: 500 }); }
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
