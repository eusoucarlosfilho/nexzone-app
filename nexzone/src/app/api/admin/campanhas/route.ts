import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { lerCfgCampanhas, vagasFundador, tornarFundador, fundadorDaLoja } from '@/lib/campanhas-servidor';
import { lerCampanhas } from '@/lib/campanhas';

export const dynamic = 'force-dynamic';

// Admin › Configurações › Campanhas
//   GET  → configuração, vagas, fundadores e números do mês
//   POST { acao: 'salvar', ... } | { acao: 'adicionar', loja } | { acao: 'remover', storeId }
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
  const cfg = await lerCfgCampanhas(admin);
  const vagas = await vagasFundador(admin, cfg);
  let fundadores: any[] = [];
  if (vagas.sql28) {
    const { data } = await admin.from('stores').select('id, nome, slug, fundador_numero, fundador_em').not('fundador_numero', 'is', null).order('fundador_numero').limit(500);
    fundadores = await Promise.all(((data ?? []) as any[]).map(async (s) => ({ ...s, situacao: await fundadorDaLoja(admin, s.id, cfg) })));
  }
  const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
  const [semTaxa, cash] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pago', 'entregue']).eq('taxa_comprador_pix', 0).gte('created_at', inicioMes.toISOString()),
    admin.from('points_ledger').select('delta').eq('motivo', 'Cashback da compra').gte('created_at', inicioMes.toISOString()).limit(10000),
  ]);
  const pontosCash = ((cash.data ?? []) as any[]).reduce((a, r) => a + Number(r.delta || 0), 0);
  return NextResponse.json({
    cfg, vagas, fundadores,
    mes: { primeirasSemTaxa: semTaxa.error ? null : semTaxa.count ?? 0, cashbackPontos: pontosCash, cashbackReais: Math.floor((pontosCash / cfg.pontosPorReal) * 100) / 100 },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const admin = createAdminClient();

  if (b.acao === 'salvar') {
    const c = lerCampanhas({
      promo_primeira_compra: b.primeiraCompra, promo_primeira_compra_cartao: b.primeiraCompraCartao, fundador_ativo: b.fundadorAtivo,
      fundador_vagas: b.fundadorVagas, fundador_dias: b.fundadorDias, fundador_teto: b.fundadorTeto, fundador_destaque_dias: b.fundadorDestaqueDias, cb_cashback_pct: b.cashbackPct,
    });
    const agora = new Date().toISOString();
    const linhas = [
      ['promo_primeira_compra', c.primeiraCompra], ['promo_primeira_compra_cartao', c.primeiraCompraCartao], ['fundador_ativo', c.fundadorAtivo],
      ['fundador_vagas', c.fundadorVagas], ['fundador_dias', c.fundadorDias], ['fundador_teto', c.fundadorTeto], ['fundador_destaque_dias', c.fundadorDestaqueDias],
      ['cb_cashback_pct', c.cashbackPct], ['cb_points_ativo', b.cbAtivo === true],
    ].map(([key, value]) => ({ key, value, updated_at: agora }));
    const { error } = await admin.from('settings').upsert(linhas);
    return error ? NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 }) : NextResponse.json({ ok: true, cfg: c });
  }
  if (b.acao === 'adicionar') {
    const termo = String(b.loja || '').trim().replace(/^.*\/loja\//, '').replace(/[/?#].*$/, '').slice(0, 80);
    if (termo.length < 2) return NextResponse.json({ error: 'Informe o link ou o nome da loja.' }, { status: 400 });
    let { data: loja } = await admin.from('stores').select('id, nome').eq('slug', termo).maybeSingle();
    if (!loja) ({ data: loja } = await admin.from('stores').select('id, nome').ilike('nome', termo).limit(1).maybeSingle());
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada. Use o link da loja (/loja/...).' }, { status: 404 });
    const num = await tornarFundador(admin, (loja as any).id, null);
    return num ? NextResponse.json({ ok: true, numero: num, nome: (loja as any).nome }) : NextResponse.json({ error: 'Sem vaga, programa desligado ou falta rodar o SQL 28.' }, { status: 409 });
  }
  if (b.acao === 'remover') {
    const { error } = await admin.from('stores').update({ fundador_numero: null, fundador_em: null }).eq('id', String(b.storeId || ''));
    return error ? NextResponse.json({ error: 'Não foi possível remover.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
