import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CAMPANHA_BF, faseBF, lerCfgBF, hojeBR, textoOfertaCanal } from '@/lib/crescimento';
import { cfgBF, cfgCanais, ofertaDoDia, avisarListaEspera, postarTelegram, linkOferta } from '@/lib/crescimento-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin › Configurações › Crescimento: Black Friday Gamer, oferta do dia e canais de ofertas.
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin';
}
const salvar = async (admin: ReturnType<typeof createAdminClient>, linhas: [string, unknown][]) => {
  const agora = new Date().toISOString();
  const { error } = await admin.from('settings').upsert(linhas.map(([key, value]) => ({ key, value, updated_at: agora })));
  return !error;
};
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const admin = createAdminClient();
  const u = new URL(req.url);
  if (u.searchParams.get('csv')) {
    const { data } = await admin.from('lista_espera').select('email, nome, whatsapp, aceita_whatsapp, avisado_em, created_at').eq('campanha', CAMPANHA_BF).order('id').limit(50000);
    const linhas = ['email;nome;whatsapp;aceita_whatsapp;avisado_em;entrou_em', ...((data ?? []) as any[]).map((r) => [r.email, r.nome, r.whatsapp, r.aceita_whatsapp ? 'sim' : 'nao', r.avisado_em, r.created_at].map(csv).join(';'))];
    return new NextResponse('﻿' + linhas.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="lista-espera-black-friday.csv"' } });
  }
  const [bf, canais, oferta] = await Promise.all([cfgBF(admin), cfgCanais(admin), ofertaDoDia(admin).catch(() => null)]);
  const [tot, avis, insc] = await Promise.all([
    admin.from('lista_espera').select('id', { count: 'exact', head: true }).eq('campanha', CAMPANHA_BF),
    admin.from('lista_espera').select('id', { count: 'exact', head: true }).eq('campanha', CAMPANHA_BF).not('avisado_em', 'is', null),
    admin.from('campanha_produtos').select('id', { count: 'exact', head: true }).eq('campanha', CAMPANHA_BF),
  ]);
  const p = oferta?.produto;
  return NextResponse.json({
    sql30: !tot.error,
    bf: { ...bf, fase: faseBF(bf), lista: tot.count ?? 0, avisados: avis.count ?? 0, inscritos: insc.count ?? 0 },
    canais: { whatsapp: canais.whatsapp, telegram: canais.telegram, telegramToken: canais.telegramToken, telegramChat: canais.telegramChat, hora: canais.hora, postadoHoje: canais.postado === hojeBR().dia, manualHoje: canais.manual?.dia === hojeBR().dia },
    oferta: p ? { id: p.id, titulo: p.titulo, preco: Number(p.preco), preco_promo: p.preco_promo == null ? null : Number(p.preco_promo), link: linkOferta(p.id),
      texto: textoOfertaCanal({ titulo: p.titulo, preco: Number(p.preco), preco_promo: p.preco_promo == null ? null : Number(p.preco_promo), link: linkOferta(p.id) }) } : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const admin = createAdminClient();
  let b: any = {}; try { b = await req.json(); } catch {}

  if (b.acao === 'salvar_bf') {
    const c = lerCfgBF({ bf_inicio: b.inicio, bf_fim: b.fim, bf_desconto_min: b.descontoMin });
    return (await salvar(admin, [['bf_inicio', c.inicio], ['bf_fim', c.fim], ['bf_desconto_min', c.descontoMin]])) ? NextResponse.json({ ok: true, bf: c }) : NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  if (b.acao === 'avisar') {
    const r = await avisarListaEspera(admin, 90);
    if ((r as any).erro === 'sql30') return NextResponse.json({ error: 'Falta rodar o SQL 30.' }, { status: 400 });
    return NextResponse.json({ ok: true, ...r });
  }
  if (b.acao === 'salvar_canais') {
    const url = (v: unknown) => { const s = String(v ?? '').trim(); return !s || /^https:\/\/(whatsapp\.com|www\.whatsapp\.com|t\.me|telegram\.me)\//i.test(s) ? s : null; };
    const w = url(b.whatsapp), t = url(b.telegram);
    if (w === null || t === null) return NextResponse.json({ error: 'Use o link do canal: https://whatsapp.com/channel/… ou https://t.me/…' }, { status: 400 });
    const hora = Math.round(Number(b.hora));
    const linhas: [string, unknown][] = [['canal_whatsapp_url', w], ['canal_telegram_url', t], ['telegram_chat_id', String(b.telegramChat || '').trim().slice(0, 80)], ['oferta_dia_hora', Number.isFinite(hora) && hora >= 0 && hora <= 23 ? hora : 10]];
    if (typeof b.telegramToken === 'string' && b.telegramToken.trim()) linhas.push(['telegram_bot_token', b.telegramToken.trim().slice(0, 120)]);
    if (b.limparToken === true) linhas.push(['telegram_bot_token', '']);
    return (await salvar(admin, linhas)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  if (b.acao === 'oferta_manual') {
    if (b.limpar) return (await salvar(admin, [['oferta_dia_manual', null]])) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
    const m = String(b.produto || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return NextResponse.json({ error: 'Cole o link do produto (ou o ID).' }, { status: 400 });
    const { data: p } = await admin.from('products').select('id, status').eq('id', m[0]).maybeSingle();
    if (!p || (p as any).status !== 'ativo') return NextResponse.json({ error: 'Produto não encontrado ou não está ativo.' }, { status: 404 });
    return (await salvar(admin, [['oferta_dia_manual', { id: m[0], dia: hojeBR().dia }]])) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  if (b.acao === 'postar_telegram') {
    const r = await postarTelegram(admin, true);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 400 });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
