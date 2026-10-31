import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { lerCfgIndicacao, pontosPorReal, salvarCfgIndicacao, usadoNoMes } from '@/lib/indicacao-servidor';
import { pontosDaIndicacao, reaisDosPontos } from '@/lib/indicacao';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export const dynamic = 'force-dynamic';
const semCache = { headers: { 'Cache-Control': 'no-store' } };
const semTabela = (e: any) => /indicac|42P01|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);

// Admin › Indicações
//   GET ?status=todas|cadastrado|pendente|liberada|bloqueada|cancelada|estornada|suspeitas
//   POST { acao: 'config', cfg } | { acao: 'bloquear', id, motivo } | { acao: 'desbloquear', id }
//        | { acao: 'bloquear_codigo' | 'desbloquear_codigo', userId }
export async function GET(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const admin = createAdminClient();
  const cfg = await lerCfgIndicacao(admin);
  const filtro = new URL(req.url).searchParams.get('status') || 'todas';
  let q = admin.from('indicacoes').select('id, indicador_id, indicado_id, codigo, status, order_id, pontos, libera_em, liberada_em, motivo, sinais, criado_em').order('criado_em', { ascending: false }).limit(300);
  if (filtro === 'suspeitas') q = q.neq('sinais', '{}');
  else if (filtro !== 'todas') q = q.eq('status', filtro);
  const { data, error } = await q;
  if (error) return NextResponse.json({ sql37: !semTabela(error), cfg, itens: [], kpis: null }, semCache);

  const { data: todas } = await admin.from('indicacoes').select('status, pontos, indicador_id').limit(50000);
  const t = (todas ?? []) as any[];
  const por = (s: string) => t.filter((x) => x.status === s);
  const soma = (l: any[]) => l.reduce((s, x) => s + (Number(x.pontos) || 0), 0);
  const ranking = new Map<string, { n: number; pts: number }>();
  for (const x of t) if (['pendente', 'liberada'].includes(x.status)) { const r = ranking.get(x.indicador_id) || { n: 0, pts: 0 }; r.n++; r.pts += Number(x.pontos) || 0; ranking.set(x.indicador_id, r); }
  const top = Array.from(ranking.entries()).sort((x, y) => y[1].n - x[1].n).slice(0, 10);
  const { count: codigos } = await admin.from('indicacao_codigos').select('user_id', { count: 'exact', head: true });

  const itens = (data ?? []) as any[];
  const ids = Array.from(new Set([...itens.flatMap((x) => [x.indicador_id, x.indicado_id]), ...top.map(([id]) => id)]));
  const nomes: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 150) {
    const { data: ps } = await admin.from('profiles').select('id, nome').in('id', ids.slice(i, i + 150));
    for (const p of (ps ?? []) as any[]) nomes[p.id] = p.nome || 'Sem nome';
  }
  const { data: bloqueados } = await admin.from('indicacao_codigos').select('user_id').eq('bloqueado', true).limit(1000);

  // Custo em R$ (o ponto vale 1/pontosPorReal). "Usado" = descontos com CB Points em todo o site (o extrato não separa a origem do ponto).
  const ppr = await pontosPorReal(admin);
  const mes = await usadoNoMes(admin, ppr);
  const { data: usados } = await admin.from('points_ledger').select('delta').eq('motivo', 'Desconto com CB Points no checkout').limit(50000);
  const custo = {
    pontosPorReal: ppr,
    orcamentoMes: cfg.orcamentoMensal, liberadoMes: mes, restanteMes: Math.max(0, Math.round((cfg.orcamentoMensal - mes) * 100) / 100),
    pendenteReais: reaisDosPontos(soma(por('pendente')), ppr), liberadoTotalReais: reaisDosPontos(soma(por('liberada')), ppr),
    descontosUsadosReais: reaisDosPontos(((usados ?? []) as any[]).reduce((s2, x) => s2 + Math.abs(Number(x.delta) || 0), 0), ppr),
  };
  return NextResponse.json({
    sql37: true, cfg, custo,
    kpis: { codigos: codigos ?? 0, cadastros: t.length, pendentes: por('pendente').length, liberadas: por('liberada').length, bloqueadas: por('bloqueada').length, estornadas: por('estornada').length, canceladas: por('cancelada').length, pontosPendentes: soma(por('pendente')), pontosLiberados: soma(por('liberada')) },
    top: top.map(([id, r]) => ({ id, nome: nomes[id] || '—', indicacoes: r.n, pontos: r.pts })),
    codigosBloqueados: ((bloqueados ?? []) as any[]).map((b) => b.user_id),
    itens: itens.map((x) => ({ ...x, indicador: nomes[x.indicador_id] || '—', indicado: nomes[x.indicado_id] || '—' })),
  }, semCache);
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const admin = createAdminClient();
  const agora = new Date().toISOString();
  const log = (acao: string, alvoId: string, detalhes: any) => registrarAcao({ adminId: a.userId, acao, alvoTipo: 'config', alvoId, alvoNome: 'Indicações', detalhes });

  if (b.acao === 'config') {
    const cfg = await salvarCfgIndicacao(admin, b.cfg);
    await log('indicacao_config', 'indicacao_cfg', { ativo: cfg.ativo, pontos: cfg.pontos, minimo: cfg.minimo, prazoDias: cfg.prazoDias, limite: cfg.limitePorUsuario, tetoComissaoPct: cfg.tetoComissaoPct, orcamentoMensal: cfg.orcamentoMensal });
    return NextResponse.json({ ok: true, cfg });
  }
  if (b.acao === 'bloquear_codigo' || b.acao === 'desbloquear_codigo') {
    const userId = String(b.userId || '');
    const { error } = await admin.from('indicacao_codigos').update({ bloqueado: b.acao === 'bloquear_codigo' }).eq('user_id', userId);
    if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
    await log(b.acao, userId, {});
    return NextResponse.json({ ok: true });
  }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Indicação inválida.' }, { status: 400 });
  const { data: i } = await admin.from('indicacoes').select('id, status, order_id').eq('id', id).maybeSingle();
  if (!i) return NextResponse.json({ error: 'Indicação não encontrada.' }, { status: 404 });

  if (b.acao === 'bloquear') {
    // só antes de pagar: liberada já virou ponto (para tirar, reembolse o pedido ou ajuste em CB Points)
    if (!['cadastrado', 'pendente'].includes((i as any).status)) return NextResponse.json({ error: 'Só dá para bloquear indicações ainda não pagas.' }, { status: 400 });
    const motivo = String(b.motivo || 'Bloqueada pelo admin.').slice(0, 300);
    await admin.from('indicacoes').update({ status: 'bloqueada', motivo, atualizado_em: agora }).eq('id', id).eq('status', (i as any).status);
    await log('indicacao_bloqueada', String(id), { motivo, antes: (i as any).status });
    return NextResponse.json({ ok: true });
  }
  if (b.acao === 'desbloquear') {
    if ((i as any).status !== 'bloqueada') return NextResponse.json({ error: 'Essa indicação não está bloqueada.' }, { status: 400 });
    const cfg = await lerCfgIndicacao(admin);
    let patch: any = { status: 'cadastrado', motivo: null, atualizado_em: agora };
    if ((i as any).order_id) {
      const { data: o } = await admin.from('orders').select('status, taxa').eq('id', (i as any).order_id).maybeSingle();
      const pts = o ? pontosDaIndicacao(cfg, Number((o as any).taxa) || 0, await pontosPorReal(admin)) : 0; // mesmo teto de margem
      patch = o && ['pago', 'entregue'].includes((o as any).status) && pts > 0
        ? { status: 'pendente', pontos: pts, libera_em: new Date(Date.now() + cfg.prazoDias * 86400000).toISOString(), motivo: 'Liberada pelo admin após análise.', atualizado_em: agora }
        : o && ['pago', 'entregue'].includes((o as any).status)
          ? { status: 'cancelada', motivo: 'A comissão do pedido não cobre a recompensa.', atualizado_em: agora }
          : { status: 'estornada', motivo: 'Compra não está mais paga.', atualizado_em: agora };
    }
    await admin.from('indicacoes').update(patch).eq('id', id).eq('status', 'bloqueada');
    await log('indicacao_desbloqueada', String(id), { para: patch.status });
    return NextResponse.json({ ok: true, status: patch.status });
  }
  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
